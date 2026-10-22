import React from 'react';
import {Pressable,Text,View} from 'react-native';
import {colors,styles,money} from './ui';
import type {Market} from '../../hosted/lib/market-model';
export const tradeTones={tail:{bg:'#e0f1e3',ink:'#28633a',line:'#8dbb98'},fade:{bg:'#fbe2df',ink:'#963c36',line:'#d9a09a'}};
export function TradePad({market,side,referenceSide,amount,fill,busy,onAmount,onSide}:{market:Market;side:'yes'|'no';referenceSide:'yes'|'no';amount:string;fill:{contracts:number;costCents:number;payoutCents:number}|null;busy:boolean;onAmount:(value:string)=>void;onSide:(value:'yes'|'no')=>void}){
 const stance=side===referenceSide?'tail':'fade',tone=tradeTones[stance];
 const key=(value:string)=>{
  if(value==='⌫'){onAmount(amount.length>1?amount.slice(0,-1):'0');return;}
  if(value==='.'&&amount.includes('.'))return;
  const next=value==='.'?amount+'.':amount==='0'?value:amount+value;
  if(/^\d{1,4}(\.\d{0,2})?$/.test(next)&&Number(next)<=1000)onAmount(next);
 };
 return <View style={{gap:12}}><View style={{flexDirection:'row',gap:8}}>{(['yes','no'] as const).map(value=>{const color=tradeTones[value===referenceSide?'tail':'fade'];return <Pressable key={value} accessibilityRole="button" accessibilityState={{selected:side===value,disabled:busy}} disabled={busy} onPress={()=>onSide(value)} style={{flex:1,padding:10,minHeight:52,borderRadius:14,borderWidth:1,borderColor:side===value?color.line:colors.border,backgroundColor:side===value?color.bg:colors.card}}><Text style={{color:side===value?color.ink:colors.muted,fontWeight:'600',fontSize:13}}>{value===referenceSide?'↗ Tail':'↘ Fade'} · {value==='yes'?market.title:market.opposite}</Text></Pressable>;})}</View>
 <View style={{padding:16,gap:5,borderRadius:22,backgroundColor:tone.bg,borderWidth:1,borderColor:tone.line,alignItems:'center'}}><Text style={{color:tone.ink,fontSize:11,fontWeight:'700',letterSpacing:1}}>PRACTICE BUY · {stance.toUpperCase()}</Text><Text accessibilityLabel={`${amount} practice dollars`} style={{fontSize:46,fontWeight:'600',color:tone.ink,fontVariant:['tabular-nums']}}>${amount}</Text><Text style={{fontSize:12,color:tone.ink}}>{fill?`${fill.contracts} contracts · ${money(fill.costCents)} actual cost`:'Enter $1–$1,000'}</Text><Text style={{fontSize:11,color:tone.ink}}>{fill?`${money(fill.payoutCents)} potential payout · $0 practice fees`:(side==='yes'?market.yesAsk:market.noAsk)==null?'No quote available for this outcome':'Whole contracts · practice money only'}</Text></View>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(value=><Pressable key={value} accessibilityRole="button" accessibilityLabel={value==='⌫'?'Delete last digit':value==='.'?'Decimal point':value} disabled={busy} onPress={()=>key(value)} style={({pressed})=>({width:'32%',flexGrow:1,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:pressed?tone.line:tone.bg,opacity:busy?.5:1})}><Text style={{fontSize:25,color:tone.ink,fontWeight:'500'}}>{value}</Text></Pressable>)}</View>
 </View>;
}
