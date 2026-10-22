// Read-only production feed check. Does not create accounts, trades or posts.
import assert from 'node:assert/strict';
import {publicMarketRead} from '../lib/public-market-client.ts';
import {groupGames} from '../lib/game-model.ts';
const origin='https://social-groups-oakland.fit-angel-7280.chatgpt.site';
const original=globalThis.fetch;const relayStatuses:number[]=[];
globalThis.fetch=async(input,options)=>{const path=String(input);const response=await original(path.startsWith('/api/')?origin+path:input,options);if(path.startsWith('/api/'))relayStatuses.push(response.status);return response};
try{const catalog=await publicMarketRead('markets');assert(catalog.markets.length>0);assert(catalog.markets.every((m:{tags:string[]})=>m.tags.includes('NCAA Football')));const games=groupGames(catalog.markets);assert(games.length>0);const detail=await publicMarketRead('market-detail?'+new URLSearchParams({symbol:games[0].featured.id,range:'1D'}));assert.equal(detail.market.id,games[0].featured.id);assert(Array.isArray(detail.candles));assert(Array.isArray(detail.trades));assert(detail.book);console.log(JSON.stringify({markets:catalog.markets.length,games:games.length,chartSamples:detail.candles.length,trades:detail.trades.length,relayStatuses}));}finally{globalThis.fetch=original}
