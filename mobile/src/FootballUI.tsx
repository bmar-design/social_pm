import React, { useState } from 'react';
import { Image, Pressable, Text, View, StyleSheet } from 'react-native';
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
  return <View style={s.tabs}>{(['Home','Groups','Profile'] as const).map(tab=><Pressable key={tab} accessibilityRole="tab" accessibilityLabel={tab} accessibilityState={{selected:active===tab}} onPress={()=>onChange(tab)} style={s.tab}>
    <View style={[s.tabIcon,active===tab&&{backgroundColor:'#d8f27916'}]}><Icon name={tab==='Home'?'home':tab==='Groups'?'groups':'profile'} color={active===tab?colors.accent:colors.muted}/></View><Text style={{fontSize:11,fontWeight:'600',color:active===tab?colors.accent:colors.muted}}>{tab}</Text>
  </Pressable>)}</View>;
}
const teams = [
  {names:['michigan state','michigan st','michigan state spartans'],logo:require('../assets/teams/michigan-state.png')},
  {names:['michigan','michigan wolverines'],logo:require('../assets/teams/michigan.png')},
  {names:['ohio state','ohio st','ohio state buckeyes'],logo:require('../assets/teams/ohio-state.png')},
  {names:['penn state','penn st','penn state nittany lions'],logo:require('../assets/teams/penn-state.png')},
  {names:['texas','texas longhorns'],logo:require('../assets/teams/texas.png')},
  {names:['georgia','georgia bulldogs'],logo:require('../assets/teams/georgia.png')},
];
export function TeamLogo({name,size=40}:{name:string;size?:number}){
  const [failed,setFailed]=useState(false);
  const normalized=name.toLowerCase().trim().replace(/\s[+-]\d+(?:\.\d+)?$/,'');
  const team=teams.find(t=>t.names.includes(normalized));
  return <View style={{width:size,height:size,borderRadius:size*.25,backgroundColor:'#ffffff',alignItems:'center',justifyContent:'center'}}>{team&&!failed?
    <Image accessibilityLabel={`${name} logo`} source={team.logo} onError={()=>setFailed(true)} resizeMode="contain" style={{width:size*.82,height:size*.82}}/>:
    <Text style={{color:'#1a211b',fontWeight:'800',fontSize:size*.3}}>{name.split(' ').slice(0,2).map(n=>n[0]).join('')}</Text>}</View>;
}
export const percent=(value:number|null)=>value===null?'—':`${Math.round(value*100)}%`;
export const marketLabel=(market:Market)=>market.kind==='moneyline'?'Winner':market.kind==='spread'?'Spread':market.kind==='total_points'?'Total points':'Season';
export function GameCard({game,onOpen,disabled}:{game:Game;onOpen:(market:Market)=>void;disabled:boolean}){
  return <View style={s.gameCard}><View style={s.gameHeader}><Text style={styles.label}>NCAA FOOTBALL</Text><Text style={s.small}>{game.startsAt?new Date(game.startsAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Season'}</Text></View>
    <View style={s.matchup}>{[game.away||game.featured.opposite,game.home||game.featured.title].map((team,i)=><React.Fragment key={team}>{i===1&&<Text style={s.at}>@</Text>}<View style={s.team}><TeamLogo name={team} size={46}/><Text style={s.teamName}>{team}</Text></View></React.Fragment>)}</View>
    <View style={{gap:1}}>{game.markets.map(m=><Pressable key={m.id} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${marketLabel(m)}: ${m.title} ${percent(m.price)}, ${m.opposite} ${percent(m.price===null?null:1-m.price)}. Open chart.`} onPress={()=>onOpen(m)} style={({pressed})=>[s.marketRow,{opacity:pressed?.65:1}]}>
      <Text style={s.marketType}>{marketLabel(m)}</Text><View style={s.outcome}><Text numberOfLines={2} style={s.outcomeName}>{m.title}</Text><Text style={s.probability}>{percent(m.price)}</Text></View><View style={s.outcome}><Text numberOfLines={2} style={s.outcomeName}>{m.opposite}</Text><Text style={[s.probability,{color:colors.text}]}>{percent(m.price===null?null:1-m.price)}</Text></View><Icon name="arrow" size={15} color={colors.muted}/>
    </Pressable>)}</View><Text style={s.cardFoot}>Market probabilities · {process.env.EXPO_PUBLIC_UI_PREVIEW==='true'?'Sample data':'Indicative prices'}</Text>
  </View>;
}
export type ChartData={candles:Candle[]|null;start?:number;end?:number;fetchedAt?:number;range?:string};
export function ProbabilityChart({data,market,range,onRange,disabled}:{data:ChartData|null;market:Market;range:string;onRange:(range:string)=>void;disabled:boolean}){
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
      <Path d={line(true)} fill="none" stroke="#8fa6bd" strokeWidth={2} opacity={.8}/><Path d={line()} fill="none" stroke={colors.accent} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"/>
      <Circle cx={x(samples.at(-1)!.time)} cy={y(samples.at(-1)!.close)} r={4} fill={colors.accent}/>
    </Svg><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={s.small}>{new Date(samples[0].time).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</Text><Text style={s.small}>{new Date(samples.at(-1)!.time).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</Text></View></View>:
      <View style={{height:180,alignItems:'center',justifyContent:'center'}}><Text style={styles.muted}>Price history is unavailable for this period.</Text></View>}
    <View style={{flexDirection:'row',gap:5}}>{['1H','1D','1W','ALL'].map(period=><Pressable key={period} accessibilityRole="button" accessibilityState={{selected:range===period,disabled}} disabled={disabled} onPress={()=>onRange(period)} style={{flex:1,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:range===period?colors.card:'transparent'}}><Text style={{fontSize:13,fontWeight:'600',color:range===period?colors.accent:colors.muted}}>{period==='ALL'?'All':period}</Text></Pressable>)}</View>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:16}}>{[{name:market.title,color:colors.accent},{name:market.opposite,color:'#8fa6bd'}].map(item=><View key={item.name} style={{flexDirection:'row',gap:6,alignItems:'center'}}><View style={{height:6,width:6,borderRadius:3,backgroundColor:item.color}}/><Text style={s.small}>{item.name}</Text></View>)}</View>
  </View>;
}
const s=StyleSheet.create({
  tabs:{flexDirection:'row',borderTopWidth:1,borderColor:colors.border,paddingTop:7,paddingBottom:7,backgroundColor:colors.bg},tab:{flex:1,alignItems:'center',gap:4,minHeight:56},tabIcon:{width:52,height:32,alignItems:'center',justifyContent:'center',borderRadius:16},
  gameCard:{backgroundColor:colors.card,borderRadius:22,overflow:'hidden',borderWidth:1,borderColor:colors.border},gameHeader:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:18,paddingTop:17},small:{fontSize:11,lineHeight:16,color:colors.muted},
  matchup:{flexDirection:'row',alignItems:'center',justifyContent:'center',padding:20,gap:16},team:{flex:1,alignItems:'center',gap:10},teamName:{color:colors.text,fontSize:15,fontWeight:'600',textAlign:'center'},at:{color:colors.muted,fontSize:13},
  marketRow:{paddingHorizontal:16,paddingVertical:12,minHeight:68,flexDirection:'row',alignItems:'center',gap:9,borderTopWidth:1,borderColor:colors.border},marketType:{color:colors.muted,fontSize:11,width:52},outcome:{flex:1,gap:5},outcomeName:{fontSize:11,color:colors.muted,lineHeight:14},probability:{color:colors.accent,fontSize:20,fontWeight:'600',fontVariant:['tabular-nums']},cardFoot:{fontSize:10,color:colors.muted,paddingHorizontal:16,paddingBottom:13,paddingTop:3},bigPercent:{fontSize:48,fontWeight:'600',color:colors.accent,letterSpacing:-2},
});
