import test from 'node:test';
import assert from 'node:assert/strict';
import {readLay,writeLay,type Lay} from '../src/lays.ts';
const lay:Lay={v:1,name:'Saturday',legs:[{symbol:'a',title:'A',opposite:'B',side:'yes'},{symbol:'b',title:'C',opposite:'D',side:'no'}]};
test('shared and confirmed remixes survive the chat transport',()=>{
 const original=writeLay(lay);
 const copy=readLay(original)!;copy.legs[0].side='no';copy.source='original-message';copy.confirmed=true;copy.stake=10;
 assert.equal(readLay(writeLay(copy))?.legs[0].side,'no');
 assert.equal(readLay(original)?.legs[0].side,'yes');
 assert.equal(readLay(writeLay(copy))?.stake,10);
});
test('invalid chat payloads stay ordinary messages',()=>{
 for(const value of ['hello','LAY/1 {', 'LAY/1 '+JSON.stringify({...lay,legs:[lay.legs[0]]}), 'LAY/1 '+JSON.stringify({...lay,legs:[lay.legs[0],lay.legs[0]]}), 'LAY/1 '+JSON.stringify({...lay,stake:-1}), 'LAY/1 '+JSON.stringify({...lay,legs:[null,null]})])assert.equal(readLay(value),null);
 assert.throws(()=>writeLay({...lay,name:'a'.repeat(61)}));
});
