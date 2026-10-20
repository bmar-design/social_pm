import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, RefreshControl, ScrollView, Share, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { usePrivy } from '@privy-io/expo';
import { apiUrl, createApi } from './api';
import { inviteFromUrl } from './links';
import { Login, RecoveryEmail } from './Auth';
import { Button, colors, Field, money, styles } from './ui';
import { groupGames, simulateBuy } from '../../hosted/lib/game-model';
import type { Market } from '../../hosted/lib/market-model';
import { WalletCheck } from './WalletCheck';
import { GameCard, Icon, IconButton, TabBar, TeamLogo, ProbabilityChart, percent, marketLabel, type ChartData } from './FootballUI';

type Group = { id: string; name: string; memberCount: number; proposalCount: number };
type Trade = { id: string; symbol: string; title: string; opposite: string; side: string; contracts: number; cost_cents: number; created: number };
type Review = { market: Market; side: 'yes' | 'no'; amount: number; price: number; id: string; reviewedAt: number };
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
  const [profile, setProfile] = useState<{ id: string; name: string } | null>(null), [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [chart, setChart] = useState<ChartData|null>(null), [chartRange,setChartRange] = useState('1D');
  const [showGroupForm,setShowGroupForm] = useState(false), [showSettings,setShowSettings] = useState(false);
  const [detail, setDetail] = useState<any>(null), [market, setMarket] = useState<Market | null>(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const [login, setLogin] = useState(false), [invite, setInvite] = useState(''), [inviteText, setInviteText] = useState('');
  const [groupName, setGroupName] = useState(''), [search, setSearch] = useState('');
  const [amount, setAmount] = useState('10'), [side, setSide] = useState<'yes' | 'no'>('yes');
  const [review, setReview] = useState<Review | null>(null), [shareTrade, setShareTrade] = useState<Trade | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]), [note, setNote] = useState('');
  const [inviteRestored, setInviteRestored] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const refresh = async () => {
    setLoading(true);
    const outcomes = await Promise.allSettled([
      api('markets').then(data => setMarkets(data.markets)),
      ...(user ? [api('me').then(data => { setProfile(data.user); setNeedsName(data.needsName); setName(data.needsName ? '' : data.user?.name || ''); }), api('groups').then(data => setGroups(data.groups)), api('demo-trades').then(data => setTrades(data.trades))] : []),
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
  const openMarket = async (selected: Market) => {
    const fresh = await api(`market-detail?symbol=${encodeURIComponent(selected.id)}&range=1D`);
    setChart(fresh); setChartRange('1D'); setMarket(fresh.market); setSide('yes'); setReview(null); setAmount('10');
  };
  const join = () => requireAccount(async () => {
    const result = await api(`invites/${invite}`, {});
    await SecureStore.deleteItemAsync(pendingKey); setInvite(''); await refresh(); await openGroup(result.id);
  });
  const create = () => requireAccount(async () => { const result = await api('groups', { name: groupName }); setGroupName(''); await refresh(); await openGroup(result.id); });
  const prepareReview = () => requireAccount(async () => {
    if (!market) return;
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw Error('Enter dollars with at most two decimal places.');
    const fresh = await api(`market-detail?symbol=${encodeURIComponent(market.id)}&range=1D`);
    const price = side === 'yes' ? fresh.market.yesAsk : fresh.market.noAsk;
    if (price === null || price <= 0) throw Error('No current quote for this outcome.');
    const cents = Math.round(Number(amount) * 100), micros = Math.round(price * 1000000);
    simulateBuy(cents, micros);
    setMarket(fresh.market); setReview({ market: fresh.market, side, amount: cents, price: micros, id: process.env.EXPO_PUBLIC_UI_PREVIEW === 'true' ? `sample-${Date.now()}` : Crypto.randomUUID(), reviewedAt: Date.now() });
  });
  const confirm = () => void run(async () => {
    if (!review) return;
    const result = await api('demo-trades', { requestId: review.id, symbol: review.market.id, side: review.side, amountCents: review.amount, priceMicros: review.price });
    // The same request ID survives errors so an ambiguous network retry cannot duplicate a buy.
    setReview(null); setMarket(null); setShareTrade(result.trade); setRecipients([]); setNote(''); await refresh(); setTab('Profile');
  });
  const games = groupGames(markets.filter(m=>m.tags.includes('NCAA Football'))).filter(game => `${game.name} ${game.home} ${game.away}`.toLowerCase().includes(search.toLowerCase()));
  const fill = review ? simulateBuy(review.amount, review.price) : null;
  if (!isReady) return <SafeAreaView style={styles.page}><Text style={[styles.text, { padding: 24 }]}>Opening your account…</Text></SafeAreaView>;
  const errorBanner = error ? <View accessibilityRole="alert" style={styles.card}><Text style={styles.text}>{error}</Text><Button title="Dismiss" secondary onPress={() => setError('')} /></View> : null;
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl tintColor={colors.accent} refreshing={loading} onRefresh={() => void run(refresh)} />}>
      <Text style={styles.label}>{process.env.EXPO_PUBLIC_UI_PREVIEW === 'true' ? 'UI PREVIEW · SAMPLE DATA' : 'SOCIAL PLAYS · PRACTICE MODE'}</Text>{!market && errorBanner}
      {tab === 'Home' && <>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><View style={{gap:5}}><Text style={styles.title}>Home</Text><Text style={styles.muted}>College football. Better together.</Text></View><View style={{width:44,height:44,borderRadius:22,backgroundColor:colors.card,alignItems:'center',justifyContent:'center'}}><Icon name="football" color={colors.accent} size={22}/></View></View>
        <Field label="Find a matchup" placeholder="Search teams" value={search} onChangeText={setSearch} />
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={styles.heading}>On the board</Text><Text style={styles.muted}>{games.length} games</Text></View>
        {!loading && !games.length && <Text style={styles.muted}>No college-football markets available. Pull down to refresh.</Text>}
        {games.map(game=><GameCard key={game.id} game={game} disabled={busy} onOpen={m=>void run(()=>openMarket(m))}/>)}
      </>}
      {tab === 'Groups' && <>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>{detail?<IconButton name="back" label="Back to groups" onPress={()=>setDetail(null)}/>:<View><Text style={styles.title}>Groups</Text><Text style={styles.muted}>The people behind your plays.</Text></View>}{detail?<Text style={[styles.heading,{flex:1,textAlign:'center'}]}>{detail.group.name}</Text>:<IconButton name="plus" label="Create or join a group" onPress={()=>setShowGroupForm(!showGroupForm)}/>}</View>
        {invite && inviteRestored && <View style={styles.card}><Text style={styles.heading}>You’re invited.</Text><Button title={user?'Join group':'Sign in to join'} disabled={busy} onPress={join}/><Button title="Dismiss" secondary onPress={()=>void run(async()=>{await SecureStore.deleteItemAsync(pendingKey);setInvite('');})}/></View>}
        {!user?<Button title="Sign in to see your groups" onPress={()=>setLogin(true)}/>:detail?<>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={styles.muted}>{detail.members.length} members · Private group</Text><Pressable accessibilityRole="button" onPress={()=>void run(()=>Share.share({message:`Join ${detail.group.name}: ${process.env.EXPO_PUBLIC_APP_SCHEME||'socialplays'}://invite/${detail.group.invite}`}))} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent,fontSize:14,fontWeight:'600'}}>Invite friends</Text></Pressable></View>
          {!detail.proposals.length&&<View style={styles.card}><Text style={styles.heading}>Start the conversation.</Text><Text style={styles.muted}>Find a game and share your first play.</Text><Button title="Explore college football" onPress={()=>setTab('Home')}/></View>}
          {detail.proposals.map((p:any)=><View key={p.id} style={styles.card}>
            <View style={{flexDirection:'row',gap:10,alignItems:'center'}}><View style={{height:34,width:34,borderRadius:17,backgroundColor:'#303b30',alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.text,fontWeight:'600'}}>{p.authorName[0]}</Text></View><View><Text style={{color:colors.text,fontSize:14,fontWeight:'600'}}>{p.authorName}</Text><Text style={{color:colors.muted,fontSize:11}}>{new Date(p.created).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</Text></View></View>
            {!!p.note&&<Text style={styles.text}>{p.note}</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="Open market chart" onPress={()=>void run(async()=>{const selected=markets.find(m=>m.id===p.symbol);if(!selected)throw Error('This college-football market is unavailable.');await openMarket(selected);})} style={{borderRadius:14,padding:14,backgroundColor:colors.bg,gap:8}}><Text style={styles.label}>COLLEGE FOOTBALL</Text><View style={{flexDirection:'row',gap:10,alignItems:'center'}}><TeamLogo name={p.side==='yes'?p.title:p.opposite} size={30}/><Text style={[styles.heading,{flex:1,fontSize:17}]}>{p.side==='yes'?p.title:p.opposite}</Text><Icon name="arrow" size={16} color={colors.muted}/></View></Pressable>
            <View style={{flexDirection:'row',gap:10}}>{(['tail','fade'] as const).map(stance=><Pressable key={stance} accessibilityRole="button" accessibilityState={{selected:p.myStance===stance,disabled:busy}} disabled={busy} onPress={()=>void run(async()=>{await api(`groups/${detail.group.id}/responses`,{proposalId:p.id,stance:p.myStance===stance?'none':stance});await openGroup(detail.group.id);})} style={{flex:1,minHeight:44,borderRadius:12,borderWidth:1,borderColor:p.myStance===stance?colors.accent:colors.border,alignItems:'center',justifyContent:'center',backgroundColor:p.myStance===stance?'#d8f2790d':'transparent'}}><Text style={{color:p.myStance===stance?colors.accent:colors.muted,fontSize:13,fontWeight:'600'}}>{stance==='tail'?'↗ Tail':'↘ Fade'}  {stance==='tail'?p.tails:p.fades}</Text></Pressable>)}</View>
          </View>)}
          <Text style={[styles.muted,{fontSize:11,textAlign:'center'}]}>Tail and Fade are opinions. No order is placed.</Text>
        </>:<>{groups.map((g,i)=><Pressable key={g.id} accessibilityRole="button" disabled={busy} onPress={()=>void run(()=>openGroup(g.id))} style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:19,borderBottomWidth:1,borderColor:colors.border}}><View style={{width:52,height:52,borderRadius:18,backgroundColor:i%2?'#303947':'#303b30',alignItems:'center',justifyContent:'center'}}><Icon name="groups" color={i%2?'#b2c7e5':colors.accent}/></View><View style={{flex:1,gap:5}}><Text style={styles.heading}>{g.name}</Text><Text style={styles.muted}>{g.memberCount} members · {g.proposalCount} ideas</Text></View><Icon name="arrow" size={18} color={colors.muted}/></Pressable>)}</>}
        {showGroupForm&&!detail&&<View style={styles.card}><Text style={styles.heading}>Bring your people.</Text><Field label="Group name" value={groupName} onChangeText={setGroupName} maxLength={60}/><Button title="Create group" disabled={busy||!groupName.trim()} onPress={create}/><Field label="Or paste an invitation" value={inviteText} onChangeText={setInviteText} autoCapitalize="none"/><Button title="Open invitation" secondary disabled={busy||!inviteText} onPress={()=>void run(async()=>{const token=inviteFromUrl(inviteText.trim(),apiUrl,process.env.EXPO_PUBLIC_APP_SCHEME||'socialplays');if(!token)throw Error('Paste a valid invitation.');await SecureStore.setItemAsync(pendingKey,token);setInvite(token);setInviteText('');})}/></View>}
      </>}
      {tab === 'Profile' && <>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={styles.title}>Profile</Text><Pressable accessibilityRole="button" onPress={()=>setShowSettings(!showSettings)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent,fontSize:14}}>Settings</Text></Pressable></View>
        {!user?<Login run={run} busy={busy}/>:<>
          <View style={{alignItems:'center',paddingVertical:20,gap:12}}><View style={{width:72,height:72,borderRadius:36,backgroundColor:'#303b30',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:28,color:colors.accent,fontWeight:'600'}}>{(profile?.name||'Member')[0]}</Text></View><Text style={styles.heading}>{profile?.name||'Member'}</Text><Text style={styles.muted}>Your plays. Your people.</Text></View>
          {showSettings&&<View style={{gap:16}}><Field label="Display name" value={name} onChangeText={setName} maxLength={60}/><Button title="Save name" disabled={busy||!name.trim()} onPress={()=>void run(async()=>{await api('profile',{name});await refresh();})}/><RecoveryEmail run={run} busy={busy}/><WalletCheck run={run} busy={busy}/><Button title="Sign out" secondary disabled={busy} onPress={()=>void run(logout)}/><Button title="Delete account" secondary disabled={busy} onPress={()=>Alert.alert('Delete your account?','Permanently delete your profile, posts and practice plays?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>void run(async()=>{await api('account/delete',{confirm:'DELETE'});await logout();})}])}/></View>}
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={styles.heading}>Your plays</Text><Text style={styles.label}>PRACTICE</Text></View>
          {!trades.length?<Text style={styles.muted}>Your first play starts with a game.</Text>:trades.map(t=><View key={t.id} style={styles.card}><View style={{flexDirection:'row',gap:12,alignItems:'center'}}><TeamLogo name={t.side==='yes'?t.title:t.opposite}/><View style={{flex:1,gap:5}}><Text style={styles.heading}>{t.side==='yes'?t.title:t.opposite}</Text><Text style={styles.muted}>{t.contracts} contracts · {money(t.cost_cents)}</Text></View></View><Pressable accessibilityRole="button" onPress={()=>{setShareTrade(t);setRecipients([]);setNote('');}} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent,fontSize:14}}>Share with your group ↗</Text></Pressable></View>)}
        </>}
      </>}
    </ScrollView>
    <TabBar active={tab} onChange={t=>{setTab(t);setDetail(null);setError('');}}/>
    <Modal visible={login && !user} animationType="slide" onRequestClose={() => setLogin(false)}><SafeAreaView style={styles.page}><KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Button title="Back to browsing" secondary onPress={() => setLogin(false)} />{errorBanner}<Login run={run} busy={busy} /></ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
    <Modal visible={!!user && needsName} animationType="slide" onRequestClose={()=>{}}><SafeAreaView style={styles.page}><KeyboardAvoidingView behavior="padding" style={{flex:1}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Text style={styles.title}>What should your friends call you?</Text><Text style={styles.muted}>Only your chosen name is shown in groups.</Text>{errorBanner}<Field label="Display name" value={name} onChangeText={setName} maxLength={60} autoFocus/><Button title="Continue" disabled={busy||!name.trim()} onPress={()=>void run(async()=>{await api('profile',{name});await refresh();})}/><Button title="Sign out" secondary disabled={busy} onPress={()=>void run(logout)}/></ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
    <Modal visible={!!market} animationType="slide" onRequestClose={() => { if (!busy) { setMarket(null); setReview(null); } }}><SafeAreaView style={styles.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><IconButton name="back" label="Back to games" onPress={()=>{if(!busy){setMarket(null);setReview(null);}}}/><Text style={styles.label}>COLLEGE FOOTBALL</Text><View style={{width:44}}/></View>{errorBanner}{market && <>
        <View style={{flexDirection:'row',justifyContent:'center',gap:20,alignItems:'center',paddingVertical:8}}>{[market.away||market.opposite,market.home||market.title].map(team=><View key={team} style={{flex:1,alignItems:'center',gap:10}}><TeamLogo name={team} size={54}/><Text style={[styles.heading,{fontSize:17,textAlign:'center'}]}>{team}</Text></View>)}</View>
        <ProbabilityChart data={chart} market={market} range={chartRange} disabled={busy} onRange={range=>void run(async()=>{const fresh=await api(`market-detail?symbol=${encodeURIComponent(market.id)}&range=${range}`);setChart(fresh);setChartRange(range);})}/>
        <View style={{height:1,backgroundColor:colors.border,marginVertical:6}}/>

        {review && fill ? <View style={styles.card}><Text style={styles.heading}>Review your practice play</Text><Text style={styles.text}>{review.side === 'yes' ? review.market.title : review.market.opposite}</Text><Text style={styles.text}>{fill.contracts} contracts · {money(fill.costCents)} total</Text><Text style={styles.muted}>Practice fees: $0. Potential payout including stake: {money(fill.payoutCents)}. Maximum simulated loss: {money(fill.costCents)}. Assumes an immediate full fill; real trading can differ. Sharing happens after confirmation.</Text><Button title={busy ? 'Confirming…' : 'Confirm practice buy'} disabled={busy} onPress={confirm} /><Button title="Edit amount or outcome" secondary disabled={busy} onPress={() => setReview(null)} /></View> : <><Text style={styles.heading}>Make your play</Text><Button title={`${market.title} · ${percent(market.price)}${side === 'yes' ? ' ✓' : ''}`} secondary={side !== 'yes'} onPress={() => setSide('yes')} /><Button title={`${market.opposite} · ${percent(market.price===null?null:1-market.price)}${side === 'no' ? ' ✓' : ''}`} secondary={side !== 'no'} onPress={() => setSide('no')} /><Field label="Practice dollars" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /><Button title="Review practice buy" disabled={busy} onPress={() => { if (!user) { setMarket(null); setLogin(true); } else prepareReview(); }} /><Text style={styles.muted}>A fresh quote is checked before review and again by the server on confirmation. No actual order is submitted.</Text></>}
      </>}</ScrollView></SafeAreaView></Modal>
    <Modal visible={!!shareTrade} animationType="slide" onRequestClose={() => { if (!busy) setShareTrade(null); }}><SafeAreaView style={styles.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Text style={styles.title}>Your play. Your people.</Text>{errorBanner}<Text style={styles.muted}>Choose up to ten groups. Sharing never places another buy.</Text>
      {groups.map(g => <Button key={g.id} title={`${recipients.includes(g.id) ? '✓ ' : ''}${g.name}`} secondary={!recipients.includes(g.id)} disabled={busy || (!recipients.includes(g.id) && recipients.length >= 10)} onPress={() => setRecipients(ids => ids.includes(g.id) ? ids.filter(id => id !== g.id) : [...ids, g.id])} />)}
      {!groups.length && <Text style={styles.text}>Create or join a group first. This play will be saved in Your plays.</Text>}
      <Field label="Add your take (optional)" value={note} onChangeText={setNote} multiline maxLength={500} /><Button title="Share practice play" disabled={busy || !recipients.length} onPress={() => void run(async () => { await api(`demo-trades/${shareTrade!.id}/share`, { groupIds: recipients, note }); setShareTrade(null); await refresh(); setTab('Groups'); })} /><Button title="Keep it to myself" secondary disabled={busy} onPress={() => setShareTrade(null)} />
    </ScrollView></SafeAreaView></Modal>
  </KeyboardAvoidingView></SafeAreaView>;
}
