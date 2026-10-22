import {isCollegeFootball,normalizeMarket,normalizeCandles,normalizeTrades,normalizeLevels,RANGES} from './market-model.ts';
import type {Market,Range} from './market-model.ts';
export type {Market,Range} from './market-model.ts';
let cache:{markets:Market[];fetchedAt:number}|null=null;
const detailCache=new Map<string,{data:unknown;time:number}>();
async function read(path:string,params?:URLSearchParams){const r=await fetch('https://data.pascal.trade/api/v1/'+path+(params?'?'+params:''),{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json','User-Agent':'SocialGroups/1.0'}});if(!r.ok){console.error('Pascal read failed',path,r.status);throw Error('Pascal’s market feed is temporarily unavailable. Please try again shortly.');}const p=await r.json() as {status:string;data:any};if(p.status!=='success')throw Error('Invalid market response.');return p.data}
let catalogRequest:Promise<{markets:Market[];fetchedAt:number}>|null=null;
export async function marketData(){
 if(cache&&Date.now()-cache.fetchedAt<15000)return cache;
 if(catalogRequest)return catalogRequest;
 catalogRequest=loadMarkets();
 try{return await catalogRequest}finally{catalogRequest=null}
}
async function loadMarkets(){
 if(cache&&Date.now()-cache.fetchedAt<15000)return cache;
 const data=await read('markets');if(!Array.isArray(data))throw Error('Invalid market response.');
 const markets:Market[]=data.filter(m=>m&&!m.resolution&&typeof m.symbol==='string'&&isCollegeFootball(m)).map(normalizeMarket).sort((a,b)=>(b.volume24h||0)-(a.volume24h||0)||(a.startsAt||Infinity)-(b.startsAt||Infinity)||a.event.localeCompare(b.event));
 cache={markets,fetchedAt:Date.now()};return cache;
}
export async function marketDetails(symbol:string,range:Range){
 const key=symbol+':'+range,old=detailCache.get(key);if(old&&Date.now()-old.time<10000)return old.data;
 const market=(await marketData()).markets.find(m=>m.id===symbol);if(!market)return null;
 const now=Date.now(),spec=RANGES[range],listed=range==='ALL'&&market.listedAt?Math.floor(market.listedAt/86400000)*86400000:market.listedAt||0,start=Math.max(now-spec.ms,listed);
 const params=new URLSearchParams({symbol,interval:spec.interval,end_time_ms:String(now),count_back:String(spec.count)});
 const results=await Promise.allSettled([read('mark-price-candles',params),read('trades',new URLSearchParams({symbols:symbol,limit:'20'})),read('books',new URLSearchParams({symbols:symbol}))]);
 const [history,trades,book]=results;const ob=book.status==='fulfilled'?book.value.books?.[symbol]:null;
 const data={market,range,start,end:now,fetchedAt:Date.now(),candles:history.status==='fulfilled'?normalizeCandles(history.value,start,now):null,trades:trades.status==='fulfilled'?normalizeTrades(trades.value.items):null,book:ob?{bids:normalizeLevels(ob.bids),asks:normalizeLevels(ob.asks)}:null};
 if(detailCache.size>=100)detailCache.delete(detailCache.keys().next().value!);detailCache.set(key,{data,time:Date.now()});return data;
}
