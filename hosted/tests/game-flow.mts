import assert from 'node:assert/strict';
import {groupGames,gameSides,simulateBuy} from '../lib/game-model.ts';
import {normalizeMarket} from '../lib/market-model.ts';
const raw={symbol:'GAME.ML',display_attributes:{tags:['NCAA Football'],game_page:{game_id:'same-game',game_description:'Colorado State vs Texas State'},expected_event_start_time_ms:'2000',market_description:'Texas State',market_type:{teams:{home_name:'Texas State',away_name:'Colorado State'},market:{type:'moneyline',outcome:'home'}}},mark_price:'.85',best_bid:'.84',best_ask:'.86',stats:{last_24h:{taker_buy_volume:'3',taker_sell_volume:'4'}}};
const ml=normalizeMarket(raw),spread={...ml,id:'GAME.SP',kind:'spread',title:'Texas State -14.5',volume24h:8};
const games=groupGames([spread,ml]);assert.equal(games.length,1);assert.equal(games[0].markets.length,2);assert.equal(games[0].featured.id,'GAME.ML');assert.equal(games[0].volume24h,15);
const sides=gameSides(games[0]);assert.equal(sides[0].name,'Colorado State');assert.equal(sides[1].name,'Texas State');assert(Math.abs(sides[0].price!-.15)<1e-10);assert.equal(sides[1].price,.85);
assert.deepEqual(simulateBuy(1000,620000),{contracts:16,costCents:992,payoutCents:1600});
for(const [budget,p] of [[0,500000],[99,500000],[100001,500000],[1000,0],[1000,-1],[1000,1000001],[10.1,500000]])assert.throws(()=>simulateBuy(budget,p));
for(let p=1000;p<1000000;p+=17001){const fill=simulateBuy(1000,p);assert(fill.costCents<=1000);assert(fill.contracts>0);assert.equal(fill.payoutCents,fill.contracts*100)}
console.log('PASS: one game per matchup, moneyline as game default, independent market selection, team-price mapping, whole-contract demo fills within budget, invalid amounts and absent quotes rejected.');
