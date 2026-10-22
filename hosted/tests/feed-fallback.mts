import assert from 'node:assert/strict';
import {publicMarketRead} from '../lib/public-market-client.ts';
import {browserDemoQuote} from '../lib/demo-quote.ts';
const raw={symbol:'CFB_TEST.HOME',display_attributes:{event_description:'Home vs Away',market_description:'Home',reverse_description:'Away',tags:['Sports','NCAA Football'],market_type:{market:{type:'moneyline',outcome:'home'},teams:{home_name:'Home',away_name:'Away'}}},mark_price:'.55',best_bid:'.54',best_ask:'.56'};
const fetchOriginal=globalThis.fetch;const calls:string[]=[];
try{
 globalThis.fetch=async(input,options)=>{const url=String(input);calls.push(url);if(url.startsWith('/api/'))return Response.json({error:'relay unavailable'},{status:503});assert.equal(options?.credentials,'omit');assert(url.startsWith('https://data.pascal.trade/api/v1/'));let data:unknown=[];if(url.endsWith('/markets'))data=[raw,{...raw,symbol:'NFL_TEST',display_attributes:{tags:['NFL']}}];else if(url.endsWith('/markets/search'))data=[raw];else if(url.includes('mark-price-candles'))data=[{time:String(Date.now()-60000),close:'.54'}];else if(url.includes('/trades?'))data={items:[]};else if(url.includes('/books?'))data={books:{[raw.symbol]:{bids:[['.54','10']],asks:[['.56','12']]}}};return Response.json({status:'success',data})};
 const catalog=await publicMarketRead('markets');assert.equal(catalog.markets.length,1);assert.equal(catalog.markets[0].id,raw.symbol);
 const detail=await publicMarketRead('market-detail?symbol=CFB_TEST.HOME&range=1D');assert.equal(detail.market.id,raw.symbol);assert.equal(detail.candles.length,1);assert.equal(detail.trades.length,0);assert.equal(detail.book.asks[0].size,12);
 const quote={market:detail.market,quotedAt:Date.now()};assert(browserDemoQuote(quote,raw.symbol));assert.equal(browserDemoQuote({...quote,quotedAt:Date.now()-61000},raw.symbol),null);assert.equal(browserDemoQuote(quote,'another'),null);assert.equal(browserDemoQuote({...quote,market:{...quote.market,tags:['NFL']}},raw.symbol),null);
 await assert.rejects(()=>publicMarketRead('unsupported'));
 const controller=new AbortController();controller.abort();await assert.rejects(()=>publicMarketRead('markets',controller.signal),{name:'AbortError'});
 assert(calls.some(c=>c.includes('markets/search')));
 console.log('PASS: failed hosted relay falls back to official public CORS endpoints, college-football scope retained, all detail sections normalized, no provider credentials sent, stale demo snapshots rejected, cancellations respected.');
}finally{globalThis.fetch=fetchOriginal}
