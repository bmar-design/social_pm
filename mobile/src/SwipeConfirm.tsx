import React,{useRef,useState} from 'react';
import {Animated,PanResponder,Platform,Text,View} from 'react-native';
import {colors} from './ui';
import {tradeTones} from './TradePad';
const travel=76;
export function SwipeConfirm({disabled,submitting=false,tone='tail',onConfirm,label}:{disabled:boolean;submitting?:boolean;tone?:'tail'|'fade';onConfirm:()=>Promise<void>;label:string}){
 const offset=useRef(new Animated.Value(0)).current,locked=useRef(false),latest=useRef({disabled,onConfirm});latest.current={disabled,onConfirm};
 const [ready,setReady]=useState(false);
 const reset=()=>{setReady(false);Animated.spring(offset,{toValue:0,stiffness:300,damping:24,useNativeDriver:Platform.OS!=='web'}).start();};
 const submit=()=>{if(locked.current||latest.current.disabled)return;locked.current=true;setReady(false);offset.setValue(-travel);void latest.current.onConfirm().finally(()=>{locked.current=false;reset();});};
 const responder=useRef(PanResponder.create({
  onStartShouldSetPanResponder:()=>!latest.current.disabled&&!locked.current,
  onMoveShouldSetPanResponder:(_,g)=>!latest.current.disabled&&g.dy< -6&&Math.abs(g.dy)>Math.abs(g.dx),
  onPanResponderMove:(_,g)=>{if(locked.current||latest.current.disabled)return;offset.setValue(Math.max(-travel,Math.min(0,g.dy)));setReady(-g.dy>=travel&&Math.abs(g.dx)<60);},
  onPanResponderRelease:(_,g)=>{if(-g.dy>=travel&&Math.abs(g.dx)<60)submit();else reset();},
  onPanResponderTerminate:reset,onPanResponderTerminationRequest:()=>false,
 })).current;
 const palette=tradeTones[tone];
 return <View style={{backgroundColor:colors.bg,paddingHorizontal:20,paddingTop:10,paddingBottom:8,gap:7}}>
  <Animated.View {...responder.panHandlers} accessible accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Swipe this bar upward, then release to place the displayed practice order." accessibilityState={{disabled}} accessibilityActions={[{name:'activate',label:'Confirm displayed practice order'}]} onAccessibilityAction={e=>{if(e.nativeEvent.actionName==='activate')submit();}} {...(Platform.OS==='web'?{tabIndex:0}:{})} style={{height:48,borderRadius:24,borderWidth:1,borderColor:palette.line,backgroundColor:palette.bg,alignItems:'center',justifyContent:'center',gap:3,opacity:disabled?.55:1,transform:[{translateY:offset}],...(Platform.OS==='web'?{touchAction:'none',userSelect:'none',cursor:'grab'} as any:{})}}>
    <View pointerEvents="none" style={{width:30,height:3,borderRadius:2,backgroundColor:palette.ink,opacity:.5}}/><Text pointerEvents="none" style={{fontSize:13,fontWeight:'700',color:palette.ink}}>{submitting?'Placing order…':ready?'Release to confirm':`↑ ${label}`}</Text>
  </Animated.View><Text style={{textAlign:'center',fontSize:10,color:colors.muted}}>Practice money · Swipe up to confirm · Slide back to cancel</Text>
 </View>;
}
