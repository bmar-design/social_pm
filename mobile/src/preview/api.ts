import type { Api } from '../api';
import type { Market } from '../../../hosted/lib/market-model';
import { simulateBuy } from '../../../hosted/lib/game-model';
// These fictional fixtures never call a backend, Privy, or a trading provider.
const now = Date.now();
const makeMarket = (id: string, home: string, away: string, price: number, offset: number): Market => ({
  id, gameId: id, home, away, title: home, opposite: away, event: 'College football · Sample matchup',
  tags: ['NCAA Football'], price, yesAsk: price + .01, noAsk: 1 - price + .01, rulesUrl: null,
  game: `${away} at ${home}`, kind: 'moneyline', startsAt: now + offset * 3600000,
  listedAt: now, volume24h: 24000, trades24h: 120, change24h: .02,
});
const markets = [makeMarket('SAMPLE-MICH', 'Michigan', 'Michigan State', .62, 5), makeMarket('SAMPLE-OSU', 'Ohio State', 'Penn State', .55, 7), makeMarket('SAMPLE-TEX', 'Texas', 'Georgia', .46, 9)].flatMap(m=>[
  m,
  {...m,id:m.id+'-SPREAD',kind:'spread',title:`${m.home} -6.5`,opposite:`${m.away} +6.5`,price:.51,yesAsk:.52,noAsk:.50},
  {...m,id:m.id+'-TOTAL',kind:'total_points',title:'Over 45.5',opposite:'Under 45.5',price:.48,yesAsk:.49,noAsk:.53},
]);
const invite = '12345678-1234-1234-1234-123456789abc'.repeat(2);
let name = 'Brian';
const groups = [{ id: 'oakland', name: '928 Oakland', owner: 'preview-brian', created: now, memberCount: 6, proposalCount: 2, invite }, { id: 'saturdays', name: 'Saturday people', owner:'preview-alex', created:now, memberCount:4, proposalCount:1, invite:'abcdef12-1234-1234-1234-123456789abc'.repeat(2) }];
let proposals: any[] = [
  {id:'post-alex',trade_id:'sample-alex-buy',tradeContracts:20,tradeCost:1260,tradePrice:630000,tradeCreated:now-1800000,group_id:'oakland',author:'preview-alex',authorName:'Alex',symbol:markets[0].id,event:markets[0].event,title:'Michigan',opposite:'Michigan State',side:'yes',note:'Taking the home team. Who’s with me?',created:now-1800000,tails:3,fades:1,myStance:null},
  {id:'post-jamie',trade_id:'sample-jamie-buy',tradeContracts:12,tradeCost:552,tradePrice:460000,tradeCreated:now-3600000,group_id:'oakland',author:'preview-jamie',authorName:'Jamie',symbol:'SAMPLE-OSU',event:markets[0].event,title:'Ohio State',opposite:'Penn State',side:'no',note:'I like Penn State in this one.',created:now-3600000,tails:2,fades:2,myStance:null},
];
const trades: any[] = [{id:'sample-buy',user_id:'preview-brian',symbol:markets[0].id,title:'Michigan',opposite:'Michigan State',side:'yes',contracts:15,cost_cents:945,created:now-7200000}];
// Additional fictional fills exercise multi-entry positions and history filters.
trades.push(...[
 {id:'sample-mich-earlier',symbol:'SAMPLE-MICH',title:'Michigan',opposite:'Michigan State',side:'yes',contracts:20,cost_cents:1120,created:now-3*86400000},
 {id:'sample-osu',symbol:'SAMPLE-OSU',title:'Ohio State',opposite:'Penn State',side:'no',contracts:30,cost_cents:1200,created:now-5*86400000},
 {id:'sample-tex',symbol:'SAMPLE-TEX',title:'Texas',opposite:'Georgia',side:'yes',contracts:25,cost_cents:1275,created:now-12*86400000},
 {id:'sample-mich-no',symbol:'SAMPLE-MICH',title:'Michigan',opposite:'Michigan State',side:'no',contracts:10,cost_cents:350,created:now-35*86400000},
].map(t=>({...t,user_id:'preview-brian'})));
let blocked: string[] = [];
const messages:any[]=[{id:'hello-alex',group_id:'oakland',author:'preview-alex',authorName:'Alex',body:'Who’s watching the game Saturday? 🏈',created:now-4000000},{id:'hello-brian',group_id:'oakland',author:'preview-brian',authorName:'Brian',body:'I’m in! What’s everyone picking?',created:now-3900000}];
let reactions:any[]=[];
export const previewApi: Api = async <T,>(path: string, raw?: unknown): Promise<T> => {
  const body = (raw || {}) as any;
  const [route, query] = path.split('?'), parts = route.split('/');
  let result: unknown;
  if (route === 'markets') result = { markets, fetchedAt: Date.now() };
  else if (route === 'me') result = { user: { id:'preview-brian', name }, needsName:false };
  else if (route === 'profile') { name = body.name; result = {name}; }
  else if (route === 'market-detail') {
    const params=new URLSearchParams(query),market=markets.find(m=>m.id===params.get('symbol'))||markets[0],range=params.get('range')||'1D';
    const duration=range==='1H'?3600000:range==='1W'?604800000:range==='ALL'?2592000000:86400000;
    const end=Date.now(),start=end-duration;
    // Deterministic illustration, never substituted for missing live history.
    const count=range==='1H'?60:range==='1W'?168:range==='ALL'?30:288;
    const candles=Array.from({length:count+1},(_,i)=>({time:start+i*duration/count,close:Math.max(.05,Math.min(.95,(market.price||.5)+(Math.sin(i*.55)*.025+Math.cos(i*.21)*.02)*(1-i/count)-.09*(1-i/count)))}));
    result={market,candles,range,start,end,fetchedAt:end};
  }
  else if (route === 'groups') {
    if (raw !== undefined) { const id = `sample-${Date.now()}`; if(!body.name?.trim()||body.name.trim().length>60)throw Error('Enter a group name (1–60 characters).');groups.push({id,name:body.name.trim(),owner:'preview-brian',created:Date.now(),memberCount:1,proposalCount:0,invite:Array.from({length:72},()=>Math.floor(Math.random()*16).toString(16)).join('')}); result={id}; }
    else result = {groups};
  } else if (parts[0] === 'groups' && parts[1]) {
    if(parts[2]==='messages'){if(!body.text?.trim())throw Error('Enter a message.');if(!messages.some(m=>m.id===body.requestId))messages.push({id:body.requestId,group_id:parts[1],author:'preview-brian',authorName:name,body:body.text.trim(),created:Date.now()});result={id:body.requestId};}
    else if(parts[2]==='reactions'){reactions=reactions.filter(r=>!(r.group_id===parts[1]&&r.target_id===body.targetId&&r.emoji===body.emoji));if(body.active)reactions.push({group_id:parts[1],target_id:body.targetId,emoji:body.emoji,count:1,mine:1});result={ok:true};}
    else if(parts[2]==='proposals') {const market=markets.find(m=>m.id===body.symbol);if(!market)throw Error('Market unavailable.');if(!proposals.some(p=>p.id===body.requestId))proposals.push({id:body.requestId,group_id:parts[1],author:'preview-brian',authorName:name,symbol:market.id,title:market.title,opposite:market.opposite,side:body.side,note:body.note,created:Date.now(),tails:0,fades:0,myStance:null});const group=groups.find(g=>g.id===parts[1]);if(group)group.proposalCount=proposals.filter(p=>p.group_id===group.id).length;result={id:body.requestId};}
    else if (parts[2] === 'responses') { const post=proposals.find(p=>p.id===body.proposalId); if(post){if(post.myStance)post[post.myStance==='tail'?'tails':'fades']--;post.myStance=body.stance==='none'?null:body.stance;if(post.myStance)post[post.myStance==='tail'?'tails':'fades']++;}result={ok:true}; }
    else result = {group:groups.find(g=>g.id===parts[1])||groups[0],members:groups.find(g=>g.id===parts[1])?.memberCount===1?[{id:'preview-brian',name}]:[{id:'preview-brian',name},{id:'preview-alex',name:'Alex'},{id:'preview-jamie',name:'Jamie'}],messages:messages.filter(m=>m.group_id===parts[1]&&!blocked.includes(m.author)),reactions:reactions.filter(r=>r.group_id===parts[1]),proposals:proposals.filter(p=>p.group_id===parts[1]&&!blocked.includes(p.author))};
  } else if (route === 'demo-trades') {
    if (raw !== undefined) {
      let trade=trades.find(t=>t.id===body.requestId);
      if(!trade){const market=markets.find(m=>m.id===body.symbol)||markets[0],fill=simulateBuy(body.amountCents,body.priceMicros);trade={id:body.requestId,user_id:'preview-brian',symbol:market.id,title:market.title,opposite:market.opposite,side:body.side,contracts:fill.contracts,cost_cents:fill.costCents,created:Date.now()};trades.unshift(trade);}
      result={trade};
    } else result={trades};
  } else if(parts[0]==='demo-trades'&&parts[2]==='share') {
    const trade=trades.find(t=>t.id===parts[1]);
    for(const id of body.groupIds){const postId=`${trade.id}:${id}`;if(!proposals.some(p=>p.id===postId))proposals.unshift({...trade,trade_id:trade.id,tradeContracts:trade.contracts,tradeCost:trade.cost_cents,tradePrice:Math.round(trade.cost_cents/trade.contracts*10000),tradeCreated:trade.created,id:postId,group_id:id,author:'preview-brian',authorName:name,note:body.note,tails:0,fades:0,myStance:null});}result={ok:true};
  } else if(parts[0]==='invites') {const group=groups.find(g=>g.invite===parts[1]);if(!group)throw Error('This invite is invalid or no longer available.');result=raw===undefined?{name:group.name}:{id:group.id};}
  else if(route==='blocks') {if(raw!==undefined)blocked=body.remove?blocked.filter(id=>id!==body.userId):[...new Set([...blocked,body.userId])];result={blocks:blocked.map(id=>({id,name:id==='preview-alex'?'Alex':'Jamie'}))};}
  else if(route==='reports')result={ok:true};
  else if(route==='account/delete') {const removed=new Set([...messages.filter(m=>m.author==='preview-brian').map(m=>m.id),...proposals.filter(p=>p.author==='preview-brian').map(p=>p.id)]);for(let i=messages.length-1;i>=0;i--)if(messages[i].author==='preview-brian')messages.splice(i,1);reactions=reactions.filter(r=>!r.mine&&!removed.has(r.target_id));proposals=proposals.filter(p=>p.author!=='preview-brian');trades.length=0;result={ok:true};}
  else throw Error('This screen is not connected in the UI preview.');
  return structuredClone(result) as T;
};
