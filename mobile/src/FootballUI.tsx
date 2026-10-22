import {GlassTabs, useReducedMotion} from './GlassTabs';
import React, { useEffect, useRef, useState } from 'react';
import type { Api } from './api';
import { Animated, Easing, Image, Pressable, Text, View, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { colors, styles } from './ui';
import type { Game } from '../../hosted/lib/game-model';
import type { Candle, Market } from '../../hosted/lib/market-model';

export type IconName = 'home' | 'groups' | 'profile' | 'back' | 'plus' | 'arrow' | 'search' | 'football';
const paths: Record<IconName,string> = {
  home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  groups:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  profile:'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 5a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  back:'m15 18-6-6 6-6',plus:'M12 5v14M5 12h14',arrow:'m9 5 7 7-7 7',search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  football:'M4 20C-1 6 6-1 20 4c5 14-2 21-16 16ZM8 16l8-8M8 12l4 4M12 8l4 4',
};
export function Icon({name,size=24,color=colors.text}:{name:IconName;size?:number;color?:string}){
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={paths[name]}/></Svg>;
}
export function IconButton({name,label,onPress}:{name:IconName;label:string;onPress:()=>void}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({pressed})=>({width:46,height:46,borderRadius:23,backgroundColor:colors.card,alignItems:'center',justifyContent:'center',opacity:pressed?.6:1})}><Icon name={name} size={22}/></Pressable>;
}
export function TabBar({active,onChange}:{active:'Home'|'Groups'|'Profile';onChange:(tab:'Home'|'Groups'|'Profile')=>void}){
  return <View style={{paddingHorizontal:16,paddingTop:6,paddingBottom:8}}><GlassTabs allowReselect items={['Home','Groups','Profile'] as const} active={active} onChange={onChange} icon={(tab,color)=><Icon name={tab==='Home'?'home':tab==='Groups'?'groups':'profile'} color={color}/>}/></View>;
}

