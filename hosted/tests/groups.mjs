import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5190';
const suffix=crypto.randomUUID();
// Tests create isolated demo sessions. Forged identity headers must be ignored.
const alice='test-alice-'+suffix,bob='test-bob-'+suffix,outsider='test-outsider-'+suffix;
const sessions=new Map();
async function request(path,user,body,status=200,extra={}){
 const headers={...extra};if(user&&sessions.has(user))headers.Cookie=sessions.get(user);
 if(body!==undefined){headers.Origin=origin;headers['Content-Type']='application/json'}
 const r=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
 if(path==='demo-session'&&r.ok&&user)sessions.set(user,r.headers.get('Set-Cookie').split(';')[0]);
 const text=await r.text();assert.equal(r.status,status,path+': '+text.slice(0,300));return JSON.parse(text);
}
assert.equal((await request('me')).user,null);
await request('groups',null,undefined,401);
await request('demo-session',alice,{method:'email',name:'Alice',email:'alice@example.test'});
assert.equal((await request('me',alice)).user.name,'Alice');
await request('demo-session',bob,{method:'wallet',name:'Bob',address:'11111111111111111111111111111111'});
await request('demo-session',outsider,{method:'email',name:'Outsider',email:'alice@example.test'});
assert.notEqual((await request('me',alice)).user.id,(await request('me',outsider)).user.id);
await request('demo-session',null,{method:'email',name:'Bad',email:'invalid'},400);
await request('demo-session',null,{method:'wallet',name:'Bad',address:'bad'},400);
assert.equal((await request('me',null,undefined,200,{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.test'})).user,null);
await request('profile',bob,{name:'Bob'});
const {id}=await request('groups',alice,{name:'Integration test '+suffix},201);
const created=await request('groups/'+id,alice);
assert.equal(created.members.length,1);
assert.equal(created.members[0].name,'Alice');
await request('groups/'+id,bob,undefined,404);
await request('groups/'+id,outsider,undefined,404);
await request('groups/'+id+'/responses',outsider,{proposalId:'fake',stance:'tail'},404);
assert.equal((await request('invites/'+created.group.invite,bob)).name,created.group.name);
await request('invites/not-valid',bob,undefined,404);
await request('invites/'+created.group.invite,bob,{});
await request('invites/'+created.group.invite,bob,{});
assert.equal((await request('groups/'+id,alice)).members.length,2);
assert.equal((await request('groups',bob)).groups[0].id,id);
const data=await request('markets');assert(data.markets.length>0);
assert(data.markets.every(m=>m.tags.includes('NCAA Football')));
const market=data.markets.find(m=>m.tags.includes('NCAA Football'));assert(market);
await request('market-detail?symbol='+encodeURIComponent(market.id)+'&range=bad',null,undefined,400);
await request('market-detail?symbol=NFL_TEST.WIN&range=1D',null,undefined,404);
for(const range of ['1H','1D','1W','ALL']){
 const detail=await request('market-detail?'+new URLSearchParams({symbol:market.id,range}));
 assert.equal(detail.market.id,market.id);assert.equal(detail.range,range);
 assert(Array.isArray(detail.candles),'price history should respond');
 assert(Array.isArray(detail.trades),'trade history should respond');
 assert(detail.book,'order book should respond');
 assert(detail.candles.every((c,i,all)=>c.time>=detail.start&&c.time<detail.end&&c.close>=0&&c.close<=1&&(!i||c.time>all[i-1].time)));
}

// Demo trade -> optional multi-group share. No posts exist before sharing.
const group2=await request('groups',alice,{name:'Second test group '+suffix},201);
const group2View=await request('groups/'+group2.id,alice);
await request('invites/'+group2View.group.invite,bob,{});
const quoted=data.markets.find(m=>m.yesAsk>0);assert(quoted);
const order={symbol:quoted.id,side:'yes',amountCents:1000,priceMicros:Math.round(quoted.yesAsk*1000000),requestId:crypto.randomUUID()};
await request('demo-trades',null,order,401);
await request('demo-trades',alice,{...order,priceMicros:order.priceMicros+1},409);
await request('demo-trades',alice,{...order,amountCents:0},400);
const placed=await request('demo-trades',alice,order,201);
assert(placed.trade.cost_cents<=1000);assert(placed.trade.contracts>0);
assert.equal((await request('demo-trades',alice,order)).trade.id,placed.trade.id);
assert.equal((await request('demo-trades',alice)).trades.length,1);
assert.equal((await request('demo-trades',bob)).trades.length,0);
assert.equal((await request('groups/'+id,bob)).proposals.length,0);
await request('demo-trades/'+placed.trade.id+'/share',bob,{groupIds:[id]},404);
await request('demo-trades/'+placed.trade.id+'/share',alice,{groupIds:[]},400);
await request('demo-trades/'+placed.trade.id+'/share',alice,{groupIds:[id,'not-a-member']},404);
assert.equal((await request('groups/'+id,bob)).proposals.length,0);
await request('demo-trades/'+placed.trade.id+'/share',alice,{groupIds:[id,group2.id],note:'My demo play'});
await request('demo-trades/'+placed.trade.id+'/share',alice,{groupIds:[id,group2.id],note:'My demo play'});
for(const groupId of [id,group2.id]){const view=await request('groups/'+groupId,bob);assert.equal(view.proposals.length,1);assert.equal(view.proposals[0].trade_id,placed.trade.id);assert.equal(view.proposals[0].tradeContracts,placed.trade.contracts)}
const requestId=crypto.randomUUID();
const proposal={symbol:market.id,side:'yes',note:'A shared idea from Alice',requestId};
await request('groups/'+id+'/proposals',alice,proposal,201);
await request('groups/'+id+'/proposals',alice,proposal);
let view=await request('groups/'+id,bob);
assert((await request('market-responses?symbol='+encodeURIComponent(market.id),bob)).ideas.length>=1);
assert.equal((await request('market-responses?symbol='+encodeURIComponent(market.id),outsider)).ideas.length,0);
assert.equal(view.proposals.length,2);const idea=view.proposals.find(p=>p.id===requestId);assert.equal(idea.note,proposal.note);assert.equal(idea.authorName,'Alice');
await request('groups/'+id+'/responses',bob,{proposalId:requestId,stance:'tail'});
await request('groups/'+id+'/responses',bob,{proposalId:requestId,stance:'tail'});
view=await request('groups/'+id,alice);assert.equal(view.proposals.find(p=>p.id===requestId).tails,1);
await request('groups/'+id+'/responses',bob,{proposalId:requestId,stance:'fade'});
view=await request('groups/'+id,alice);assert.equal(view.proposals.find(p=>p.id===requestId).tails,0);assert.equal(view.proposals.find(p=>p.id===requestId).fades,1);
await request('groups/'+id+'/responses',bob,{proposalId:requestId,stance:'none'});
assert.equal((await request('groups/'+id,alice)).proposals.find(p=>p.id===requestId).fades,0);
await request('groups/'+id+'/proposals',outsider,{...proposal,requestId:crypto.randomUUID()},404);
await request('groups/'+id+'/proposals',alice,{...proposal,side:'invalid',requestId:crypto.randomUUID()},400);
const badOrigin=await fetch(origin+'/api/groups',{method:'POST',headers:{'oai-authenticated-user-id':alice,'oai-authenticated-user-email':'test@example.test',Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify({name:'bad'})});assert.equal(badOrigin.status,403);
await request('demo-signout',bob,{});
assert.equal((await request('me',bob)).user,null);
await request('groups/'+id,bob,undefined,401);
console.log('PASS: persistent demo trades, valid quote checks, duplicate trade prevention, no automatic sharing, multi-group post-trade shares, unauthorized shares denied, atomic membership checks, retry-safe shares, college-football-only catalog, four chart ranges, real history/trades/book, private market ideas, demo email and wallet sessions, same-email isolation, invalid identities rejected, revoked session denied, anonymous rejection, member access, invite join, repeat join, persistence across users, live Pascal market share, idempotent proposal/response, stance change/removal, nonmember write denial, invalid input and cross-origin rejection.');
