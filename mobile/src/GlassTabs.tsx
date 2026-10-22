import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Platform,Pressable,Text,View} from 'react-native';
import {GlassSurface} from './GlassSurface';
import {colors} from './ui';
export function useReducedMotion(){
 const [reduced,setReduced]=useState(true);
 useEffect(()=>{
  if(Platform.OS==='web'){const query=window.matchMedia('(prefers-reduced-motion: reduce)');setReduced(query.matches);const update=()=>setReduced(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);}
  let alive=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(alive)setReduced(value);});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{alive=false;sub.remove();};
 },[]);return reduced;
}
export function GlassTabs<T extends string>({items,active,onChange,icon,allowReselect=false}:{items:readonly T[];active:T;onChange:(tab:T)=>void;icon?:(tab:T,color:string)=>React.ReactNode;allowReselect?:boolean}){
 const index=items.indexOf(active),[width,setWidth]=useState(0),offset=useRef(new Animated.Value(index)).current,pulse=useRef(new Animated.Value(1)).current,reduced=useReducedMotion(),previousIndex=useRef(index);
 useEffect(()=>{const changed=previousIndex.current!==index;previousIndex.current=index;offset.stopAnimation();pulse.stopAnimation();if(reduced||!changed){offset.setValue(index);pulse.setValue(1);return;}
  const slide=Animated.spring(offset,{toValue:index,stiffness:240,damping:19,mass:.85,useNativeDriver:Platform.OS!=='web'});
  const bounce=Animated.sequence([Animated.timing(pulse,{toValue:.94,duration:80,useNativeDriver:Platform.OS!=='web'}),Animated.spring(pulse,{toValue:1,stiffness:330,damping:12,mass:.65,useNativeDriver:Platform.OS!=='web'})]);
  slide.start();bounce.start();return()=>{slide.stop();bounce.stop();};
 },[index,reduced,offset,pulse]);
 const cell=Math.max(0,(width-12)/items.length);
 return <GlassSurface tone="dark" accessibilityRole="tablist" onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={{padding:5,borderRadius:icon?34:26}}>
  <View style={{flexDirection:'row',position:'relative'}}>
   {width>0&&<Animated.View pointerEvents="none" style={{position:'absolute',left:0,top:0,bottom:0,width:cell,borderRadius:icon?28:21,backgroundColor:'#fff8efe8',borderWidth:1,borderColor:'#ffffffef',shadowColor:'#24170f',shadowOffset:{width:0,height:2},shadowOpacity:.16,shadowRadius:7,transform:[{translateX:offset.interpolate({inputRange:[0,Math.max(1,items.length-1)],outputRange:[0,cell*Math.max(1,items.length-1)]})},{scale:pulse}]}}/>}
   {items.map(tab=><Pressable key={tab} accessibilityRole="tab" accessibilityLabel={tab} accessibilityState={{selected:tab===active}} onPress={()=>{if(tab!==active||allowReselect)onChange(tab);}} style={{zIndex:1,flex:1,minHeight:icon?58:44,alignItems:'center',justifyContent:'center'}}><Animated.View style={{alignItems:'center',gap:4,transform:[{scale:tab===active?pulse:1}]}}>{icon?.(tab,tab===active?colors.text:'#493b2d')}<Text style={{fontSize:icon?11:15,fontWeight:'600',color:tab===active?colors.text:'#493b2d'}}>{tab}</Text></Animated.View></Pressable>)}
  </View>
 </GlassSurface>;
}
