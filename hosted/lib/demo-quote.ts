import type {Market} from './market-model.ts';
import {priceValue} from './market-model.ts';
// Unverified browser quotes are permitted only for zero-money practice records.
// This is deliberately not an authorization or real-order pricing mechanism.
export function browserDemoQuote(value:any,symbol:string,now=Date.now()):Market|null{
 const m=value?.market,t=value?.quotedAt;
 if(!m||typeof t!=='number'||!Number.isFinite(t)||now-t>60000||t-now>5000||m.id!==symbol||typeof m.id!=='string'||!Array.isArray(m.tags)||!m.tags.includes('NCAA Football'))return null;
 if(![m.event,m.title,m.opposite].every(v=>typeof v==='string'&&v.length>0&&v.length<=500))return null;
 if(![m.yesAsk,m.noAsk].every(v=>v===null||typeof v==='number'&&priceValue(v)!==null))return null;
 return {...m,yesAsk:priceValue(m.yesAsk),noAsk:priceValue(m.noAsk)};
}
