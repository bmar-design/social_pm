import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from './ui';
import { Icon, TeamLogo } from './FootballUI';
import type { Game } from '../../hosted/lib/game-model';
import type { Market } from '../../hosted/lib/market-model';

type Group = { id: string; name: string; memberCount: number; proposalCount: number };
export function SquadAvatar({ name, small = false }: { name: string; small?: boolean }) {
  return <View style={[s.avatarWrap, small && { width: 48, height: 48 }]}><View style={[s.avatar, small && { width: 38, height: 38 }]}><Text style={s.initial}>{name.trim()[0]?.toUpperCase() || 'S'}</Text></View><View style={s.avatarBadge}><Icon name="groups" size={13} color={colors.card}/></View></View>;
}
function Action({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.circle, { opacity: pressed ? .6 : 1 }]}>{children}</Pressable>;
}
export function SquadDirectory({ groups, games, busy, onOpen, onCreate, onMarket }: { groups: Group[]; games: Game[]; busy: boolean; onOpen: (id: string) => void; onCreate: () => void; onMarket: (market: Market) => void }) {
  const [search, setSearch] = useState('');
  const filtered = groups.filter(g => g.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <View style={s.directory}>
    <View style={s.row}><View><Text style={s.pageTitle}>Groups</Text><Text style={s.muted}>Your people. Your next play.</Text></View><Action label="Create or join a group" onPress={onCreate}><Icon name="plus"/></Action></View>
    <View style={s.search}><Icon name="search" size={20} color={colors.muted}/><TextInput accessibilityLabel="Search groups" placeholder="Search groups…" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={s.searchInput}/>{!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={()=>setSearch('')}><Text style={s.muted}>Clear</Text></Pressable>}</View>
    {!!games.length && <View style={s.rail}><Text style={s.caption}>ON THE BOARD</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.matchups}>{games.slice(0, 6).map(game => <Pressable key={game.id} accessibilityRole="button" accessibilityLabel={`Open ${game.name}`} disabled={busy} onPress={()=>onMarket(game.featured)} style={s.matchup}><Text numberOfLines={1} style={s.gameTime}>{game.startsAt ? new Date(game.startsAt).toLocaleDateString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'Season'}</Text>{[game.away || game.featured.opposite, game.home || game.featured.title].map((team, i)=><View key={team} style={s.team}><TeamLogo name={team} size={22}/><Text numberOfLines={1} style={s.teamName}>{team}</Text><Text style={[s.odds, i===0 && {color:colors.plum}]}>{game.featured.price===null ? '—' : `${Math.round((i===0 ? 1-game.featured.price : game.featured.price)*100)}%`}</Text></View>)}</Pressable>)}</ScrollView></View>}
    <Pressable accessibilityRole="button" onPress={onCreate} style={s.invite}><View style={{flex:1,gap:5}}><Text style={s.heading}>Bring your group chat</Text><Text style={s.muted}>Make a group. Share your picks.</Text></View><View style={s.inviteIcon}><Icon name="groups" size={27} color={colors.accent}/></View></Pressable>
    <Pressable accessibilityRole="button" onPress={onCreate} style={s.create}><View style={s.circle}><Icon name="groups"/></View><Text style={[s.heading,{flex:1}]}>Create or join a group</Text><Icon name="arrow" size={20} color={colors.muted}/></Pressable>
    <View style={s.sectionHeading}><Text style={s.heading}>Your groups</Text><Text style={s.count}>{groups.length}</Text></View>
    {filtered.map(g=><Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`Open ${g.name}`} disabled={busy} onPress={()=>onOpen(g.id)} style={s.squadRow}><SquadAvatar name={g.name}/><View style={{flex:1,gap:5}}><Text style={s.heading}>{g.name}</Text><Text style={s.muted}>{g.proposalCount ? `${g.proposalCount} shared ${g.proposalCount===1?'play':'plays'}` : 'Share the first play with your group'}</Text></View><Text style={s.memberCount}>{g.memberCount} {g.memberCount===1?'member':'members'}</Text></Pressable>)}
    {!filtered.length && <View style={s.empty}><Icon name="groups" size={32} color={colors.muted}/><Text style={s.heading}>{search?'No groups found':'Better with your people'}</Text><Text style={s.emptyCopy}>{search?'Try another group name.':'Create a group or open an invite to get started.'}</Text></View>}
  </View>;
}
export function SquadHeader({name, count, active, onTab, onBack, onInvite, onMembers}: {name:string;count:number;active:'Chat'|'Positions';onTab:(tab:'Chat'|'Positions')=>void;onBack:()=>void;onInvite:()=>void;onMembers:()=>void}) {
  return <View style={{gap:22}}><View style={[s.row,{gap:10}]}><Pressable accessibilityRole="button" accessibilityLabel="Back to groups" onPress={onBack} style={s.back}><Icon name="back"/></Pressable><SquadAvatar name={name} small/><Pressable accessibilityRole="button" accessibilityLabel="View group members" onPress={onMembers} style={{flex:1,gap:3}}><Text numberOfLines={1} style={s.heading}>{name}</Text><Text style={s.muted}>{count} {count===1?'member':'members'}</Text></Pressable><Action label="Invite friends" onPress={onInvite}><Icon name="plus" size={22}/></Action></View><View accessibilityRole="tablist" style={s.segment}>{(['Chat','Positions'] as const).map(tab=><Pressable key={tab} accessibilityRole="tab" accessibilityState={{selected:active===tab}} onPress={()=>onTab(tab)} style={[s.segmentTab,active===tab&&s.selected]}><Text style={[s.tabText,active===tab&&{color:colors.text,fontWeight:'600'}]}>{tab}</Text></Pressable>)}</View></View>;
}
export function SquadEmpty({positions,onBrowse}: {positions:boolean;onBrowse:()=>void}) {
  return <View style={s.empty}><View style={s.emptyIcon}><Icon name={positions?'football':'groups'} size={30} color={colors.accent}/></View><Text style={s.emptyTitle}>{positions?'NO POSITIONS YET':'START THE CONVERSATION'}</Text><Text style={s.emptyCopy}>{positions?'Find a market and share your practice picks with the group.':'Every great game starts with a take. Share your first play with your people.'}</Text><Pressable accessibilityRole="button" onPress={onBrowse} style={s.browse}><Text style={s.browseText}>Browse markets</Text></Pressable></View>;
}
type SharedPick = { id:string; symbol:string; title:string; opposite:string; side:string; authorName:string; myStance?:string; tails:number; fades:number };
export function SquadPositions({proposals,busy,onOpen}: {proposals:SharedPick[];busy:boolean;onOpen:(symbol:string)=>void}) {
  const markets = Array.from(new Set(proposals.map(p=>p.symbol))).map(symbol=>({symbol,picks:proposals.filter(p=>p.symbol===symbol)}));
  return <View style={{gap:16}}>
    <View style={s.positionSummary}><View style={{flex:1,gap:4}}><Text style={s.caption}>SHARED PICKS</Text><Text style={s.pageTitle}>{proposals.length}</Text></View><View style={{flex:1,gap:4}}><Text style={s.caption}>MARKETS</Text><Text style={s.pageTitle}>{markets.length}</Text></View></View>
    <Text style={s.muted}>Picks shared with the group. Holdings and dollar amounts are private.</Text>
    {markets.map(({symbol,picks})=><View key={symbol} style={s.positionCard}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${picks[0].title} market`} disabled={busy} onPress={()=>onOpen(symbol)} style={s.row}><Text style={[s.heading,{flex:1}]}>{picks[0].title} / {picks[0].opposite}</Text><Icon name="arrow" size={18}/></Pressable>
      {(['yes','no'] as const).map(side=>{const selected=picks.filter(p=>p.side===side);return <View key={side} style={s.positionSide}><View style={s.row}><Text style={[s.heading,{fontSize:15,flex:1,color:side==='yes'?colors.accent:colors.plum}]}>{side==='yes'?picks[0].title:picks[0].opposite}</Text><Text style={s.count}>{selected.length} shared</Text></View><Text style={s.muted}>{selected.length?Array.from(new Set(selected.map(p=>p.authorName))).join(', '):'No shared picks'}</Text></View>})}
      {picks.some(p=>p.myStance==='tail'||p.myStance==='fade')&&<Text style={s.muted}>Your responses: {picks.filter(p=>p.myStance==='tail').length} Tail · {picks.filter(p=>p.myStance==='fade').length} Fade</Text>}
      <Pressable accessibilityRole="button" disabled={busy} onPress={()=>onOpen(symbol)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent,fontWeight:'600'}}>View market →</Text></Pressable>
    </View>)}
  </View>;
}
export const squadStyles = StyleSheet.create({
  feedHeading:{fontSize:17,fontWeight:'600',color:colors.text,marginTop:10},
  systemNote:{textAlign:'center',fontSize:13,lineHeight:21,color:colors.muted,paddingVertical:12},
  post:{padding:18,borderRadius:24,backgroundColor:colors.card,gap:14},
  member:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12},
});
const s = StyleSheet.create({
  positionSummary:{flexDirection:'row',padding:20,borderRadius:20,backgroundColor:colors.accentSoft},positionCard:{padding:18,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,gap:16},positionSide:{gap:7,paddingTop:14,borderTopWidth:1,borderColor:colors.border},
  directory:{gap:22},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},pageTitle:{fontSize:30,fontWeight:'600',letterSpacing:-1,color:colors.text,marginBottom:4},
  heading:{fontSize:17,fontWeight:'600',color:colors.text},muted:{fontSize:14,lineHeight:20,color:colors.muted},circle:{width:44,height:44,borderRadius:22,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},
  search:{flexDirection:'row',alignItems:'center',gap:10,borderRadius:20,backgroundColor:colors.accentSoft,paddingHorizontal:16,minHeight:54},searchInput:{flex:1,fontSize:17,color:colors.text,paddingVertical:15,minWidth:0},
  rail:{gap:10},caption:{fontSize:10,letterSpacing:1.5,fontWeight:'600',color:colors.muted},matchups:{flexDirection:'row',gap:8},matchup:{width:156,padding:10,gap:8,borderRadius:16,backgroundColor:colors.card,borderWidth:1,borderColor:colors.border},gameTime:{fontSize:10,color:colors.muted},team:{flexDirection:'row',alignItems:'center',gap:4},teamName:{flex:1,fontSize:12,fontWeight:'600',color:colors.text},odds:{fontSize:12,fontWeight:'700',color:colors.accent},
  invite:{padding:18,borderWidth:1,borderColor:colors.border,borderRadius:22,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:colors.card},inviteIcon:{width:50,height:50,borderRadius:25,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},create:{flexDirection:'row',alignItems:'center',gap:14,paddingBottom:22,borderBottomWidth:1,borderColor:colors.border},sectionHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},count:{fontSize:12,color:colors.muted,backgroundColor:colors.accentSoft,paddingHorizontal:9,paddingVertical:3,borderRadius:10},
  squadRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8},memberCount:{fontSize:11,color:colors.muted,maxWidth:62,textAlign:'right'},avatarWrap:{width:58,height:58},avatar:{width:48,height:48,borderRadius:24,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'},initial:{fontSize:20,fontWeight:'600',color:colors.onPrimary},avatarBadge:{position:'absolute',bottom:0,right:0,width:26,height:26,borderRadius:13,backgroundColor:colors.plum,borderWidth:3,borderColor:colors.bg,alignItems:'center',justifyContent:'center'},
  back:{width:28,minHeight:44,justifyContent:'center'},segment:{flexDirection:'row',padding:4,borderRadius:25,backgroundColor:colors.accentSoft},segmentTab:{flex:1,paddingVertical:10,borderRadius:22,alignItems:'center'},selected:{backgroundColor:colors.card},tabText:{fontSize:16,color:colors.muted},
  empty:{alignItems:'center',paddingVertical:38,paddingHorizontal:22,gap:14,borderRadius:28,backgroundColor:colors.accentSoft,marginTop:4},emptyIcon:{width:60,height:60,borderRadius:30,backgroundColor:colors.card,alignItems:'center',justifyContent:'center',marginBottom:4},emptyTitle:{fontSize:22,fontWeight:'800',letterSpacing:-.6,color:colors.text,textAlign:'center'},emptyCopy:{fontSize:16,lineHeight:23,textAlign:'center',color:colors.muted,maxWidth:320},browse:{paddingHorizontal:20,paddingVertical:16,borderRadius:18,backgroundColor:colors.text,marginTop:10},browseText:{fontSize:16,fontWeight:'600',color:colors.card},
});
