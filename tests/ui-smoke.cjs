// Exercise rendering and navigation without dependencies. This is not visual QA.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const els=new Map();
const element=id=>{if(!els.has(id))els.set(id,{innerHTML:'',textContent:'',style:{},value:'',setAttribute(){},querySelector(){return {focus(){}}},querySelectorAll(){return []},insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML},addEventListener(){}});return els.get(id)};
const ctx=vm.createContext({console,URL,Date,Number,Math,JSON,Set,Map,Array,String,AbortSignal,
 location:{hash:'#home'},localStorage:{getItem(){return null},setItem(){}},
 document:{hidden:false,getElementById:element,addEventListener(){}},
 window:{addEventListener(){}},addEventListener(){},setTimeout(){},setInterval(){},
 fetch:async()=>({ok:true,json:async()=>({markets:[],fetchedAt:Math.floor(Date.now()/1000)})})});
vm.runInContext(fs.readFileSync('app.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('live.js','utf8'),ctx);
vm.runInContext(`
 liveState.markets=[{id:'A.B',event:'<img src=x onerror=alert(1)>',title:'Home team',opposite:'No',tags:['Sports'],markPrice:'0.5',yesAsk:null,noAsk:'0.46',rulesUrl:'javascript:alert(1)'}];
 liveState.fetchedAt=1700000000;
 renderMarkets();
`,ctx);
assert(element('live-results').innerHTML.includes('&lt;img'));
assert(!element('live-results').innerHTML.includes('<img'));
vm.runInContext("renderLiveMarket('A.B')",ctx);
assert(element('screen').innerHTML.includes('Unavailable'));
assert(element('screen').innerHTML.includes('disabled>Trading coming soon'));
assert(!element('screen').innerHTML.includes('javascript:'));
vm.runInContext('accountPreview()',ctx);
assert(element('overlay').innerHTML.includes('No email is collected'));
vm.runInContext("fundingPreview('add')",ctx);
assert(element('overlay').innerHTML.includes('Payments aren’t connected'));
vm.runInContext('renderActivity()',ctx);
assert(element('screen').innerHTML.includes('Illustrative balances'));
vm.runInContext("location.hash='#group/sunday';render()",ctx);
assert(element('screen').innerHTML.includes('928 Oakland'));
vm.runInContext("review('lions','tail','p1')",ctx);
assert(element('overlay').innerHTML.includes('SIMULATED ORDER'));
console.log('UI smoke checks passed: escaping, disabled execution, account/funding previews, demo group/review.');
