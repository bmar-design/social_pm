import {readLay,type Lay} from './lays';
import {LayCard} from './LayWorkflow';
import {useReducedMotion} from './GlassTabs';
import {GlassSurface} from './GlassSurface';
import React, {useState, useEffect, useRef, useId} from 'react';
import Svg,{Path,Line,Circle,Defs,LinearGradient,Stop,Rect,Text as SvgText} from 'react-native-svg';
import {Animated, Pressable, Text, View, TextInput} from 'react-native';
import type {Api} from './api';
import {colors, styles, Button, StanceButton, money} from './ui';
import {ProbabilityChart, type ChartData, Icon, TeamLogo, teamColor} from './FootballUI';
export type Proposal = {id:string;author:string;authorName:string;symbol:string;title:string;opposite:string;side:string;note:string;created:number;tails:number;fades:number;myStance?:string;trade_id?:string;tradeContracts?:number;tradeCost?:number;tradePrice?:number;tradeCreated?:number;contracts?:number;cost_cents?:number};
type Message = {id:string;author:string;authorName:string;body:string;created:number};
type Reaction = {target_id:string;emoji:string;count:number;mine:number};
function SharedPick({proposal:p,busy,onSelect,onReact,children}:{proposal:Proposal;busy:boolean;onSelect:(id:string)=>void;onReact:()=>void;children:React.ReactNode}) {
  const total=p.tails+p.fades, tailShare=total?p.tails/total:.5;
  const tail=useRef(new Animated.Value(tailShare)).current,reduced=useReducedMotion();
  const [split,setSplit]=useState(tailShare);
  const gradientId=`pick-${useId().replace(/[^a-zA-Z0-9-]/g,'')}`;
  useEffect(()=>{
    const listener=tail.addListener(({value})=>setSplit(value));
    return()=>tail.removeListener(listener);
  },[tail]);
  useEffect(()=>{
    tail.stopAnimation();
    if(reduced){tail.setValue(tailShare);setSplit(tailShare);return;}
    const animation=Animated.timing(tail,{toValue:tailShare,duration:450,useNativeDriver:false});
    animation.start();return()=>animation.stop();
  },[tailShare,reduced,tail]);
  const title=p.side==='yes'?p.title:p.opposite,opponent=p.side==='yes'?p.opposite:p.title;
  const buyPrice=p.tradePrice!=null&&Number.isFinite(p.tradePrice)?`${Number((p.tradePrice/10000).toFixed(2))}¢`:null;
  // Center the soft blend on the vote split; unanimous votes fill one color.
  const blend=Math.min(.18,split,1-split);
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${p.authorName}'s shared pick: ${title}. ${p.tails} Tail, ${p.fades} Fade.`} accessibilityHint="Hold to react." accessibilityActions={[{name:'react',label:'React to pick'}]} onAccessibilityAction={event=>{if(event.nativeEvent.actionName==='react')onReact();}} disabled={busy} onPress={()=>onSelect(p.id)} onLongPress={onReact} delayLongPress={400} style={{width:'90%',maxWidth:380,padding:15,gap:8,borderRadius:18,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,overflow:'hidden'}}>
    {!!total&&<View pointerEvents="none" style={{position:'absolute',top:0,bottom:0,left:0,right:0,opacity:.12}}>
      <Svg width="100%" height="100%">
        <Defs><LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset={`${(split-blend)*100}%`} stopColor={split===0?teamColor(opponent):teamColor(title)}/>
          <Stop offset={`${(split+blend)*100}%`} stopColor={split===1?teamColor(title):teamColor(opponent)}/>
        </LinearGradient></Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`}/>
      </Svg>
    </View>}
    <View style={{gap:12}}>
      <Text style={[styles.label,{color:colors.muted,fontSize:11}]}>SHARED PICK</Text>
      <View style={{flexDirection:'row',gap:12,alignItems:'center'}}><TeamLogo name={title} size={38}/><View style={{flex:1,gap:3}}><Text style={{color:colors.text,fontSize:18,lineHeight:24,fontWeight:'600'}}>{title}</Text><Text style={{color:colors.muted,fontSize:12,lineHeight:18}}>vs {opponent} · {buyPrice?`Bought at ${buyPrice}`:'Buy price unavailable'}</Text></View><Icon name="arrow" size={16}/></View>
      {!!p.note&&<Text style={styles.text}>{p.note}</Text>}
      <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8,paddingTop:12,borderTopWidth:1,borderTopColor:colors.border}}><Text style={{color:colors.text,fontSize:12}}>{p.tails} Tail · {p.fades} Fade</Text><Text style={{color:colors.muted,fontSize:12}}>View position →</Text></View>
    </View>
    {children}
  </Pressable>;
}
export function SquadConversation({proposals,messages,reactions,userId,busy,onSelect,onReact,onLay}:{proposals:Proposal[];messages:Message[];reactions:Reaction[];userId?:string;busy:boolean;onSelect:(id:string)=>void;onReact:(targetId:string,emoji:string,active:boolean)=>void;onLay:(lay:Lay,id:string)=>void}) {
  const [picker,setPicker]=useState<string|null>(null);
  const messageMeta=(p:Message|Proposal)=><Text style={{color:colors.muted,fontSize:11,textAlign:'right'}}>{new Date(p.created).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</Text>;
  const ordered=[...proposals.map(p=>({...p,kind:'proposal' as const})),...messages.map(m=>({...m,kind:'message' as const}))].sort((a,b)=>a.created-b.created);
  return <View style={{gap:18}}>{!ordered.length&&<Text style={[styles.muted,{textAlign:'center',padding:24}]}>Start the conversation. Say hello to your group.</Text>}{ordered.map((p,i)=>{const lay=p.kind==='message'?readLay(p.body):null, own=p.author===userId, previous=ordered[i-1], attached=reactions.filter(r=>r.target_id===p.id);return <View key={p.kind+p.id} style={{gap:10}}>
    {(!previous||new Date(previous.created).toDateString()!==new Date(p.created).toDateString())&&<Text style={[styles.muted,{textAlign:'center',fontSize:11}]}>{new Date(p.created).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}</Text>}
    <View style={{alignItems:own?'flex-end':'flex-start',gap:5}}><Text style={[styles.muted,{fontSize:11,marginHorizontal:8}]}>{own?'You':p.authorName}</Text>
      {p.kind==='proposal'?<SharedPick proposal={p} busy={busy} onSelect={onSelect} onReact={()=>setPicker(p.id)}>{messageMeta(p)}</SharedPick>:<Pressable accessibilityRole="button" accessibilityLabel={`${p.authorName}: ${lay?lay.name:p.body}`} accessibilityHint="Hold to react." accessibilityActions={[{name:'react',label:'React to message'}]} onAccessibilityAction={event=>{if(event.nativeEvent.actionName==='react'&&!busy)setPicker(p.id);}} disabled={busy} onLongPress={()=>setPicker(p.id)} delayLongPress={400} style={{maxWidth:'88%',padding:12,gap:9,borderRadius:18,borderBottomLeftRadius:own?18:4,borderBottomRightRadius:own?4:18,backgroundColor:own?colors.accentSoft:colors.card}}>
        <>{lay?<LayCard lay={lay} author={p.authorName} onOpen={()=>onLay(lay,p.id)}/>:<Text style={styles.text}>{p.body}</Text>}</>
        {messageMeta(p)}
      </Pressable>}
      {!!attached.length&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:5,maxWidth:'88%'}}>{attached.map(r=><Pressable key={r.emoji} accessibilityRole="button" accessibilityLabel={`${r.emoji}, ${r.count} reactions`} accessibilityState={{selected:!!r.mine}} disabled={busy} onPress={()=>onReact(p.id,r.emoji,!r.mine)} style={{padding:8,borderRadius:18,borderWidth:1,borderColor:r.mine?colors.accent:colors.border,backgroundColor:r.mine?colors.accentSoft:colors.card}}><Text>{r.emoji} {r.count}</Text></Pressable>)}</View>}
      {picker===p.id&&<View style={{flexDirection:'row',flexWrap:'wrap',borderRadius:22,backgroundColor:colors.card,padding:4}}>{['👍','❤️','😂','🔥','👀','👎'].map(emoji=><Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`React ${emoji}`} disabled={busy} onPress={()=>{onReact(p.id,emoji,!attached.find(r=>r.emoji===emoji)?.mine);setPicker(null);}} style={{padding:10,minHeight:44}}><Text style={{fontSize:22}}>{emoji}</Text></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel="Close reactions" onPress={()=>setPicker(null)} style={{padding:10,minHeight:44,justifyContent:'center'}}><Text style={styles.muted}>✕</Text></Pressable></View>}
    </View></View>})}
  </View>;
}
export function ChatComposer({busy,onSend}:{busy:boolean;onSend:(text:string)=>Promise<boolean>}) {
  const [draft,setDraft]=useState('');
  return <View style={{paddingHorizontal:14,paddingTop:6,paddingBottom:2}}><GlassSurface dense style={{flexDirection:'row',gap:8,alignItems:'flex-end',padding:7,borderRadius:28}}><TextInput accessibilityLabel="Message your group" placeholder="Message your group…" placeholderTextColor={colors.muted} multiline maxLength={2000} value={draft} onChangeText={setDraft} style={[styles.input,{flex:1,maxHeight:130,fontSize:15,minHeight:46,backgroundColor:'#fff8ef',borderWidth:0,paddingVertical:11,paddingHorizontal:12}]}/><Button title="Send" disabled={busy||!draft.trim()} onPress={()=>{const sent=draft;void onSend(sent).then(ok=>{if(ok)setDraft(current=>current===sent?'':current);});}}/></GlassSurface></View>;
}
export function PositionPriceChart({proposal,peers,api,compact=false}:{proposal:Proposal;peers:Proposal[];api:Api;compact?:boolean}) {
  const [range,setRange]=useState('1D'),[data,setData]=useState<ChartData & {market:any}|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let active=true;setLoading(true);setError('');setData(null);void api(`market-detail?symbol=${encodeURIComponent(proposal.symbol)}&range=${range}`).then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e.message||'Chart unavailable.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[proposal.symbol,range,api]);
  const buys=peers.filter(p=>p.tradePrice!=null&&p.tradeCreated!=null);
  if(compact){
    const candles=data?.candles||[],start=candles[0]?.time||0,end=candles.at(-1)?.time||1;
    const x=(time:number)=>12+(time-start)/Math.max(1,end-start)*276,y=(price:number)=>12+(1-price)*80;
    const line=candles.map((c,i)=>`${i?'L':'M'}${x(c.time)},${y(c.close)}`).join(' ');
    return <View style={{height:150,gap:4}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={[styles.muted,{fontSize:10}]}>Price · 24h</Text><Text style={[styles.text,{fontWeight:'600',fontSize:12,lineHeight:18}]}>{data?.market.price==null?'—':`${Math.round(data.market.price*100)}%`} {proposal.title}</Text></View>
      {loading||error||candles.length<2?<View style={{height:110,justifyContent:'center',alignItems:'center'}}><Text style={styles.muted}>{loading?'Loading price chart…':error||'Price history unavailable'}</Text></View>:<Svg accessibilityLabel={`24-hour price chart for ${proposal.title}, with friends’ shared buys`} width="100%" height={110} viewBox="0 0 330 110">{[0,.5,1].map(price=><React.Fragment key={price}><Line x1={12} x2={288} y1={y(price)} y2={y(price)} stroke={colors.border} strokeDasharray="3 4"/><SvgText x={295} y={y(price)+4} fill={colors.muted} fontSize={9}>{price*100}%</SvgText></React.Fragment>)}<Path d={line} fill="none" stroke={colors.primary} strokeWidth={2.5}/>{buys.filter(p=>p.tradeCreated!>=start&&p.tradeCreated!<=end).map(p=><React.Fragment key={p.id}><Circle cx={x(p.tradeCreated!)} cy={y(p.side==='yes'?p.tradePrice!/1000000:1-p.tradePrice!/1000000)} r={5} fill={colors.plum} stroke={colors.card} strokeWidth={2}/><SvgText x={Math.max(28,Math.min(265,x(p.tradeCreated!)))} y={Math.max(12,y(p.side==='yes'?p.tradePrice!/1000000:1-p.tradePrice!/1000000)-10)} textAnchor="middle" fill={colors.plum} fontSize={9}>{p.authorName}</SvgText></React.Fragment>)}</Svg>}
      <Text style={[styles.muted,{fontSize:10}]}>{process.env.EXPO_PUBLIC_UI_PREVIEW==='true'?'Sample prices':'Indicative prices'} · Dots: friends’ buys</Text>
    </View>;
  }
  return <View style={styles.card}><Text style={styles.heading}>{proposal.title} / {proposal.opposite}</Text>{loading&&<Text style={styles.muted}>Loading price chart…</Text>}{!!error&&<Text accessibilityRole="alert" style={styles.muted}>{error}</Text>}{data&&<ProbabilityChart data={data} market={data.market} range={range} onRange={setRange} disabled={loading} buys={buys.map(p=>({id:p.trade_id||p.id,name:p.authorName,time:p.tradeCreated!,price:p.side==='yes'?p.tradePrice!/1000000:1-p.tradePrice!/1000000}))}/>}<Text style={styles.label}>FRIENDS’ SHARED BUYS</Text><Text style={[styles.muted,{fontSize:11}]}>Named dots show buys within the selected chart period. Buy prices below refer to each friend’s chosen outcome.</Text>{buys.length?buys.map(p=><Text key={p.id} style={styles.muted}>{p.authorName} · {p.side==='yes'?p.title:p.opposite} at {Math.round(p.tradePrice!/10000)}¢ · {new Date(p.tradeCreated!).toLocaleString()}</Text>):<Text style={styles.muted}>No shared buy prices yet.</Text>}</View>;
}
export function ProposalPosition({proposal,proposals,busy,api,onBack,onMarket,onRespond}:{proposal:Proposal;proposals:Proposal[];busy:boolean;api:Api;onBack:()=>void;onMarket:()=>void;onRespond:(stance:string)=>void}) {
  const peers=proposals.filter(p=>p.symbol===proposal.symbol);
  // A trade can be shared more than once; count each recorded fill once.
  const seen=new Set<string>();
  const buys=peers.filter(p=>{const key=p.trade_id||p.id;const valid=(p.tradeContracts??p.contracts??0)>0;if(!valid||seen.has(key))return false;seen.add(key);return true;});
  const users=Array.from(new Set(buys.map(p=>p.author))).map(id=>({id,name:buys.find(p=>p.author===id)!.authorName,contracts:buys.filter(p=>p.author===id).reduce((n,p)=>n+(p.tradeContracts??p.contracts??0),0)}));
  const max=Math.max(1,...users.map(u=>u.contracts));
  return <View style={{gap:18}}><Text style={styles.title}>{proposal.authorName}’s Proposal</Text><PositionPriceChart key={proposal.symbol} proposal={proposal} peers={peers} api={api}/><Button title="Hide details" secondary onPress={onBack}/><View style={styles.card}><Text style={styles.label}>PROPOSAL · {proposal.authorName}</Text><Text style={styles.title}>{proposal.side==='yes'?proposal.title:proposal.opposite}</Text><Text style={styles.muted}>{proposal.title} / {proposal.opposite}</Text>{!!proposal.note&&<Text style={styles.text}>{proposal.note}</Text>}<Text style={styles.muted}>{new Date(proposal.created).toLocaleString()}</Text>{(proposal.tradeContracts??proposal.contracts)!=null&&<Text style={styles.text}>{proposal.tradeContracts??proposal.contracts} contracts · {money(proposal.tradeCost??proposal.cost_cents??0)} practice buy</Text>}<View style={styles.row}>{(['tail','fade'] as const).map(stance=><StanceButton key={stance} stance={stance} count={stance==='tail'?proposal.tails:proposal.fades} selected={proposal.myStance===stance} disabled={busy} onPress={()=>onRespond(proposal.myStance===stance?'none':stance)}/>)}</View><Text style={[styles.muted,{fontSize:11}]}>Responses are opinions. No order is placed.</Text><Button title="Market details & price chart" secondary disabled={busy} onPress={onMarket}/></View>
    <View style={styles.card}><Text style={styles.heading}>Buys / sells by user</Text><Text style={styles.muted}>Shared practice buys · contracts</Text><View style={styles.row}><Text style={{color:colors.accent}}>● Buys</Text><Text style={{color:colors.plum}}>● Sells unavailable</Text></View>
      {users.length?users.map(u=><View key={u.id} accessibilityLabel={`${u.name}: ${u.contracts} bought contracts; sell data unavailable`} style={{gap:7}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={styles.text}>{u.name}</Text><Text style={styles.muted}>{u.contracts} bought</Text></View><View style={{height:14,borderRadius:7,backgroundColor:colors.accentSoft,overflow:'hidden'}}><View style={{height:14,width:`${u.contracts/max*100}%`,backgroundColor:colors.primary,borderRadius:7}}/></View></View>):<Text style={styles.muted}>No buys have been shared for this market yet.</Text>}
      <Text style={[styles.muted,{fontSize:11}]}>Only shared buys appear here. Sell activity is not recorded yet. Tail/Fade responses are not trades.</Text>
    </View><Text style={styles.heading}>Group proposals on this market</Text>{peers.map(p=><View key={p.id} style={{paddingVertical:10,borderBottomWidth:1,borderColor:colors.border}}><Text style={styles.text}>{p.authorName} → {p.side==='yes'?p.title:p.opposite}</Text><Text style={styles.muted}>{p.tails} Tail · {p.fades} Fade</Text></View>)}</View>;
}
