// Pascal explicitly allows cross-origin public reads. If the hosted relay cannot
// reach it, the browser can read the same public endpoints without credentials.
import {isCollegeFootball,normalizeMarket,normalizeCandles,normalizeTrades,normalizeLevels,RANGES} from './market-model';
import type {Market,Range} from './market-model';
let catalog:{markets:Market[];fetchedAt:number}|null=null;
async function provider(path:string,params:URLSearchParams|undefined,signal?:AbortSignal,body?:unknown){
 const response=await fetch('https://data.pascal.trade/api/v1/'+path+(params?'?'+params:''),{method:body?'POST':'GET',credentials:'omit',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000),...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Error('Pascal’s market feed is temporarily unavailable. Please try again shortly.');
 const payload=await response.json() as {status:string;data:any};if(payload.status!=='success')throw Error('Pascal’s market feed returned an invalid response.');return payload.data;
}
async function directCatalog(signal?:AbortSignal){if(catalog&&Date.now()-catalog.fetchedAt<30000)return catalog;const raw=await provider('markets',undefined,signal);if(!Array.isArray(raw))throw Error('Market list unavailable.');catalog={markets:raw.filter(m=>m&&!m.resolution&&typeof m.symbol==='string'&&isCollegeFootball(m)).map(normalizeMarket),fetchedAt:Date.now()};return catalog}
async function directDetail(query:URLSearchParams,signal?:AbortSignal){
 const symbol=query.get('symbol')||'',range=query.get('range')||'1D';if(!/^[A-Z0-9_.-]{1,80}$/.test(symbol)||!Object.hasOwn(RANGES,range))throw Error('Invalid market or chart period.');
 const metadata=await provider('markets/search',undefined,signal,{symbols:[symbol]});
 const raw=Array.isArray(metadata)?metadata.find(m=>m.symbol===symbol&&!m.resolution&&isCollegeFootball(m)):null;if(!raw)throw Error('This college-football market is no longer available.');
 const market=normalizeMarket(raw),now=Date.now(),spec=RANGES[range as Range],listed=range==='ALL'&&market.listedAt?Math.floor(market.listedAt/86400000)*86400000:market.listedAt||0,start=Math.max(now-spec.ms,listed);
 const results=await Promise.allSettled([provider('mark-price-candles',new URLSearchParams({symbol,interval:spec.interval,end_time_ms:String(now),count_back:String(spec.count)}),signal),provider('trades',new URLSearchParams({symbols:symbol,limit:'20'}),signal),provider('books',new URLSearchParams({symbols:symbol}),signal)]);
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const [history,trades,book]=results,ob=book.status==='fulfilled'?book.value.books?.[symbol]:null;
 return {market,range,start,end:now,fetchedAt:Date.now(),candles:history.status==='fulfilled'?normalizeCandles(history.value,start,now):null,trades:trades.status==='fulfilled'?normalizeTrades(trades.value.items):null,book:ob?{bids:normalizeLevels(ob.bids),asks:normalizeLevels(ob.asks)}:null};
}
export async function publicMarketRead(path:string,signal?:AbortSignal):Promise<any>{
 if(path!=='markets'&&!path.startsWith('market-detail?'))throw Error('Unsupported public read.');
 try{const response=await fetch('/api/'+path,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});if(response.ok)return await response.json()}catch{if(signal?.aborted)throw new DOMException('Aborted','AbortError')}
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 return path==='markets'?directCatalog(signal):directDetail(new URLSearchParams(path.slice(path.indexOf('?')+1)),signal);
}
