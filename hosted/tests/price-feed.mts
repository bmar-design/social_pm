import assert from 'node:assert/strict';
import {test} from 'node:test';
import {marketData} from '../lib/markets.ts';

test('concurrent catalog requests share work and recover after provider failure', async () => {
 const originalFetch=globalThis.fetch;
 let requests=0;
 globalThis.fetch=async()=>{
  requests++;
  await new Promise(resolve=>setTimeout(resolve,10));
  if(requests===1)return new Response('{}',{status:503});
  return Response.json({status:'success',data:[null,{symbol:'CFB.TEST',display_attributes:{tags:['NCAA Football']},mark_price:'0.6',best_bid:'0.58',best_ask:'0.62'},{symbol:'OTHER',display_attributes:{tags:['NFL']}}]});
 };
 try {
  const failed=await Promise.allSettled([marketData(),marketData()]);
  assert(failed.every(r=>r.status==='rejected'));
  assert.equal(requests,1);
  const [first,second]=await Promise.all([marketData(),marketData()]);
  assert.equal(requests,2);
  assert.equal(first,second);
  assert.equal(first.markets.length,1);
  assert.equal(first.markets[0].yesAsk,.62);
  assert.equal(first.markets[0].price,.6);
  assert.equal(await marketData(),first);
  assert.equal(requests,2);
 } finally {globalThis.fetch=originalFetch;}
});
