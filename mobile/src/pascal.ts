import {ed25519} from '@noble/curves/ed25519';
import {base58} from '@scure/base';

// Production protocol: https://docs.pascal.trade/llms/request-signing.txt
export const READ='https://data.pascal.trade/api/v1';
export const WRITE='https://trade.pascal.trade/api/v1';
export type Auth={owner:string;signer:string;client_ts_ms:string;recv_window_ms:string};
export type Builder={builder_pubkey:string;builder_fee_rate:string};
export const utf8=(s:string)=>new TextEncoder().encode(s);
export function publicKey(value:string){const bytes=base58.decode(value);if(bytes.length!==32)throw Error('Expected a Solana public key.');return bytes;}
export function micros(value:string):bigint {
 if(!/^\d+(\.\d{1,6})?$/.test(value))throw Error('Use a positive decimal with at most six decimal places.');
 const [whole,fraction='']=value.split('.');return BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));
}
export function decimal(value:bigint){return `${value/1000000n}.${(value%1000000n).toString().padStart(6,'0')}`;}
function integer(value:string){if(!/^\d+$/.test(value)||BigInt(value)>18446744073709551615n)throw Error('Invalid unsigned integer.');return BigInt(value);}
function validateAuth(a:Auth){publicKey(a.owner);publicKey(a.signer);integer(a.client_ts_ms);const window=integer(a.recv_window_ms);if(window<1n||window>60000n)throw Error('Invalid signing window.');}
export function ownerMessage(command:'create_trading_key'|'revoke_trading_key'|'register_deposit_address',args:unknown[],auth:Auth,referralCode?:string){
 validateAuth(auth);if(auth.owner!==auth.signer)throw Error('Owner signature required.');
 if(!Number.isSafeInteger(Number(auth.client_ts_ms)))throw Error('Invalid timestamp.');
 if(command==='create_trading_key'){
  if(args.length!==3||typeof args[0]!=='string'||utf8(args[0]).length<1||utf8(args[0]).length>16||typeof args[1]!=='string'||!Number.isSafeInteger(args[2])||Number(args[2])<=Number(auth.client_ts_ms))throw Error('Invalid trading key authorization.');
  publicKey(args[1]);
 }else if(command==='revoke_trading_key'){
  if(args.length!==1||typeof args[0]!=='string')throw Error('Invalid trading key revocation.');publicKey(args[0]);
 }else if(command==='register_deposit_address'){
  if(args.length!==1||args[0]!==auth.owner)throw Error('Deposit owner must match signer.');
 }else throw Error('Unsupported wallet operation.');
 const fields=[command,...args,1,3,Number(auth.recv_window_ms),Number(auth.client_ts_ms),auth.owner,auth.signer];
 if(referralCode!==undefined){if(command!=='register_deposit_address'||!referralCode.length||referralCode.length>80)throw Error('Invalid referral code.');fields.push('referral_code',referralCode);}
 return JSON.stringify(fields);
}
export function builderConfig(key?:string,rate?:string):Builder|undefined {
 if(!key&&!rate)return;
 if(!key||!rate)throw Error('Configure both the builder wallet and fee rate.');
 publicKey(key);if(micros(rate)>100000n)throw Error('Pascal caps builder fee rates at 10%.');
 return {builder_pubkey:key,builder_fee_rate:decimal(micros(rate))};
}
export type Order={client_order_id:string;symbol:string;side:'BID'|'ASK';price:string;size:string;tif:'IOC';reduce_only?:boolean;builder_info?:Builder};
export function orderMessage(order:Order,auth:Auth):Uint8Array {
 validateAuth(auth);
 // The public signing spec and official quickstart omit builder encoding.
 // Never attach an unsigned fee or guess at reserved byte meanings.
 if(order.builder_info)throw Error('Builder order signing is unavailable until Pascal publishes its builder permit encoding.');
 if(!/^[A-Z0-9_.-]{1,32}$/.test(order.symbol)||!['BID','ASK'].includes(order.side)||order.tif!=='IOC')throw Error('Invalid bounded order.');
 const price=micros(order.price),size=integer(order.size),id=integer(order.client_order_id);
 if(price<=0n||price>=1000000n||size===0n||id===18446744073709551615n)throw Error('Invalid order price, size or identifier.');
 const bytes=new Uint8Array(232),view=new DataView(bytes.buffer);
 bytes.set([1,1,3,0]);view.setUint32(4,Number(auth.recv_window_ms),true);view.setBigUint64(8,integer(auth.client_ts_ms),true);
 bytes.set(publicKey(auth.owner),16);bytes.set(publicKey(auth.signer),48);
 view.setBigUint64(80,size,true);view.setBigUint64(88,price,true);view.setBigUint64(96,id,true);view.setBigUint64(104,18446744073709551615n,true);
 bytes.set(utf8(order.symbol),152);
 bytes.set(Uint8Array.from('dcaf53738f1d5f06164660498a75888e7f0c78ed5f1bc17be1dd1cb3ccf53ce3'.match(/../g)!.map(x=>parseInt(x,16))),188);
 bytes[221]=order.side==='BID'?0:1;bytes[223]=2;bytes[224]=order.reduce_only?2:0;
 return bytes;
}
export function signedOrder(order:Order,auth:Auth,secret:Uint8Array){
 if(base58.encode(ed25519.getPublicKey(secret))!==auth.signer)throw Error('Trading key does not match signer.');
 return {...order,auth:{...auth,signature:base58.encode(ed25519.sign(orderMessage(order,auth),secret))}};
}
export class PascalError extends Error {code:string;constructor(code:string,message:string){super(message);this.code=code;}}
// Direct device requests preserve Pascal geographic checks. No blind retries.
export async function request(path:string,body?:unknown):Promise<any>{
 let response:Response;
 try{response=await fetch(`${body===undefined?READ:WRITE}/${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});}catch{throw new PascalError(body===undefined?'NETWORK_ERROR':'UNKNOWN','Could not confirm the request. Refresh account state before submitting again.');}
 let envelope:any;try{envelope=await response.json();}catch{throw new PascalError('UNKNOWN','Pascal returned an unreadable response. Refresh account state.');}
 const entries=Array.isArray(envelope)?envelope:[envelope];
 for(const entry of entries){if(entry.status!=='success')throw new PascalError(entry.data?.code||'UNKNOWN',entry.data?.message||'Pascal request failed.');}
 if(!response.ok)throw new PascalError('UNKNOWN',`Pascal returned HTTP ${response.status}.`);
 return Array.isArray(envelope)?entries.map(x=>x.data):envelope.data;
}
export const account=(owner:string)=>{publicKey(owner);return request(`accounts/${owner}`);};
export function feeUpperBound(size:bigint,rate:string){return (size*micros(rate)+3n)/4n;}
