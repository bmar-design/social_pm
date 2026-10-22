import React,{useEffect,useState} from 'react';
import {AccessibilityInfo,StyleSheet,View,type ViewProps} from 'react-native';
import {GlassView,isGlassEffectAPIAvailable,isLiquidGlassAvailable} from 'expo-glass-effect';
export function GlassSurface({children,style,tone='light',dense=false,...props}:ViewProps & {tone?:'light'|'dark';dense?:boolean}){
 const [reduced,setReduced]=useState(true);
 useEffect(()=>{let active=true;void AccessibilityInfo.isReduceTransparencyEnabled().then(value=>{if(active)setReduced(value);});const subscription=AccessibilityInfo.addEventListener('reduceTransparencyChanged',setReduced);return()=>{active=false;subscription.remove();};},[]);
 const available=!reduced&&isGlassEffectAPIAvailable()&&isLiquidGlassAvailable();
 return <View {...props} style={[s.frame,style]}>{available?<GlassView pointerEvents="none" colorScheme={tone==='dark'?'dark':'light'} glassEffectStyle="regular" tintColor={tone==='dark'?'#c3af95f5':'#fff6e52a'} style={StyleSheet.absoluteFill}/>:<View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:tone==='dark'?'#c3af95':'#fff8ef'}]}/>}{(tone==='dark'||dense)&&<View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:tone==='dark'?'#c3af95f5':'#fff8effa'}]}/>}<View pointerEvents="none" style={s.highlight}/>{children}</View>;
}
const s=StyleSheet.create({frame:{borderRadius:28,borderWidth:1,borderColor:'#ffffffb8',overflow:'hidden',shadowColor:'#674b33',shadowOffset:{width:0,height:5},shadowOpacity:.1,shadowRadius:18,elevation:5},highlight:{...StyleSheet.absoluteFillObject,borderRadius:28,borderTopWidth:1,borderColor:'#ffffffbf'}});
