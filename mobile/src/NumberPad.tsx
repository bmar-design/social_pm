import React from 'react';
import {Pressable,Text,View} from 'react-native';
import {colors} from './ui';

export function NumberPad({amount,onAmount,disabled=false}:{amount:string;onAmount:(amount:string)=>void;disabled?:boolean}) {
 const key=(value:string)=>{
  if(value==='⌫'){onAmount(amount.length>1?amount.slice(0,-1):'0');return;}
  if(value==='.'&&amount.includes('.'))return;
  const next=value==='.'?amount+'.':amount==='0'?value:amount+value;
  if(/^\d{1,4}(\.\d{0,2})?$/.test(next)&&Number(next)<=1000)onAmount(next);
 };
 return <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(value=><Pressable key={value} accessibilityRole="button" accessibilityLabel={value==='⌫'?'Delete last digit':value==='.'?'Decimal point':value} accessibilityState={{disabled}} disabled={disabled} onPress={()=>key(value)} style={({pressed})=>({width:'32%',flexGrow:1,minHeight:52,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:pressed?colors.border:colors.accentSoft,opacity:disabled?.5:1})}><Text style={{fontSize:25,color:colors.text,fontWeight:'500'}}>{value}</Text></Pressable>)}</View>;
}
