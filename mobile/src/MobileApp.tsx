import {TradePad} from './TradePad';
import {SwipeConfirm} from './SwipeConfirm';
import {useReducedMotion} from './GlassTabs';
import {PortfolioProfile} from './PortfolioProfile';
import {SquadConversation, ChatComposer, PositionPriceChart} from './SquadConversation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Alert, KeyboardAvoidingView, Linking, Modal, Platform, RefreshControl, ScrollView, Share, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { usePrivy } from '@privy-io/expo';
import { apiUrl, createApi } from './api';
import { inviteFromUrl } from './links';
import { Login, RecoveryEmail } from './Auth';
import { Button, StanceButton, colors, Field, money, styles } from './ui';
import { groupGames, simulateBuy } from '../../hosted/lib/game-model';
import type { Market } from '../../hosted/lib/market-model';
import { WalletCheck } from './WalletCheck';
import { SquadDirectory, SquadHeader, SquadEmpty, SquadAvatar, squadStyles } from './SquadUI';
import { GameCard, Icon, IconButton, TabBar, TeamLogo, ProbabilityChart, percent, marketLabel, type ChartData } from './FootballUI';

type Group = { id: string; name: string; memberCount: number; proposalCount: number };
type Trade = { id: string; symbol: string; title: string; opposite: string; side: string; contracts: number; cost_cents: number; created: number };
const pendingKey = 'pending-group-invite';
const tabs = ['Home', 'Groups', 'Profile'] as const;

export function MobileApp() {
  const auth = usePrivy();
  // Remount private UI on an account change so no previous user's state survives.
  return <SessionApp key={auth.user?.id || 'guest'} />;
}

