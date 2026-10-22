import assert from 'node:assert/strict';
import {test} from 'node:test';
import {portfolio,filterTrades,tradesCsv} from '../src/portfolio.ts';
const buy=(id:string,side='yes',cost=600,contracts=10,symbol='X',created=100)=>({id,symbol,title:'Home',opposite:'Away',side,cost_cents:cost,contracts,created});
const market=(price:number|null)=>({id:'X',price}) as any;
test('aggregates repeated fills by outcome and values no contracts at the complement',()=>{
 const result=portfolio([buy('a'),buy('b','yes',300,5),buy('c','no',200,5)],[market(.7)]);
 assert.equal(result.positions.length,2);assert.equal(result.cost,1100);assert.equal(result.value,1200);assert.equal(result.pnl,100);
 assert.equal(result.positions[0].average,.6);assert.equal(result.positions[1].pnl,-50);
});
test('missing quotes never erase cost or create fabricated losses',()=>{
 const result=portfolio([buy('a'),buy('b','yes',400,10,'MISSING')],[market(.7)]);
 assert.equal(result.cost,1000);assert.equal(result.pricedCost,600);assert.equal(result.value,700);assert.equal(result.pnl,100);assert.equal(result.missing,1);
 assert.equal(result.positions[1].pnl,null);assert.equal(portfolio([buy('a')],[market(null)]).pnl,null);
 assert.equal(portfolio([],[]).pnl,null);
});
test('zero and one marks are valid and cents round after aggregation',()=>{
 assert.equal(portfolio([buy('a')],[market(0)]).pnl,-600);
 assert.equal(portfolio([buy('a','no')],[market(0)]).value,1000);
 assert.equal(portfolio([buy('a')],[market(1)]).value,1000);
 assert.equal(portfolio([buy('a','yes',1,1),buy('b','yes',1,1)],[market(.3333)]).value,67);
});
test('history filters dates, both outcomes and case-insensitive text without mutating records',()=>{
 const now=200000000,rows=[buy('old','yes',600,10,'X',now-90000000),buy('new','no',600,10,'X',now)];
 assert.deepEqual(filterTrades(rows,'1D','','all',now).map(t=>t.id),['new']);
 assert.deepEqual(filterTrades(rows,'ALL','AWAY','yes',now).map(t=>t.id),['old']);
 assert.equal(rows[0].id,'old');
});
test('CSV preserves receipts and protects spreadsheet formulas',()=>{
 const csv=tradesCsv([{...buy('a'),title:'=SUM(1,2)'}]);
 assert(csv.includes('"\'=SUM(1,2)"'));assert(csv.includes('"6.00"'));assert(csv.includes('"0.600000"'));
});