const teams = [
  {names:['michigan state','michigan st','michigan state spartans'],color:'#18453b',logo:require('../assets/teams/michigan-state.png')},
  {names:['michigan','michigan wolverines'],color:'#00274c',logo:require('../assets/teams/michigan.png')},
  {names:['ohio state','ohio st','ohio state buckeyes'],color:'#bb0000',logo:require('../assets/teams/ohio-state.png')},
  {names:['penn state','penn st','penn state nittany lions'],color:'#041e42',logo:require('../assets/teams/penn-state.png')},
  {names:['texas','texas longhorns'],color:'#bf5700',logo:require('../assets/teams/texas.png')},
  {names:['georgia','georgia bulldogs'],color:'#ba0c2f',logo:require('../assets/teams/georgia.png')},
];
export function teamColor(name:string){
  const normalized=name.toLowerCase().trim().replace(/\s[+-]\d+(?:\.\d+)?$/,'');
  return teams.find(t=>t.names.includes(normalized))?.color ?? '#90765d';
}
export function outcomeTone(market:Market,side:'yes'|'no'){
  const label=side==='yes'?market.title:market.opposite;
  const team=[market.home,market.away].filter((name):name is string=>!!name).sort((a,b)=>b.length-a.length).find(name=>label.toLowerCase().includes(name.toLowerCase()));
  const primary=teamColor(team||label);
  return {primary,bg:primary+'14',ink:primary,line:primary+'55'};
}
export function TeamLogo({name,size=40}:{name:string;size?:number}){
  const [failed,setFailed]=useState(false);
  const normalized=name.toLowerCase().trim().replace(/\s[+-]\d+(?:\.\d+)?$/,'');
  const team=teams.find(t=>t.names.includes(normalized));
  return <View style={{width:size,height:size,borderRadius:size*.25,backgroundColor:'#ffffff',alignItems:'center',justifyContent:'center'}}>{team&&!failed?
    <Image accessibilityLabel={`${name} logo`} source={team.logo} onError={()=>setFailed(true)} resizeMode="contain" style={{width:size*.82,height:size*.82}}/>:
    <Text style={{color:colors.text,fontWeight:'800',fontSize:size*.3}}>{name.split(' ').slice(0,2).map(n=>n[0]).join('')}</Text>}</View>;
}
export const percent=(value:number|null)=>value===null?'—':`${Math.round(value*100)}%`;
export const marketLabel=(market:Market)=>market.kind==='moneyline'?'Winner':market.kind==='spread'?'Spread':market.kind==='total_points'?'Total points':'Season';
export function GameCard({game,onOpen,onBuy,disabled,api,updatedAt}:{game:Game;onOpen:(market:Market)=>void;onBuy:(market:Market,side:'yes'|'no')=>void;disabled:boolean;api:Api;updatedAt:number}){
  const [expanded,setExpanded]=useState<string|null>(null);
  return <View style={s.gameCard}><View style={s.gameHeader}><Text style={styles.label}>NCAA FOOTBALL</Text><Text style={s.small}>{game.startsAt?new Date(game.startsAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Season'}</Text></View>
    <View style={s.matchup}>{[game.away||game.featured.opposite,game.home||game.featured.title].map((team,i)=><React.Fragment key={team}>{i===1&&<Text style={s.at}>@</Text>}<View style={s.team}><TeamLogo name={team} size={46}/><Text style={s.teamName}>{team}</Text></View></React.Fragment>)}</View>
    <View style={{gap:1}}>{game.markets.map(m=><View key={m.id}><Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`${marketLabel(m)}: ${m.title} ${percent(m.price)}, ${m.opposite} ${percent(m.price===null?null:1-m.price)}. ${expanded===m.id?'Hide':'Show'} chart.`} accessibilityState={{expanded:expanded===m.id,disabled}} onPress={()=>setExpanded(current=>current===m.id?null:m.id)} style={({pressed})=>[s.marketRow,{opacity:pressed?.65:1}]}>
      <Text style={s.marketType}>{marketLabel(m)}</Text><View style={s.outcome}><Text numberOfLines={2} style={s.outcomeName}>{m.title}</Text><Text style={s.probability}>{percent(m.price)}</Text></View><View style={s.outcome}><Text numberOfLines={2} style={s.outcomeName}>{m.opposite}</Text><Text style={[s.probability,{color:colors.text}]}>{percent(m.price===null?null:1-m.price)}</Text></View><View style={{transform:[{rotate:expanded===m.id?'90deg':'0deg'}]}}><Icon name="arrow" size={15} color={colors.muted}/></View>
    </Pressable><ExpandingMarket open={expanded===m.id}><MarketPreviewChart market={m} api={api} updatedAt={updatedAt}/><View style={{flexDirection:'row',gap:10,paddingHorizontal:16,paddingBottom:8}}>{(['yes','no'] as const).map(side=>{const tone=outcomeTone(m,side),name=side==='yes'?m.title:m.opposite,quote=side==='yes'?m.yesAsk:m.noAsk,unavailable=disabled||quote===null;return <Pressable key={side} accessibilityRole="button" accessibilityLabel={`Buy ${name}`} accessibilityState={{disabled:unavailable}} disabled={unavailable} onPress={()=>onBuy(m,side)} style={({pressed})=>({flex:1,minHeight:52,padding:10,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:tone.primary,opacity:unavailable?.5:pressed?.7:1})}><Text style={{color:'#fff',fontWeight:'700',textAlign:'center'}}>Buy {name}</Text><Text style={{color:'#fff',fontSize:12,marginTop:4}}>{quote===null?'No quote':`${(quote*100).toFixed(1).replace(/\.0$/,'')}¢`}</Text></Pressable>;})}</View><Pressable accessibilityRole="button" disabled={disabled} onPress={()=>onOpen(m)} style={{minHeight:44,paddingHorizontal:16,justifyContent:'center',alignItems:'flex-end'}}><Text style={{color:colors.accent,fontWeight:'600'}}>Market details & trade →</Text></Pressable></ExpandingMarket></View>)}</View><Text style={s.cardFoot}>Market probabilities · {process.env.EXPO_PUBLIC_UI_PREVIEW==='true'?'Sample data':'Indicative prices'}</Text>
  </View>;
}
function ExpandingMarket({open,children}:{open:boolean;children:React.ReactNode}){
  const height=useRef(new Animated.Value(0)).current;
  const [measured,setMeasured]=useState(0),[mounted,setMounted]=useState(open);
  const reduced=useReducedMotion();
  useEffect(()=>{if(open)setMounted(true);},[open]);
  useEffect(()=>{
    const animation=Animated.timing(height,{toValue:open?measured:0,duration:reduced?0:260,easing:Easing.inOut(Easing.cubic),useNativeDriver:false});
    animation.start();
    return()=>animation.stop();
  },[open,measured,reduced,height]);
  return <Animated.View pointerEvents={open?'auto':'none'} accessibilityElementsHidden={!open} importantForAccessibility={open?'auto':'no-hide-descendants'} style={{height,overflow:'hidden'}}>
    {mounted&&<View onLayout={event=>setMeasured(event.nativeEvent.layout.height)} style={{position:'absolute',top:0,left:0,right:0}}>{children}</View>}
  </Animated.View>;
}
export function MarketPreviewChart({market,api,updatedAt}:{market:Market;api:Api;updatedAt:number}){
  const [data,setData]=useState<ChartData|null>(null),[status,setStatus]=useState('Loading price history…');
  useEffect(()=>{
    let active=true;
    api<ChartData>(`market-detail?symbol=${encodeURIComponent(market.id)}&range=1D`).then(result=>{
      if(active){setData(result);setStatus('');}
    }).catch(()=>{if(active){setData(null);setStatus('Price history unavailable.');}});
    return()=>{active=false;};
  },[api,market.id,updatedAt]);
  const samples=(data?.candles||[]).filter(c=>Number.isFinite(c.time)&&Number.isFinite(c.close)&&c.close>=0&&c.close<=1).sort((a,b)=>a.time-b.time);
  const start=data?.start??samples[0]?.time??0,end=data?.end??samples.at(-1)?.time??1;
  const x=(time:number)=>6+(time-start)/Math.max(1,end-start)*308,y=(price:number)=>6+(1-price)*68;
  const line=(opposite:boolean)=>samples.map((c,i)=>`${i===0||c.time-samples[i-1].time>900000?'M':'L'}${x(c.time)},${y(opposite?1-c.close:c.close)}`).join(' ');
  return <View style={{paddingHorizontal:16,paddingBottom:14,gap:5}}>
    <View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={s.small}>Probability · past 24h</Text><Text style={s.small}>0–100%</Text></View>
    {samples.length>1?<View accessibilityRole="image" accessibilityLabel={`Past 24 hours: ${market.title} in green; ${market.opposite} in purple. Probability from 0 to 100 percent.`}><Svg width="100%" height={80} viewBox="0 0 320 80">
      {[0,.5,1].map(p=><Line key={p} x1={6} x2={314} y1={y(p)} y2={y(p)} stroke={colors.border} strokeDasharray="3 5"/>)}
      <Path d={line(true)} fill="none" stroke={colors.plum} strokeWidth={1.8}/><Path d={line(false)} fill="none" stroke={colors.accent} strokeWidth={2.2}/>
      <Circle cx={x(samples.at(-1)!.time)} cy={y(samples.at(-1)!.close)} r={3} fill={colors.accent}/>
    </Svg></View>:<View style={{height:80,justifyContent:'center',alignItems:'center'}}><Text style={s.small}>{status||'No price history in the past 24 hours.'}</Text></View>}
    <View style={{flexDirection:'row',gap:12,flexWrap:'wrap'}}>{[{name:market.title,color:colors.accent},{name:market.opposite,color:colors.plum}].map(item=><Text key={item.name} style={[s.small,{color:item.color}]}>● {item.name}</Text>)}</View>
  </View>;
}
export type ChartData={candles:Candle[]|null;start?:number;end?:number;fetchedAt?:number;range?:string};
export function ProbabilityChart({data,market,range,onRange,disabled,buys=[]}:{data:ChartData|null;market:Market;range:string;onRange:(range:string)=>void;disabled:boolean;buys?:{id:string;name:string;time:number;price:number}[]}){
  const samples=(data?.candles||[]).filter(c=>Number.isFinite(c.time)&&Number.isFinite(c.close)&&c.close>=0&&c.close<=1).sort((a,b)=>a.time-b.time);
  const w=330,h=180,pad=8,right=296;
  const min=samples[0]?.time||0,max=samples.at(-1)?.time||1;
  const x=(t:number)=>pad+(t-min)/Math.max(1,max-min)*(right-pad),y=(p:number)=>pad+(1-p)*(h-pad*2);
  const gapMs=range==='1H'?180000:range==='1D'?900000:range==='1W'?10800000:259200000;
  const line=(opposite=false)=>samples.map((c,i)=>`${i===0||c.time-samples[i-1].time>gapMs?'M':'L'}${x(c.time).toFixed(1)},${y(opposite?1-c.close:c.close).toFixed(1)}`).join(' ');
  return <View style={{gap:18}}><View style={{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'}}><View><Text style={styles.muted}>Market probability</Text><Text style={s.bigPercent}>{percent(market.price)}</Text></View><Text style={s.small}>{marketLabel(market)} · {process.env.EXPO_PUBLIC_UI_PREVIEW==='true'?'Sample history':'Price history'}</Text></View>
    {samples.length>1?<View accessibilityLabel={`${range} probability chart for ${market.title} and ${market.opposite}`}><Svg width="100%" height={190} viewBox={`0 0 ${w} ${h}`}>
      {[0,.25,.5,.75,1].map(p=><Line key={p} x1={pad} x2={right} y1={y(p)} y2={y(p)} stroke={colors.border} strokeWidth={.6} strokeDasharray="3 5"/>)}
      {[0,.5,1].map(p=><SvgText key={p} x={right+8} y={y(p)+4} fill={colors.muted} fontSize={9}>{Math.round(p*100)}%</SvgText>)}
      <Path d={line(true)} fill="none" stroke={colors.plum} strokeWidth={2} opacity={.8}/><Path d={line()} fill="none" stroke={colors.accent} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"/>
      {buys.filter(b=>b.time>=min&&b.time<=max).map((b,i)=><React.Fragment key={b.id}><Circle cx={x(b.time)} cy={y(b.price)} r={5} fill={colors.plum} stroke={colors.card} strokeWidth={2}/><SvgText x={Math.max(20,Math.min(right-25,x(b.time)))} y={Math.max(12,Math.min(h-5,y(b.price)+(i%2?18:-10)))} fill={colors.plum} fontSize={9} textAnchor="middle">{b.name}</SvgText></React.Fragment>)}
      <Circle cx={x(samples.at(-1)!.time)} cy={y(samples.at(-1)!.close)} r={4} fill={colors.accent}/>
    </Svg><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={s.small}>{new Date(samples[0].time).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</Text><Text style={s.small}>{new Date(samples.at(-1)!.time).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</Text></View></View>:
      <View style={{height:180,alignItems:'center',justifyContent:'center'}}><Text style={styles.muted}>Price history is unavailable for this period.</Text></View>}
    <View style={{flexDirection:'row',gap:5}}>{['1H','1D','1W','ALL'].map(period=><Pressable key={period} accessibilityRole="button" accessibilityState={{selected:range===period,disabled}} disabled={disabled} onPress={()=>onRange(period)} style={{flex:1,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:range===period?colors.card:'transparent'}}><Text style={{fontSize:13,fontWeight:'600',color:range===period?colors.accent:colors.muted}}>{period==='ALL'?'All':period}</Text></Pressable>)}</View>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:16}}>{[{name:market.title,color:colors.accent},{name:market.opposite,color:colors.plum}].map(item=><View key={item.name} style={{flexDirection:'row',gap:6,alignItems:'center'}}><View style={{height:6,width:6,borderRadius:3,backgroundColor:item.color}}/><Text style={s.small}>{item.name}</Text></View>)}</View>
  </View>;
}
const s=StyleSheet.create({
  tabs:{flexDirection:'row',padding:6,borderRadius:34},tab:{flex:1,alignItems:'center',justifyContent:'center',gap:3,minHeight:58},tabIcon:{width:52,height:32,alignItems:'center',justifyContent:'center',borderRadius:16},
  gameCard:{backgroundColor:colors.card,borderRadius:22,overflow:'hidden',borderWidth:1,borderColor:colors.border},gameHeader:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:18,paddingTop:17},small:{fontSize:11,lineHeight:16,color:colors.muted},
  matchup:{flexDirection:'row',alignItems:'center',justifyContent:'center',padding:20,gap:16},team:{flex:1,alignItems:'center',gap:10},teamName:{color:colors.text,fontSize:15,fontWeight:'600',textAlign:'center'},at:{color:colors.muted,fontSize:13},
  marketRow:{paddingHorizontal:16,paddingVertical:12,minHeight:68,flexDirection:'row',alignItems:'center',gap:9,borderTopWidth:1,borderColor:colors.border},marketType:{color:colors.muted,fontSize:11,width:52},outcome:{flex:1,gap:5},outcomeName:{fontSize:11,color:colors.muted,lineHeight:14},probability:{color:colors.accent,fontSize:20,fontWeight:'600',fontVariant:['tabular-nums']},cardFoot:{fontSize:10,color:colors.muted,paddingHorizontal:16,paddingBottom:13,paddingTop:3},bigPercent:{fontSize:48,fontWeight:'600',color:colors.accent,letterSpacing:-2},
});