function SessionApp() {
  const { user, isReady, getAccessToken, logout } = usePrivy();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  const [tab, setTab] = useState<typeof tabs[number]>('Home');
  const [markets, setMarkets] = useState<Market[]>([]), [groups, setGroups] = useState<Group[]>([]), [trades, setTrades] = useState<Trade[]>([]);
  const [positionAdded,setPositionAdded]=useState(false);
  const [profileSection,setProfileSection]=useState('P&L');
  const [marksUpdatedAt,setMarksUpdatedAt]=useState<number|null>(null);
  const [profile, setProfile] = useState<{ id: string; name: string } | null>(null), [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [directTrade,setDirectTrade]=useState(false);
  const [chart, setChart] = useState<ChartData|null>(null), [chartRange,setChartRange] = useState('1D');
  const [selectedProposal,setSelectedProposal] = useState<string|null>(null);
  const [squadTab,setSquadTab] = useState<'Chat'|'Positions'>('Chat');
  const reduceMotion=useReducedMotion();
  const pageSlide=useRef(new Animated.Value(0)).current;
  const pageOpacity=useRef(new Animated.Value(1)).current;
  const previousPage=useRef(0);
  useEffect(()=>{
    const index=tabs.indexOf(tab)*2+(tab==='Groups'&&squadTab==='Positions'?1:0);
    const direction=index>=previousPage.current?1:-1;previousPage.current=index;
    pageSlide.stopAnimation();pageOpacity.stopAnimation();
    if(reduceMotion){pageSlide.setValue(0);pageOpacity.setValue(1);return;}
    pageSlide.setValue(direction*16);pageOpacity.setValue(.86);
    const animation=Animated.parallel([Animated.spring(pageSlide,{toValue:0,stiffness:260,damping:23,mass:.8,useNativeDriver:Platform.OS!=='web'}),Animated.timing(pageOpacity,{toValue:1,duration:180,useNativeDriver:Platform.OS!=='web'})]);animation.start();return()=>animation.stop();
  },[tab,squadTab,reduceMotion,pageSlide,pageOpacity]);
  const [showMembers,setShowMembers] = useState(false);
  const [groupFormTab,setGroupFormTab]=useState<'Create'|'Join'>('Create');
  const [inviteName,setInviteName]=useState('');
  const [showGroupForm,setShowGroupForm] = useState(false), [showSettings,setShowSettings] = useState(false);
  const [detail, setDetail] = useState<any>(null), [market, setMarket] = useState<Market | null>(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const feedScroll = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const positionOffsets = useRef<Record<string,number>>({});
  const positionsTop = useRef(0);
  const pendingPosition = useRef<string|null>(null);
  const [feedHeight,setFeedHeight]=useState(0);
  const [dockHeight,setDockHeight]=useState(90);
  const jumpFrame = useRef<number|null>(null);
  const jumpToPosition = () => {
    if(!pendingPosition.current)return;
    if(jumpFrame.current!==null)cancelAnimationFrame(jumpFrame.current);
    // Wait for all cards to finish layout before scrolling to the matching proposal.
    jumpFrame.current=requestAnimationFrame(()=>{jumpFrame.current=requestAnimationFrame(()=>{
      jumpFrame.current=null;
      const id=pendingPosition.current;
      if(id&&positionOffsets.current[id]!==undefined){feedScroll.current?.scrollTo({y:positionsTop.current+positionOffsets.current[id],animated:false});pendingPosition.current=null;}
    });});
  };
  useEffect(()=>()=>{if(jumpFrame.current!==null)cancelAnimationFrame(jumpFrame.current);},[]);
  const selectPosition = (id:string) => {pendingPosition.current=id;setSelectedProposal(id);setSquadTab('Positions');};
  const [login, setLogin] = useState(false), [invite, setInvite] = useState(''), [inviteText, setInviteText] = useState('');
  const [groupName, setGroupName] = useState(''), [search, setSearch] = useState('');
  const [amount, setAmount] = useState('0'), [side, setSide] = useState<'yes' | 'no'>('yes');
  const [shareTrade, setShareTrade] = useState<Trade | null>(null);
  const [referenceSide,setReferenceSide]=useState<'yes'|'no'>('yes');
  const pendingOrder=useRef<{signature:string;id:string}|null>(null);
  const [recipients, setRecipients] = useState<string[]>([]), [note, setNote] = useState('');
  const [inviteRestored, setInviteRestored] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const loadHistory = async () => {
    const complete:Trade[]=[];let cursor:string|null=null;
    do {const page:{trades:Trade[];nextCursor?:string|null}=await api(`demo-trades${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`);complete.push(...page.trades);cursor=page.nextCursor||null;} while(cursor);
    setTrades(complete);
  };
  const refresh = async () => {
    setLoading(true);
    const outcomes = await Promise.allSettled([
      api('markets').then(data => {setMarkets(data.markets);setMarksUpdatedAt(data.fetchedAt||Date.now());}),
      ...(user ? [api('me').then(data => { setProfile(data.user); setNeedsName(data.needsName); setName(data.needsName ? '' : data.user?.name || ''); }), api('groups').then(data => setGroups(data.groups)), loadHistory()] : []),
    ]);
    setLoading(false);
    const failed = outcomes.find(r => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  };
  useEffect(() => { if (isReady) void run(refresh); }, [isReady, user?.id]);
  useEffect(() => {
    let alive = true;
    const accept = async (url: string | null) => {
      if (!url) return;
      const token = inviteFromUrl(url, apiUrl, process.env.EXPO_PUBLIC_APP_SCHEME || 'socialplays');
      if (token) { await SecureStore.setItemAsync(pendingKey, token); if (alive) { setInvite(token); setTab('Groups'); } }
    };
    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(pendingKey);
        if (alive && stored) { setInvite(stored); setTab('Groups'); }
        await accept(await Linking.getInitialURL());
      } catch { if (alive) setError('Could not restore your invitation. Paste the link in Groups.'); }
      finally { if (alive) setInviteRestored(true); }
    })();
    const subscription = Linking.addEventListener('url', event => { void accept(event.url).catch(() => setError('Could not save the invitation. Try pasting it in Groups.')); });
    return () => { alive = false; subscription.remove(); };
  }, []);
  const requireAccount = (fn: () => Promise<unknown>) => user ? void run(fn) : setLogin(true);
  const openGroup = async (id: string) => { setDetail(await api(`groups/${id}`)); setTab('Groups'); };
  const messageRequest = useRef<{text:string;id:string;group:string}|null>(null);
  const sendMessage = async (text:string):Promise<boolean> => {
    if(lock.current||!detail)return false;
    let sent=false;
    await run(async()=>{
      const previous=messageRequest.current;
      const request=previous?.text===text&&previous.group===detail.group.id?previous:{text,group:detail.group.id,id:process.env.EXPO_PUBLIC_UI_PREVIEW==='true'?`sample-message-${Date.now()}`:Crypto.randomUUID()};
      messageRequest.current=request;
      await api(`groups/${detail.group.id}/messages`,{requestId:request.id,text});
      sent=true;messageRequest.current=null;nearBottom.current=true;await openGroup(detail.group.id);
    });
    return sent;
  };
  useEffect(()=>{
    if(!detail||tab!=='Groups')return;
    let active=true;
    const timer=setInterval(()=>{if(lock.current)return;void api(`groups/${detail.group.id}`).then(next=>{if(active&&!lock.current)setDetail(next);}).catch(()=>{});},4000);
    return ()=>{active=false;clearInterval(timer);};
  },[detail?.group.id,tab,api]);
  useEffect(()=>{nearBottom.current=true;if(tab==='Groups'&&detail){if(squadTab==='Chat'){positionOffsets.current={};feedScroll.current?.scrollToEnd({animated:false});}else if(pendingPosition.current){jumpToPosition();}else if(!selectedProposal){feedScroll.current?.scrollTo({y:0,animated:false});}}},[tab,detail?.group.id,squadTab,selectedProposal]);
  const respondToProposal = (proposalId:string,stance:'tail'|'fade')=>void run(async()=>{
    const proposal=detail.proposals.find((p:any)=>p.id===proposalId);
    if(!proposal)throw Error('This proposal is no longer available.');
    const proposalSide=proposal.side==='no'?'no':'yes';
    const outcome=stance==='tail'?proposalSide:proposalSide==='yes'?'no':'yes';
    const fresh=await api(`market-detail?symbol=${encodeURIComponent(proposal.symbol)}&range=1D`);
    setReferenceSide(proposalSide);pendingOrder.current=null;setDirectTrade(true);setChart(fresh);setChartRange('1D');setMarket(fresh.market);setSide(outcome);setAmount('0');
    await api(`groups/${detail.group.id}/responses`,{proposalId,stance});
    await openGroup(detail.group.id);
  });
  const openMarket = async (selected: Market) => {
    setReferenceSide('yes');pendingOrder.current=null;setDirectTrade(false);
    const fresh = await api(`market-detail?symbol=${encodeURIComponent(selected.id)}&range=1D`);
    setChart(fresh); setChartRange('1D'); setMarket(fresh.market); setSide('yes');  setAmount('0');
  };
  const join = () => requireAccount(async () => {
    const result = await api(`invites/${invite}`, {});
    await SecureStore.deleteItemAsync(pendingKey); setInvite('');setInviteText('');setInviteName('');setShowGroupForm(false);setSelectedProposal(null);setSquadTab('Chat'); await refresh(); await openGroup(result.id);
  });
  const create = () => requireAccount(async () => { const result = await api('groups', { name: groupName.trim() }); setGroupName(''); setShowGroupForm(false); setSquadTab('Chat'); await refresh(); await openGroup(result.id); });
  const asking=market?(side==='yes'?market.yesAsk:market.noAsk):null;
  let fill:ReturnType<typeof simulateBuy>|null=null;
  const orderCents=Math.round(Number(amount)*100),orderPrice=asking==null?0:Math.round(asking*1000000);
  try {if(/^\d+(\.\d{0,2})?$/.test(amount)&&market)fill=simulateBuy(orderCents,orderPrice);}catch{}
  const confirm = async () => {await run(async()=>{
    if(!market||!fill)throw Error('Enter a valid amount and choose an available outcome.');
    if(!user){setMarket(null);setLogin(true);return;}
    const signature=JSON.stringify([market.id,side,orderCents,orderPrice]);
    const request=pendingOrder.current?.signature===signature?pendingOrder.current:{signature,id:process.env.EXPO_PUBLIC_UI_PREVIEW==='true'?`sample-${Date.now()}`:Crypto.randomUUID()};
    pendingOrder.current=request;
    let result;
    try {result=await api('demo-trades',{requestId:request.id,symbol:market.id,side,amountCents:orderCents,priceMicros:orderPrice});}
    catch(error){
      if(error instanceof Error&&error.message.includes('quote changed')){
        pendingOrder.current=null;
        const fresh=await api(`market-detail?symbol=${encodeURIComponent(market.id)}&range=1D`);setMarket(fresh.market);setChart(fresh);
        throw Error('The price changed. Check the updated cost and swipe again to confirm.');
      }
      throw error;
    }
    setTrades(current=>[result.trade,...current.filter(trade=>trade.id!==result.trade.id)]);
    pendingOrder.current=null;setMarket(null);setRecipients([]);setNote('');
    if(directTrade){
      setShareTrade(null);setPositionAdded(true);setSquadTab('Positions');setTab('Groups');
    }else{
      setShareTrade(result.trade);setTab('Home');
    }
    await refresh();
  });};
  const games = groupGames(markets.filter(m=>m.tags.includes('NCAA Football'))).filter(game => `${game.name} ${game.home} ${game.away}`.toLowerCase().includes(search.toLowerCase()));
  if (!isReady) return <SafeAreaView style={styles.page}><Text style={[styles.text, { padding: 24 }]}>Opening your account…</Text></SafeAreaView>;
  const errorBanner = error ? <View accessibilityRole="alert" style={styles.card}><Text style={styles.text}>{error}</Text><Button title="Dismiss" secondary onPress={() => setError('')} /></View> : null;
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{backgroundColor:colors.bg,paddingHorizontal:20,paddingVertical:12,display:tab==='Groups'&&detail?'flex':'none'}}>{tab==='Groups' && detail && <SquadHeader name={detail.group.name} count={detail.group.memberCount ?? detail.members.length} active={squadTab} onTab={next=>{pendingPosition.current=null;setSelectedProposal(null);setSquadTab(next);}} onBack={()=>{setDetail(null);setSelectedProposal(null);setShowMembers(false);setSquadTab('Chat');}} onMembers={()=>setShowMembers(!showMembers)} onInvite={()=>void run(()=>Share.share({message:`Join ${detail.group.name}: ${process.env.EXPO_PUBLIC_APP_SCHEME||'socialplays'}://invite/${detail.group.invite}`}))}/>}</View>
    <Animated.View style={{flex:1,minHeight:0,opacity:pageOpacity,transform:[{translateX:pageSlide}]}}>
    <ScrollView ref={feedScroll} onLayout={event=>setFeedHeight(event.nativeEvent.layout.height)} style={{flex:1,minHeight:0}} scrollEventThrottle={100} onScroll={event=>{const {layoutMeasurement,contentOffset,contentSize}=event.nativeEvent;nearBottom.current=layoutMeasurement.height+contentOffset.y>=contentSize.height-100;}} onContentSizeChange={()=>{if(tab==='Groups'&&squadTab==='Positions')jumpToPosition();if(tab==='Groups'&&detail&&squadTab==='Chat'&&nearBottom.current)feedScroll.current?.scrollToEnd({animated:false});}} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content,{paddingBottom:dockHeight+24}]} refreshControl={<RefreshControl tintColor={colors.accent} refreshing={loading} onRefresh={() => void run(refresh)} />}>
      <Text style={styles.label}>{process.env.EXPO_PUBLIC_UI_PREVIEW === 'true' ? 'UI PREVIEW · SAMPLE DATA' : 'SOCIAL PLAYS · PRACTICE MODE'}</Text>{!market && errorBanner}
      {tab === 'Home' && <>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><View style={{gap:5}}><Text style={styles.title}>Home</Text><Text style={styles.muted}>College football. Better together.</Text></View><View style={{width:44,height:44,borderRadius:22,backgroundColor:colors.card,alignItems:'center',justifyContent:'center'}}><Icon name="football" color={colors.accent} size={22}/></View></View>
        <Field label="Find a matchup" placeholder="Search teams" value={search} onChangeText={setSearch} />
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={styles.heading}>On the board</Text><Text style={styles.muted}>{games.length} games</Text></View>
        {!loading && !games.length && <Text style={styles.muted}>No college-football markets available. Pull down to refresh.</Text>}
        {games.map(game=><GameCard key={game.id} game={game} disabled={busy} onOpen={m=>void run(()=>openMarket(m))}/>)}
      </>}
      {tab === 'Groups' && <>
        {positionAdded&&<View style={[styles.card,{padding:12}]}><Text style={styles.text}>Position added to your active positions.</Text><Pressable accessibilityRole="button" onPress={()=>{setProfileSection('Active positions');setPositionAdded(false);setTab('Profile');}} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent,fontWeight:'600'}}>View your active positions →</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Dismiss position confirmation" onPress={()=>setPositionAdded(false)}><Text style={styles.muted}>Dismiss</Text></Pressable></View>}
        {invite && inviteRestored && <View style={styles.card}><Text style={styles.heading}>You’re invited.</Text><Button title={user?'Join group':'Sign in to join'} disabled={busy} onPress={join}/><Button title="Dismiss" secondary onPress={()=>void run(async()=>{await SecureStore.deleteItemAsync(pendingKey);setInvite('');})}/></View>}
        {!user?<Button title="Sign in to see your groups" onPress={()=>setLogin(true)}/>:detail?<>
          {showMembers && <View style={styles.card}><Text style={styles.heading}>Group members</Text>{detail.members.map((member:any)=><View key={member.id} style={squadStyles.member}><SquadAvatar name={member.name} small/><Text style={styles.text}>{member.name}</Text></View>)}</View>}
          {squadTab==='Chat' ? <SquadConversation key={detail.group.id} messages={detail.messages||[]} reactions={detail.reactions||[]} onReact={(targetId,emoji,active)=>void run(async()=>{await api(`groups/${detail.group.id}/reactions`,{targetId,emoji,active});await openGroup(detail.group.id);})} proposals={detail.proposals} userId={profile?.id} busy={busy} onSelect={selectPosition}/> : <View onLayout={event=>{positionsTop.current=event.nativeEvent.layout.y;jumpToPosition();}} style={{gap:10,paddingBottom:feedHeight}}>
            {!detail.proposals.length?<SquadEmpty positions onBrowse={()=>setTab('Home')}/>: [...detail.proposals].sort((a:any,b:any)=>b.created-a.created||b.id.localeCompare(a.id)).map((p:any)=><View key={p.id} onLayout={event=>{positionOffsets.current[p.id]=event.nativeEvent.layout.y;jumpToPosition();}} style={[styles.card,{padding:12,gap:8,borderRadius:16},selectedProposal===p.id&&{borderColor:colors.accent,borderWidth:2}]}>
              <View style={{gap:4}}><Text style={[styles.label,{fontSize:9}]}>{p.authorName}'S PROPOSAL</Text><Text style={[styles.heading,{fontSize:16}]}>{p.side==='yes'?p.title:p.opposite}</Text><Text style={[styles.muted,{fontSize:11}]}>{new Date(p.created).toLocaleString()}</Text></View>
              <PositionPriceChart compact proposal={p} peers={detail.proposals.filter((peer:any)=>peer.symbol===p.symbol)} api={api}/>

              <View style={{flexDirection:'row',gap:6}}>{(['tail','fade'] as const).map(stance=><StanceButton key={stance} stance={stance} count={stance==='tail'?p.tails:p.fades} selected={p.myStance===stance} disabled={busy} onPress={()=>respondToProposal(p.id,stance)}/>)}<Pressable accessibilityRole="button" accessibilityLabel="View market details" disabled={busy} onPress={()=>void run(async()=>{const chosen=markets.find(m=>m.id===p.symbol);if(!chosen)throw Error('This market is unavailable.');await openMarket(chosen);})} style={{minHeight:44,paddingHorizontal:10,justifyContent:'center'}}><Text style={{fontSize:12,color:colors.muted}}>Details →</Text></Pressable></View>

            </View>)}
          </View>}

        </>:<SquadDirectory groups={groups} games={groupGames(markets.filter(m=>m.tags.includes('NCAA Football')))} busy={busy} onOpen={id=>{setSelectedProposal(null);setSquadTab('Chat');setShowMembers(false);void run(()=>openGroup(id));}} onCreate={()=>{setError('');setGroupFormTab('Create');setShowGroupForm(true);}} onMarket={m=>void run(()=>openMarket(m))}/>}
      </>}
      {tab === 'Profile' && <>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={styles.title}>Profile</Text><Pressable accessibilityRole="button" onPress={()=>setShowSettings(!showSettings)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent,fontSize:14}}>Settings</Text></Pressable></View>
        {!user?<Login run={run} busy={busy}/>:<>
          <View style={{alignItems:'center',paddingVertical:20,gap:12}}><View style={{width:72,height:72,borderRadius:36,backgroundColor:colors.avatar,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:28,color:colors.accent,fontWeight:'600'}}>{(profile?.name||'Member')[0]}</Text></View><Text style={styles.heading}>{profile?.name||'Member'}</Text><Text style={styles.muted}>Your plays. Your people.</Text></View>
          {showSettings&&<View style={{gap:16}}><Field label="Display name" value={name} onChangeText={setName} maxLength={60}/><Button title="Save name" disabled={busy||!name.trim()} onPress={()=>void run(async()=>{await api('profile',{name});await refresh();})}/><RecoveryEmail run={run} busy={busy}/><WalletCheck run={run} busy={busy}/><Button title="Sign out" secondary disabled={busy} onPress={()=>void run(logout)}/><Button title="Delete account" secondary disabled={busy} onPress={()=>Alert.alert('Delete your account?','Permanently delete your profile, posts and practice plays?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>void run(async()=>{await api('account/delete',{confirm:'DELETE'});await logout();})}])}/></View>}
          <PortfolioProfile initialTab={profileSection} marksUpdatedAt={marksUpdatedAt} trades={trades} markets={markets} busy={busy} onShare={t=>{setShareTrade(t);setRecipients([]);setNote('');}} onMarket={symbol=>void run(async()=>{const selected=markets.find(m=>m.id===symbol);if(!selected)throw Error('This market is unavailable. Its cost remains in your history.');await openMarket(selected);})}/>

        </>}
      </>}
    </ScrollView>
    </Animated.View>
    <View onLayout={event=>setDockHeight(event.nativeEvent.layout.height)} pointerEvents="box-none" style={{position:'absolute',bottom:0,left:0,right:0,zIndex:20}}>
    {tab==='Groups'&&detail&&user&&squadTab==='Chat'&&<ChatComposer key={detail.group.id} busy={busy} onSend={sendMessage}/>}
    <TabBar active={tab} onChange={t=>{setProfileSection('P&L');setTab(t);setDetail(null);setError('');}}/>
    </View>
    <Modal visible={showGroupForm && !!user} animationType="slide" onRequestClose={()=>{if(!busy)setShowGroupForm(false);}}><SafeAreaView style={styles.page}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={styles.heading}>Create or join a group</Text><IconButton name="back" label="Close group setup" onPress={()=>{if(!busy)setShowGroupForm(false);}}/></View>{errorBanner}
      <View style={{flexDirection:'row',gap:10}}>{(['Create','Join'] as const).map(option=><View key={option} style={{flex:1}}><Button title={option} secondary={groupFormTab!==option} disabled={busy} onPress={()=>{setError('');setGroupFormTab(option);}}/></View>)}</View>
      {groupFormTab==='Create'?<><Text style={styles.title}>Your people. Your group.</Text><Text style={styles.muted}>Choose a name. You can invite friends once it’s created.</Text><Field label="Group name" placeholder="e.g. Saturday football" value={groupName} onChangeText={setGroupName} maxLength={60} autoFocus/><Button title={busy?'Creating…':'Create group'} disabled={busy||!groupName.trim()} onPress={create}/></>:<><Text style={styles.title}>Join your people.</Text><Field label="Invitation link or code" placeholder="Paste an invitation" value={inviteText} onChangeText={value=>{setInviteText(value);setInviteName('');}} autoCapitalize="none" autoCorrect={false}/><Button title="Check invitation" secondary disabled={busy||!inviteText.trim()} onPress={()=>void run(async()=>{const value=inviteText.trim();const token=/^[0-9a-f-]{72}$/.test(value)?value:inviteFromUrl(value,apiUrl,process.env.EXPO_PUBLIC_APP_SCHEME||'socialplays');if(!token)throw Error('Paste a valid group invitation link or code.');const result=await api(`invites/${token}`);await SecureStore.setItemAsync(pendingKey,token);setInvite(token);setInviteName(result.name);})}/>{!!inviteName&&<View style={styles.card}><Text style={styles.heading}>{inviteName}</Text><Text style={styles.muted}>Join this group to see its chat and shared positions.</Text><Button title="Join group" disabled={busy} onPress={join}/></View>}</>}
    </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
    <Modal visible={login && !user} animationType="slide" onRequestClose={() => setLogin(false)}><SafeAreaView style={styles.page}><KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Button title="Back to browsing" secondary onPress={() => setLogin(false)} />{errorBanner}<Login run={run} busy={busy} /></ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
    <Modal visible={!!user && needsName} animationType="slide" onRequestClose={()=>{}}><SafeAreaView style={styles.page}><KeyboardAvoidingView behavior="padding" style={{flex:1}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Text style={styles.title}>What should your friends call you?</Text><Text style={styles.muted}>Only your chosen name is shown in groups.</Text>{errorBanner}<Field label="Display name" value={name} onChangeText={setName} maxLength={60} autoFocus/><Button title="Continue" disabled={busy||!name.trim()} onPress={()=>void run(async()=>{await api('profile',{name});await refresh();})}/><Button title="Sign out" secondary disabled={busy} onPress={()=>void run(logout)}/></ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
    <Modal visible={!!market} animationType="slide" onRequestClose={() => { if (!busy) { setMarket(null);  } }}><SafeAreaView style={styles.page}><ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><IconButton name="back" label="Back to games" onPress={()=>{if(!busy){setMarket(null);}}}/><Text style={styles.label}>COLLEGE FOOTBALL</Text><View style={{width:44}}/></View>{errorBanner}{market && <>
        {!directTrade&&<>
        <View style={{flexDirection:'row',justifyContent:'center',gap:20,alignItems:'center',paddingVertical:8}}>{[market.away||market.opposite,market.home||market.title].map(team=><View key={team} style={{flex:1,alignItems:'center',gap:10}}><TeamLogo name={team} size={54}/><Text style={[styles.heading,{fontSize:17,textAlign:'center'}]}>{team}</Text></View>)}</View>
        <ProbabilityChart data={chart} market={market} range={chartRange} disabled={busy} onRange={range=>void run(async()=>{const fresh=await api(`market-detail?symbol=${encodeURIComponent(market.id)}&range=${range}`);setChart(fresh);setChartRange(range);})}/>
        <View style={{height:1,backgroundColor:colors.border,marginVertical:6}}/></>}

        <TradePad market={market} side={side} referenceSide={referenceSide} amount={amount} fill={fill} busy={busy} onAmount={setAmount} onSide={setSide}/>
      </>}</ScrollView>{market&&<SwipeConfirm key={market.id} disabled={busy||!fill} submitting={busy} tone={side===referenceSide?'tail':'fade'} onConfirm={confirm} label={fill?`Swipe up to buy · ${money(fill.costCents)}`:'Enter an amount to buy'}/>}</SafeAreaView></Modal>
    <Modal visible={!!shareTrade} animationType="slide" onRequestClose={() => { if (!busy) setShareTrade(null); }}><SafeAreaView style={styles.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Text style={styles.title}>Share your play?</Text>{errorBanner}<Text style={styles.muted}>Send this practice buy as a proposal to your groups. Choose up to ten groups. Sharing never places another trade.</Text>
      {groups.map(g => <Button key={g.id} title={`${recipients.includes(g.id) ? '✓ ' : ''}${g.name}`} secondary={!recipients.includes(g.id)} disabled={busy || (!recipients.includes(g.id) && recipients.length >= 10)} onPress={() => setRecipients(ids => ids.includes(g.id) ? ids.filter(id => id !== g.id) : [...ids, g.id])} />)}
      {!groups.length && <Text style={styles.text}>Create or join a group first. This play will be saved in Your plays.</Text>}
      <Field label="Add your take (optional)" value={note} onChangeText={setNote} multiline maxLength={500} /><Button title="Send proposal" disabled={busy || !recipients.length} onPress={() => void run(async () => { await api(`demo-trades/${shareTrade!.id}/share`, { groupIds: recipients, note }); setShareTrade(null); await refresh(); setTab('Groups'); })} /><Button title="Keep it to myself" secondary disabled={busy} onPress={() => setShareTrade(null)} />
    </ScrollView></SafeAreaView></Modal>
  </KeyboardAvoidingView></SafeAreaView>;
}
