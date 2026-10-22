import { env } from 'cloudflare:workers';
import { mobileUser, MobileAuthError } from '../../../lib/mobile-auth';
import { deleteAccount } from '../../../lib/account-deletion';
import { demoUser,hashToken,cookie,revokeSession,walletAddress } from '../../../lib/demo-session';
import { marketData,marketDetails } from '../../../lib/markets';
import {browserDemoQuote} from '../../../lib/demo-quote';
import { simulateBuy } from '../../../lib/game-model';
import { RANGES } from '../../../lib/market-model';
import type { Range } from '../../../lib/market-model';
export const dynamic='force-dynamic';
class Problem extends Error{constructor(public status:number,message:string){super(message)}}
function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
const str=(v:unknown,min:number,max:number)=>{if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)throw new Problem(400,`Please enter ${min}–${max} characters.`);return v.trim()};
async function handler(req:Request){
 try{
  const path=new URL(req.url).pathname.replace('/api/','').split('/');
  // Native requests have no browser Origin. Only a verified bearer identity can
  // bypass browser same-origin protection; demo cookie requests cannot.
  const nativeUser=req.headers.has('Authorization')?await mobileUser(req,env.PRIVY_APP_ID):null;
  if(req.method==='POST'){
   if(req.headers.get('Origin')!==new URL(req.url).origin&&!nativeUser)throw new Problem(403,'Please submit from this app.');
   if(!req.headers.get('Content-Type')?.startsWith('application/json'))throw new Problem(415,'JSON required.');
   if(Number(req.headers.get('Content-Length')||0)>8192)throw new Problem(413,'Request too large.');
  }
  if(path[0]==='markets'&&req.method==='GET')return json(await marketData());
  if(path[0]==='market-detail'&&req.method==='GET'){
   const query=new URL(req.url).searchParams,symbol=query.get('symbol')||'',range=query.get('range')||'1D';
   if(!/^[A-Z0-9_.-]{1,80}$/.test(symbol)||!Object.hasOwn(RANGES,range))throw new Problem(400,'Choose a valid market and chart period.');
   const detail=await marketDetails(symbol,range as Range);
   if(!detail)throw new Problem(404,'This college-football market is no longer available.');
   return json(detail);
  }
  const db=env.DB;
  if(!db)throw new Problem(503,'Database is not connected.');
  const body=req.method==='POST'?await req.json() as Record<string,unknown>:{};
  if(path[0]==='demo-session'&&req.method==='POST'){
   const name=str(body.name,1,60);
   if(body.method==='email'){
    if(typeof body.email!=='string'||body.email.length>254||!/^\S+@\S+\.\S+$/.test(body.email))throw new Problem(400,'Enter a valid demo email address.');
   }else if(body.method==='wallet'){
    if(!walletAddress(body.address))throw new Problem(400,'Connect a valid Solana wallet address.');
   }else throw new Problem(400,'Choose email or wallet.');
   // No email/address storage, wallet verification, or identity lookup by label.
   const userId='demo:'+crypto.randomUUID();
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');
   const hashed=await hashToken(token);
   await revokeSession(req,db);
   await db.batch([db.prepare('INSERT INTO profiles(id,name) VALUES(?,?)').bind(userId,name),db.prepare('INSERT INTO demo_sessions(token_hash,user_id,expires) VALUES(?,?,?)').bind(hashed,userId,Date.now()+2592000000)]);
   return Response.json({user:{id:userId,name},demo:true},{headers:{'Set-Cookie':cookie(token,req),'Cache-Control':'no-store'}});
  }
  if(path[0]==='demo-signout'&&req.method==='POST'){
   await revokeSession(req,db);
   return Response.json({ok:true},{headers:{'Set-Cookie':cookie('',req,0),'Cache-Control':'no-store'}});
  }
  const user=nativeUser||await demoUser(req,db);
  if(path[0]==='me'&&req.method==='GET'&&!user)return json({user:null});
  if(!user)throw new Problem(401,'Enter the demo to create or join a group.');
  const q=(sql:string,...args:any[])=>db.prepare(sql).bind(...args);
  const now=Date.now();
  if(path[0]==='account'&&path[1]==='delete'&&req.method==='POST'){
   if(!nativeUser||body.confirm!=='DELETE')throw new Problem(400,'Confirm deletion from your signed-in mobile account.');
   if(!env.PRIVY_APP_ID||!env.PRIVY_APP_SECRET)throw new Problem(503,'Account deletion needs provider configuration. Contact the app operator.');
   try{await deleteAccount(db,user.userId,env.PRIVY_APP_ID,env.PRIVY_APP_SECRET)}catch{throw new Problem(503,'Deletion could not finish. Keep this session and tap Delete account again to retry.');}
   return json({ok:true});
  }
  if(nativeUser&&await q('SELECT 1 FROM deleted_accounts WHERE user_hash=?',await hashToken(user.userId)).first())throw new Problem(403,'This account was deleted. If deletion was interrupted, retry Delete account.');
  if(path[0]==='reports'&&req.method==='POST'){
   const proposalId=str(body.proposalId,1,64),reason=str(body.reason,1,500);
   if(!await q('SELECT 1 FROM proposals p JOIN members m ON m.group_id=p.group_id WHERE p.id=? AND m.user_id=?',proposalId,user.userId).first())throw new Problem(404,'Post not found.');
   const count=await q('SELECT count(*) as n FROM reports WHERE reporter=? AND created>?',user.userId,now-3600000).first<{n:number}>();
   if((count?.n||0)>=20)throw new Problem(429,'Please wait before submitting another report.');
   await q('INSERT INTO reports(id,reporter,proposal_id,reason,created) VALUES(?,?,?,?,?)',crypto.randomUUID(),user.userId,proposalId,reason,now).run();return json({ok:true});
  }
  if(path[0]==='blocks'&&req.method==='GET')return json({blocks:(await q("SELECT b.blocked_id as id,COALESCE(p.name,'Member') as name FROM blocks b LEFT JOIN profiles p ON p.id=b.blocked_id WHERE b.user_id=?",user.userId).all()).results});
  if(path[0]==='blocks'&&req.method==='POST'){
   const blockedId=str(body.userId,1,128);
   if(blockedId===user.userId)throw new Problem(400,'Choose another member.');
   if(body.remove!==true&&!await q('SELECT 1 FROM members a JOIN members b ON a.group_id=b.group_id WHERE a.user_id=? AND b.user_id=?',user.userId,blockedId).first())throw new Problem(404,'Member not found.');
   if(body.remove===true)await q('DELETE FROM blocks WHERE user_id=? AND blocked_id=?',user.userId,blockedId).run();
   else await q('INSERT OR IGNORE INTO blocks(user_id,blocked_id) VALUES(?,?)',user.userId,blockedId).run();
   return json({ok:true});
  }
  const profile=await q('SELECT name FROM profiles WHERE id=?',user.userId).first<{name:string}>();
  // Use a chosen name or a neutral label; do not expose account email to groups.
  const name=profile?.name||'Member';
  if(path[0]==='me'&&req.method==='GET')return json({user:{id:user.userId,name},needsName:!profile});
  if(path[0]==='market-responses'&&req.method==='GET'){
   const symbol=new URL(req.url).searchParams.get('symbol')||'';
   const ideas=(await q(`SELECT p.id,p.note,p.side,p.title,p.opposite,p.created,COALESCE(u.name,'Member') as authorName,g.name as groupName FROM proposals p JOIN groups g ON g.id=p.group_id JOIN members m ON m.group_id=p.group_id LEFT JOIN profiles u ON u.id=p.author WHERE m.user_id=? AND p.symbol=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.user_id=? AND b.blocked_id=p.author) ORDER BY p.created DESC LIMIT 20`,user.userId,symbol,user.userId).all()).results;
   return json({ideas});
  }
  if(path[0]==='demo-trades'){
   if(path.length===1&&req.method==='GET'){
    const cursor=new URL(req.url).searchParams.get('cursor');
    let before:number|null=null,tradeId='';
    if(cursor){const split=cursor.indexOf(':');before=Number(cursor.slice(0,split));tradeId=cursor.slice(split+1);if(split<1||!Number.isSafeInteger(before)||before<0||!tradeId||tradeId.length>80)throw new Problem(400,'Invalid history cursor.');}
    const rows=(await (before===null?q('SELECT * FROM demo_trades WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 201',user.userId):q('SELECT * FROM demo_trades WHERE user_id=? AND (created<? OR (created=? AND id<?)) ORDER BY created DESC,id DESC LIMIT 201',user.userId,before,before,tradeId)).all()).results as any[];
    const trades=rows.slice(0,200),last=trades.at(-1);return json({trades,nextCursor:rows.length>200?`${last.created}:${last.id}`:null});
   }
   if(path.length===1&&req.method==='POST'){
    const id=str(body.requestId,36,36),symbol=str(body.symbol,1,80),side=body.side,amount=body.amountCents,expected=body.priceMicros;
    if(!/^[0-9a-f-]{36}$/.test(id)||!['yes','no'].includes(String(side)))throw new Problem(400,'Invalid demo order.');
    if(typeof amount!=='number'||typeof expected!=='number')throw new Problem(400,'Choose an amount and outcome.');
    const previous=await q('SELECT * FROM demo_trades WHERE id=?',id).first<any>();
    if(previous){if(previous.user_id!==user.userId||previous.symbol!==symbol||previous.side!==side||previous.amount_cents!==amount)throw new Problem(409,'Request conflict.');return json({trade:previous})}
    let market;try{market=(await marketData()).markets.find(m=>m.id===symbol)}catch{market=browserDemoQuote(body.demoQuote,symbol)||undefined;if(!market)throw new Problem(503,'Refresh this game’s quote before placing a demo trade.');}
    if(!market)throw new Problem(400,'This market is no longer available.');
    const asking=side==='yes'?market.yesAsk:market.noAsk;
    if(asking===null||asking<=0)throw new Problem(400,'No quote is available on this side.');
    const priceMicros=Math.round(asking*1000000);
    if(priceMicros!==expected)throw new Problem(409,'The quote changed. Refresh this market and review again.');
    let fill;try{fill=simulateBuy(amount,priceMicros)}catch(e){throw new Problem(400,(e as Error).message)}
    const trade={id,user_id:user.userId,symbol,event:market.event,title:market.title,opposite:market.opposite,side,amount_cents:amount,price_micros:priceMicros,contracts:fill.contracts,cost_cents:fill.costCents,created:now};
    await q('INSERT INTO demo_trades(id,user_id,symbol,event,title,opposite,side,amount_cents,price_micros,contracts,cost_cents,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',id,user.userId,symbol,market.event,market.title,market.opposite,side,amount,priceMicros,fill.contracts,fill.costCents,now).run();
    return json({trade},201);
   }
   if(path[1]&&path[2]==='share'&&req.method==='POST'){
    const trade=await q('SELECT * FROM demo_trades WHERE id=? AND user_id=?',path[1],user.userId).first<any>();
    if(!trade)throw new Problem(404,'Demo trade not found.');
    if(!Array.isArray(body.groupIds)||!body.groupIds.length||body.groupIds.length>10||body.groupIds.some(id=>typeof id!=='string'))throw new Problem(400,'Choose one to ten groups.');
    const ids=[...new Set(body.groupIds)] as string[],note=body.note?str(body.note,1,500):'';
    for(const id of ids)if(!await q('SELECT 1 FROM members WHERE group_id=? AND user_id=?',id,user.userId).first())throw new Problem(404,'Join each group before sharing.');
    const statements=[];
    for(const id of ids){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(trade.id+':'+id)));const hex=Array.from(bytes.slice(0,16)).map(n=>n.toString(16).padStart(2,'0')).join('');const proposalId=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
     statements.push(q('INSERT OR IGNORE INTO proposals(id,group_id,author,symbol,event,title,opposite,side,note,created,trade_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)',proposalId,id,user.userId,trade.symbol,trade.event,trade.title,trade.opposite,trade.side,note,now,trade.id));
    }
    await db.batch(statements);return json({groupIds:ids});
   }
  }
  if(path[0]==='profile'&&req.method==='POST'){
   const display=str(body.name,1,60);
   await q('INSERT INTO profiles(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',user.userId,display).run();return json({name:display});
  }
  if(path[0]==='groups'&&path.length===1){
   if(req.method==='GET')return json({groups:(await q(`SELECT g.id,g.name,g.owner,g.created,(SELECT count(*) FROM members WHERE group_id=g.id) as memberCount,(SELECT count(*) FROM proposals WHERE group_id=g.id) as proposalCount FROM groups g JOIN members m ON m.group_id=g.id WHERE m.user_id=? ORDER BY g.created DESC`,user.userId).all()).results});
   const count=await q('SELECT count(*) as n FROM members WHERE user_id=?',user.userId).first<{n:number}>();
   if((count?.n||0)>=50)throw new Problem(400,'You can join up to 50 groups.');
   const id=crypto.randomUUID(),invite=crypto.randomUUID()+crypto.randomUUID();
   await db.batch([q('INSERT INTO groups(id,name,owner,invite,created) VALUES(?,?,?,?,?)',id,str(body.name,1,60),user.userId,invite,now),q('INSERT INTO members(group_id,user_id,joined) VALUES(?,?,?)',id,user.userId,now)]);return json({id},201);
  }
  if(path[0]==='invites'){
   const group=await q('SELECT id,name FROM groups WHERE invite=?',path[1]||'').first<{id:string;name:string}>();
   if(!group)throw new Problem(404,'This invite is invalid or no longer available.');
   if(req.method==='GET')return json({name:group.name});
   const count=await q('SELECT count(*) as n FROM members WHERE user_id=?',user.userId).first<{n:number}>();
   const exists=await q('SELECT 1 FROM members WHERE group_id=? AND user_id=?',group.id,user.userId).first();
   if(!exists&&(count?.n||0)>=50)throw new Problem(400,'You can join up to 50 groups.');
   await q('INSERT OR IGNORE INTO members(group_id,user_id,joined) VALUES(?,?,?)',group.id,user.userId,now).run();return json({id:group.id});
  }
  if(path[0]==='groups'&&path[1]){
   const id=path[1];
   const group=await q('SELECT g.id,g.name,g.owner,g.invite FROM groups g JOIN members m ON m.group_id=g.id WHERE g.id=? AND m.user_id=?',id,user.userId).first();
   if(!group)throw new Problem(404,'Group not found. Join with an invite first.');
   if(path.length===2&&req.method==='GET'){
    const members=(await q(`SELECT m.user_id as id,COALESCE(p.name,'Member') as name FROM members m LEFT JOIN profiles p ON p.id=m.user_id WHERE m.group_id=? ORDER BY m.joined`,id).all()).results;
    const proposals=(await q(`SELECT p.*,t.contracts as tradeContracts,t.cost_cents as tradeCost,t.price_micros as tradePrice,t.created as tradeCreated,COALESCE(u.name,'Member') as authorName,(SELECT count(*) FROM responses WHERE proposal_id=p.id AND stance='tail') as tails,(SELECT count(*) FROM responses WHERE proposal_id=p.id AND stance='fade') as fades,(SELECT stance FROM responses WHERE proposal_id=p.id AND user_id=?) as myStance FROM proposals p LEFT JOIN demo_trades t ON t.id=p.trade_id LEFT JOIN profiles u ON u.id=p.author WHERE p.group_id=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.user_id=? AND b.blocked_id=p.author) ORDER BY p.created DESC LIMIT 100`,user.userId,id,user.userId).all()).results;
    const messages=(await q(`SELECT c.*,COALESCE(p.name,'Member') as authorName FROM chat_messages c LEFT JOIN profiles p ON p.id=c.author WHERE c.group_id=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.user_id=? AND b.blocked_id=c.author) ORDER BY c.created DESC LIMIT 100`,id,user.userId).all()).results;
    const reactions=(await q(`SELECT r.target_id,r.emoji,count(*) as count,max(CASE WHEN r.user_id=? THEN 1 ELSE 0 END) as mine FROM chat_reactions r WHERE r.group_id=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.user_id=? AND b.blocked_id=r.user_id) GROUP BY r.target_id,r.emoji`,user.userId,id,user.userId).all()).results;
    return json({group,members,proposals,messages,reactions});
   }
   if(path[2]==='messages'&&req.method==='POST'){
    const messageId=str(body.requestId,36,36),text=str(body.text,1,2000);
    if(!/^[0-9a-f-]{36}$/.test(messageId))throw new Problem(400,'Invalid message ID.');
    const existing=await q('SELECT group_id,author FROM chat_messages WHERE id=?',messageId).first<{group_id:string;author:string}>();
    if(existing){if(existing.group_id!==id||existing.author!==user.userId)throw new Problem(409,'Message conflict.');return json({id:messageId});}
    const recent=await q('SELECT count(*) as n FROM chat_messages WHERE author=? AND created>?',user.userId,now-60000).first<{n:number}>();
    if((recent?.n||0)>=30)throw new Problem(429,'Please wait before sending more messages.');
    await q('INSERT INTO chat_messages(id,group_id,author,body,created) VALUES(?,?,?,?,?)',messageId,id,user.userId,text,now).run();return json({id:messageId},201);
   }
   if(path[2]==='reactions'&&req.method==='POST'){
    const target=str(body.targetId,1,80),emoji=str(body.emoji,1,8);
    if(!['👍','❤️','😂','🔥','👀','👎'].includes(emoji)||typeof body.active!=='boolean')throw new Problem(400,'Choose a reaction.');
    const visible=await q(`SELECT author FROM chat_messages WHERE id=? AND group_id=? UNION ALL SELECT author FROM proposals WHERE id=? AND group_id=?`,target,id,target,id).first<{author:string}>();
    if(!visible||await q('SELECT 1 FROM blocks WHERE user_id=? AND blocked_id=?',user.userId,visible.author).first())throw new Problem(404,'Message not found.');
    if(body.active)await q('INSERT OR IGNORE INTO chat_reactions(group_id,target_id,user_id,emoji,created) VALUES(?,?,?,?,?)',id,target,user.userId,emoji,now).run();
    else await q('DELETE FROM chat_reactions WHERE group_id=? AND target_id=? AND user_id=? AND emoji=?',id,target,user.userId,emoji).run();
    return json({ok:true});
   }
   if(path[2]==='proposals'&&req.method==='POST'){
    const symbol=str(body.symbol,1,80),side=body.side;
    if(side!=='yes'&&side!=='no')throw new Problem(400,'Choose an outcome.');
    const requestId=str(body.requestId,36,36);
    if(!/^[0-9a-f-]{36}$/.test(requestId))throw new Problem(400,'Invalid request ID.');
    const previous=await q('SELECT group_id,author FROM proposals WHERE id=?',requestId).first<{group_id:string;author:string}>();
    if(previous){if(previous.group_id!==id||previous.author!==user.userId)throw new Problem(409,'Request conflict.');return json({id:requestId})}
    const recent=await q('SELECT count(*) as n FROM proposals WHERE author=? AND created>?',user.userId,now-60000).first<{n:number}>();
    if((recent?.n||0)>=15)throw new Problem(429,'Please wait before sharing another idea.');
    const market=(await marketData()).markets.find(m=>m.id===symbol);
    if(!market)throw new Problem(400,'This market is no longer available.');
    const note=body.note?str(body.note,1,500):'';
    await q('INSERT INTO proposals(id,group_id,author,symbol,event,title,opposite,side,note,created) VALUES(?,?,?,?,?,?,?,?,?,?)',requestId,id,user.userId,symbol,market.event,market.title,market.opposite,side,note,now).run();return json({id:requestId},201);
   }
   if(path[2]==='responses'&&req.method==='POST'){
    const proposal=str(body.proposalId,1,64),stance=body.stance;
    if(!['tail','fade','none'].includes(String(stance)))throw new Problem(400,'Choose tail or fade.');
    if(!await q('SELECT 1 FROM proposals WHERE id=? AND group_id=?',proposal,id).first())throw new Problem(404,'Proposal not found.');
    if(stance==='none')await q('DELETE FROM responses WHERE proposal_id=? AND user_id=?',proposal,user.userId).run();
    else await q('INSERT INTO responses(proposal_id,user_id,stance,created) VALUES(?,?,?,?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET stance=excluded.stance,created=excluded.created',proposal,user.userId,stance,now).run();
    return json({ok:true});
   }
  }
  throw new Problem(404,'Not found.');
 }catch(e){if(e instanceof Problem||e instanceof MobileAuthError)return json({error:e.message},e.status);if(e instanceof Error&&e.message.startsWith('Pascal’s market feed'))return json({error:e.message},503);if(e instanceof SyntaxError)return json({error:'Invalid request.'},400);console.error('API error',e instanceof Error?e.message:'Unknown');return json({error:'Something went wrong. Please try again.'},503)}
}
export const GET=handler;export const POST=handler;
