export type Market={gameId:string;home:string|null;away:string|null;id:string;event:string;title:string;opposite:string;tags:string[];price:number|null;yesAsk:number|null;noAsk:number|null;rulesUrl:string|null;game:string;kind:string;startsAt:number|null;listedAt:number|null;volume24h:number|null;trades24h:number|null;change24h:number|null};
export type Candle={time:number;close:number};
export const priceValue=(x:unknown)=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=1?Number(x):null;
const quantity=(x:unknown)=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>=0?Number(x):null;
const sum=(a:unknown,b:unknown)=>{const x=quantity(a),y=quantity(b);return x===null||y===null?null:x+y};
export function isCollegeFootball(raw:any){const a=raw.display_attributes||{};return Array.isArray(a.tags)&&a.tags.includes('NCAA Football')}
export function normalizeMarket(m:any):Market{
 const a=m.display_attributes||{},stats=m.stats?.last_24h||{},bid=priceValue(m.best_bid),p=priceValue(m.mark_price),start=priceValue(stats.mark_price_start);
 const teams=a.market_type?.teams,kind=a.market_type?.market?.type||'futures';
 let opposite=a.reverse_description;
 if(!opposite&&teams){const type=a.market_type.market;
  if(kind==='moneyline')opposite=type.outcome==='home'?teams.away_name:teams.home_name;
  if(kind==='spread'){const team=type.team==='home'?teams.away_name:teams.home_name;const line=Number(type.line);if(Number.isFinite(line))opposite=`${team} ${-line>0?'+':''}${-line}`}
  if(kind==='total_points')opposite=`Under ${type.line}`;
 }
 return {gameId:a.game_page?.game_id||a.event_description||m.symbol,home:teams?.home_name||null,away:teams?.away_name||null,id:m.symbol,event:a.event_description||m.symbol,title:a.market_description||'Yes',opposite:opposite||`Not ${a.market_description||'this outcome'}`,tags:Array.isArray(a.tags)?a.tags:[],price:p,yesAsk:priceValue(m.best_ask),noAsk:bid===null?null:1-bid,rulesUrl:typeof m.rules_url==='string'&&m.rules_url.startsWith('https://')?m.rules_url:null,game:a.game_page?.game_description||a.event_description||m.symbol,kind,startsAt:quantity(a.expected_event_start_time_ms),listedAt:quantity(m.listing_ts_ms),volume24h:sum(stats.taker_buy_volume,stats.taker_sell_volume),trades24h:sum(stats.taker_buy_trade_count,stats.taker_sell_trade_count),change24h:p===null||start===null?null:p-start};
}
export const RANGES={ '1H':{interval:'1m',ms:3600000,count:60},'1D':{interval:'5m',ms:86400000,count:288},'1W':{interval:'1h',ms:604800000,count:168},'ALL':{interval:'1d',ms:43200000000,count:500} } as const;
export type Range=keyof typeof RANGES;
export function normalizeCandles(raw:any,start:number,end:number):Candle[]{if(!Array.isArray(raw))return [];const values=new Map<number,Candle>();for(const c of raw){const p=priceValue(c.close),t=Number(c.time);if(p!==null&&Number.isFinite(t)&&t>=start&&t<end)values.set(t,{time:t,close:p})}return [...values.values()].sort((a,b)=>a.time-b.time)}
export function rangeChange(candles:Candle[]){return candles.length<2?null:candles.at(-1)!.close-candles[0].close}
export function normalizeTrades(raw:any){if(!Array.isArray(raw))return [];return raw.flatMap(t=>{const p=priceValue(t.price),size=quantity(t.size),time=quantity(t.trade_ts_ms);return p===null||size===null||time===null?[]:[{id:String(t.trade_id),price:p,size,time,side:t.taker_side==='BID'?'buy':t.taker_side==='ASK'?'sell':'unknown'}]})}
export function normalizeLevels(raw:any){if(!Array.isArray(raw))return [];return raw.slice(0,5).flatMap(v=>{if(!Array.isArray(v))return [];const p=priceValue(v[0]),size=quantity(v[1]);return p===null||size===null?[]:[{price:p,size}]})}
