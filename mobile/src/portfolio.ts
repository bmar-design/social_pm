import type {Market} from '../../hosted/lib/market-model.ts';
export type PortfolioTrade={id:string;symbol:string;title:string;opposite:string;side:string;contracts:number;cost_cents:number;created:number;price_micros?:number;event?:string};
export function portfolio(trades:PortfolioTrade[],markets:Market[]){
 const grouped=new Map<string,PortfolioTrade[]>();
 for(const trade of trades){const key=JSON.stringify([trade.symbol,trade.side]);grouped.set(key,[...(grouped.get(key)||[]),trade]);}
 const positions=Array.from(grouped.entries()).map(([id,fills])=>{
  const first=fills[0],contracts=fills.reduce((n,t)=>n+t.contracts,0),cost=fills.reduce((n,t)=>n+t.cost_cents,0);
  const market=markets.find(m=>m.id===first.symbol),mark=market?.price;
  const price=mark==null?null:first.side==='yes'?mark:1-mark;
  const value=price===null?null:Math.round(contracts*price*100),pnl=value===null?null:value-cost;
  return {id,symbol:first.symbol,side:first.side,title:first.side==='yes'?first.title:first.opposite,opposite:first.side==='yes'?first.opposite:first.title,contracts,cost,price,value,pnl,roi:pnl===null||!cost?null:pnl/cost*100,average:cost/contracts/100,first:Math.min(...fills.map(t=>t.created)),last:Math.max(...fills.map(t=>t.created)),fills};
 });
 const cost=positions.reduce((n,p)=>n+p.cost,0),priced=positions.filter(p=>p.value!==null),pricedCost=priced.reduce((n,p)=>n+p.cost,0),value=priced.reduce((n,p)=>n+p.value!,0),pnl=value-pricedCost;
 return {positions,cost,pricedCost,value:priced.length?value:null,pnl:priced.length?pnl:null,roi:priced.length&&pricedCost?pnl/pricedCost*100:null,missing:positions.length-priced.length,contracts:positions.reduce((n,p)=>n+p.contracts,0),count:trades.length};
}
export function filterTrades(trades:PortfolioTrade[],range:string,search:string,side:string,now=Date.now()){
 const days=range==='1D'?1:range==='1W'?7:range==='1M'?30:range==='1Y'?365:Infinity;
 const cutoff=now-days*86400000,query=search.trim().toLowerCase();
 return trades.filter(t=>t.created>=cutoff&&(side==='all'||t.side===side)&&`${t.title} ${t.opposite} ${t.symbol} ${t.id}`.toLowerCase().includes(query)).sort((a,b)=>b.created-a.created||b.id.localeCompare(a.id));
}
export function tradesCsv(trades:PortfolioTrade[]){
 const cell=(v:string|number)=>{const text=String(v);return '"'+(/^[=+@\-\t\r]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';};
 return [['Trade ID','Date UTC','Market','Outcome','Action','Contracts','Cost USD','Average fill USD'],...trades.map(t=>[t.id,new Date(t.created).toISOString(),t.symbol,t.side==='yes'?t.title:t.opposite,'Practice buy',t.contracts,(t.cost_cents/100).toFixed(2),(t.cost_cents/t.contracts/100).toFixed(6)])].map(row=>row.map(cell).join(',')).join('\n');
}
