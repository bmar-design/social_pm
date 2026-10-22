import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ed25519} from '@noble/curves/ed25519';
import {base58} from '@scure/base';
import {ownerMessage,orderMessage,signedOrder,builderConfig,micros,decimal,feeUpperBound,request,PascalError} from '../src/pascal.ts';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/pascal-vectors.json',import.meta.url),'utf8')).vectors;
const owner='GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB',signer='2KW2XRd9kwqet15Aha2oK3tYvd3nWbTFH1MBiRAv1BE1';
const auth={owner,signer,recv_window_ms:'5000',client_ts_ms:'1731536000000'};
const order={client_order_id:'42',symbol:'SIM_EVENT_1.MARKET_1',side:'BID' as const,price:'0.550000',size:'10',tif:'IOC' as const};
for(const vector of fixtures.filter((v:any)=>v.message_utf8)){
 test(`matches official ${vector.permit} message and signature`,()=>{
  const values=JSON.parse(vector.message_utf8),a={...auth,signer:owner};
  const referral=values[0]==='register_deposit_address';
  const message=ownerMessage(values[0],referral?[owner]:values.slice(1,-6),a,referral?values.at(-1):undefined);
  assert.equal(message,vector.message_utf8);
  assert.equal(base58.encode(ed25519.sign(new TextEncoder().encode(message),new Uint8Array(32).fill(7))),vector.signature);
 });
}
test('IOC permit matches official binary layout with only intentional order field changes',()=>{
 const vector=fixtures.find((v:any)=>v.permit==='PlaceOrderPermit');
 const expected=Uint8Array.from(Buffer.from(vector.message_hex,'hex')),view=new DataView(expected.buffer);
 view.setBigUint64(104,18446744073709551615n,true);view.setBigUint64(112,0n,true);expected[223]=2;expected[224]=0;
 assert.deepEqual(orderMessage(order,auth),expected);
 const signed=signedOrder(order,auth,new Uint8Array(32).fill(8));
 assert.ok(ed25519.verify(base58.decode(signed.auth.signature),expected,base58.decode(signer)));
});
test('builder settings enforce cap and refuse unverified fee signing',()=>{
 const builder=builderConfig(owner,'0.010000');assert.equal(builder?.builder_fee_rate,'0.010000');
 assert.throws(()=>builderConfig(owner,'0.100001'));assert.throws(()=>builderConfig(owner));
 assert.throws(()=>orderMessage({...order,builder_info:builder},auth),/builder permit encoding/);
});
test('decimal arithmetic and fee reserve never use floating point',()=>{
 assert.equal(micros('12345678901234567890.123456'),12345678901234567890123456n);
 assert.equal(decimal(micros('0.000001')),'0.000001');
 assert.equal(feeUpperBound(1n,'0.010001'),2501n);
 for(const bad of ['-1','1e2','NaN','0.0000001'])assert.throws(()=>micros(bad));
});
test('No buy maps to ASK at complementary Yes price',()=>{
 const bytes=orderMessage({...order,side:'ASK',price:decimal(1000000n-micros('0.300000'))},auth);
 assert.equal(new DataView(bytes.buffer).getBigUint64(88,true),700000n);assert.equal(bytes[221],1);
});
test('reject malformed prices, quantities, identifiers, keys and symbols',()=>{
 for(const change of [{price:'0'},{price:'1'},{size:'0'},{client_order_id:'18446744073709551615'},{symbol:'a'.repeat(33)}])assert.throws(()=>orderMessage({...order,...change},auth));
 assert.throws(()=>ownerMessage('revoke_trading_key',[signer],auth),/Owner signature/);
});
test('transport preserves restriction errors and never retries ambiguous submissions',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw Error('timeout');};
  await assert.rejects(request('orders',[]),(e:any)=>e instanceof PascalError&&e.code==='UNKNOWN');assert.equal(calls,1);
  globalThis.fetch=async()=>new Response(JSON.stringify({status:'error',data:{code:'GEO_RESTRICTED',message:'Restricted'}}),{status:403});
  await assert.rejects(request('orders',[]),(e:any)=>e.code==='GEO_RESTRICTED');
  globalThis.fetch=async()=>new Response(JSON.stringify([{status:'success',data:{order:{client_order_id:'42'},fills:[]}}]));
  assert.equal((await request('orders',[]))[0].order.client_order_id,'42');
 }finally{globalThis.fetch=original;}
});
