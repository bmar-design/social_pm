import {PortfolioProfile} from './PortfolioProfile';
import {SquadConversation, ChatComposer, ProposalPosition} from './SquadConversation';
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
import { SquadDirectory, SquadHeader, SquadEmpty, SquadAvatar, squadStyles } from './SquadUI';
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
  const [marksUpdatedAt,setMarksUpdatedAt]=useState<number|null>(null);
  const [profile, setProfile] = useState<{ id: string; name: string } | null>(null), [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [chart, setChart] = useState<ChartData|null>(null), [chartRange,setChartRange] = useState('1D');
  const [selectedProposal,setSelectedProposal] = useState<string|null>(null);
  const [squadTab,setSquadTab] = useState<'Chat'|'Positions'>('Chat');
  const [showMembers,setShowMembers] = useState(false);
  const [showGroupForm,setShowGroupForm] = useState(false), [showSettings,setShowSettings] = useState(false);
  const [detail, setDetail] = useState<any>(null), [market, setMarket] = useState<Market | null>(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const feedScroll = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
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
  useEffect(()=>{nearBottom.current=true;if(tab==='Groups'&&detail){if(squadTab==='Chat')feedScroll.current?.scrollToEnd({animated:false});else feedScroll.current?.scrollTo({y:0,animated:false});}},[tab,detail?.group.id,squadTab,selectedProposal]);
  const respondToProposal = (proposalId:string,stance:string)=>void run(async()=>{await api(`groups/${detail.group.id}/responses`,{proposalId,stance});await openGroup(detail.group.id);});
  const openMarket = async (selected: Market) => {
    const fresh = await api(`market-detail?symbol=${encodeURIComponent(selected.id)}&range=1D`);
    setChart(fresh); setChartRange('1D'); setMarket(fresh.market); setSide('yes'); setReview(null); setAmount('10');
  };
  const join = () => requireAccount(async () => {
    const result = await api(`invites/${invite}`, {});
    await SecureStore.deleteItemAsync(pendingKey); setInvite(''); await refresh(); await openGroup(result.id);
  });
  const create = () => requireAccount(async () => { const result = await api('groups', { name: groupName }); setGroupName(''); setShowGroupForm(false); setSquadTab('Chat'); await refresh(); await openGroup(result.id); });
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
    setReview(null); setMarket(null); setShareTrade(result.trade); setRecipients([]); setNote(''); await refresh(); setTab('Home');
  });
  const games = groupGames(markets.filter(m=>m.tags.includes('NCAA Football'))).filter(game => `${game.name} ${game.home} ${game.away}`.toLowerCase().includes(search.toLowerCase()));
  const fill = review ? simulateBuy(review.amount, review.price) : null;
  if (!isReady) return <SafeAreaView style={styles.page}><Text style={[styles.text, { padding: 24 }]}>Opening your account…</Text></SafeAreaView>;
  const errorBanner = error ? <View accessibilityRole="alert" style={styles.card}><Text style={styles.text}>{error}</Text><Button title="Dismiss" secondary onPress={() => setError('')} /></View> : null;
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{backgroundColor:colors.bg,paddingHorizontal:20,paddingVertical:12,display:tab==='Groups'&&detail?'flex':'none'}}>{tab==='Groups' && detail && <SquadHeader name={detail.group.name} count={detail.group.memberCount ?? detail.members.length} active={squadTab} onTab={setSquadTab} onBack={()=>{setDetail(null);setSelectedProposal(null);setShowMembers(false);setSquadTab('Chat');}} onMembers={()=>setShowMembers(!showMembers)} onInvite={()=>void run(()=>Share.share({message:`Join ${detail.group.name}: ${process.env.EXPO_PUBLIC_APP_SCHEME||'socialplays'}://invite/${detail.group.invite}`}))}/>}</View>
    <ScrollView ref={feedScroll} style={{flex:1,minHeight:0}} scrollEventThrottle={100} onScroll={event=>{const {layoutMeasurement,contentOffset,contentSize}=event.nativeEvent;nearBottom.current=layoutMeasurement.height+contentOffset.y>=contentSize.height-100;}} onContentSizeChange={()=>{if(tab==='Groups'&&detail&&squadTab==='Chat'&&nearBottom.current)feedScroll.current?.scrollToEnd({animated:false});}} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl tintColor={colors.accent} refreshing={loading} onRefresh={() => void run(refresh)} />}>
      <Text style={styles.label}>{process.env.EXPO_PUBLIC_UI_PREVIEW === 'true' ? 'UI PREVIEW · SAMPLE DATA' : 'SOCIAL PLAYS · PRACTICE MODE'}</Text>{!market && errorBanner}
      {tab === 'Home' && <>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><View style={{gap:5}}><Text style={styles.title}>Home</Text><Text style={styles.muted}>College football. Better together.</Text></View><View style={{width:44,height:44,borderRadius:22,backgroundColor:colors.card,alignItems:'center',justifyContent:'center'}}><Icon name="football" color={colors.accent} size={22}/></View></View>
        <Field label="Find a matchup" placeholder="Search teams" value={search} onChangeText={setSearch} />
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={styles.heading}>On the board</Text><Text style={styles.muted}>{games.length} games</Text></View>
        {!loading && !games.length && <Text style={styles.muted}>No college-football markets available. Pull down to refresh.</Text>}
        {games.map(game=><GameCard key={game.id} game={game} disabled={busy} onOpen={m=>void run(()=>openMarket(m))}/>)}
      </>}
      {tab === 'Groups' && <>
        {invite && inviteRestored && <View style={styles.card}><Text style={styles.heading}>You’re invited.</Text><Button title={user?'Join group':'Sign in to join'} disabled={busy} onPress={join}/><Button title="Dismiss" secondary onPress={()=>void run(async()=>{await SecureStore.deleteItemAsync(pendingKey);setInvite('');})}/></View>}
        {!user?<Button title="Sign in to see your groups" onPress={()=>setLogin(true)}/>:detail?<>
          {showMembers && <View style={styles.card}><Text style={styles.heading}>Group members</Text>{detail.members.map((member:any)=><View key={member.id} style={squadStyles.member}><SquadAvatar name={member.name} small/><Text style={styles.text}>{member.name}</Text></View>)}</View>}
          {squadTab==='Chat' ? <SquadConversation key={detail.group.id} messages={detail.messages||[]} reactions={detail.reactions||[]} onReact={(targetId,emoji,active)=>void run(async()=>{await api(`groups/${detail.group.id}/reactions`,{targetId,emoji,active});await openGroup(detail.group.id);})} proposals={detail.proposals} userId={profile?.id} busy={busy} onSelect={id=>{setSelectedProposal(id);setSquadTab('Positions');}}/> : (()=>{
            const selected=detail.proposals.find((p:any)=>p.id===selectedProposal);
            const openSymbol=(symbol:string)=>void run(async()=>{const chosen=markets.find(m=>m.id===symbol);if(!chosen)throw Error('This market is unavailable.');await openMarket(chosen);});
            return selected?<ProposalPosition key={selected.id} api={api} proposal={selected} proposals={detail.proposals} busy={busy} onBack={()=>setSelectedProposal(null)} onMarket={()=>openSymbol(selected.symbol)} onRespond={stance=>void run(async()=>{await api(`groups/${detail.group.id}/responses`,{proposalId:selected.id,stance});await openGroup(detail.group.id);})}/>:<>
              {!detail.proposals.length?<SquadEmpty positions onBrowse={()=>setTab('Home')}/>:detail.proposals.map((p:any)=><View key={p.id} style={styles.card}><Pressable accessibilityRole="button" accessibilityLabel={`View ${p.authorName}'s position chart`} onPress={()=>setSelectedProposal(p.id)} style={{gap:10,minHeight:64}}><Text style={styles.label}>{p.authorName}'S PROPOSAL</Text><Text style={styles.heading}>{p.side==='yes'?p.title:p.opposite}</Text><Text style={styles.muted}>Price chart & friends’ buys →</Text></Pressable><View style={{flexDirection:'row',gap:10}}>{(['tail','fade'] as const).map(stance=><View key={stance} style={{flex:1}}><Button title={`${stance==='tail'?'↗ Tail':'↘ Fade'} · ${stance==='tail'?p.tails:p.fades}`} secondary={p.myStance!==stance} disabled={busy} onPress={()=>respondToProposal(p.id,p.myStance===stance?'none':stance)}/></View>)}</View></View>)}
            </>;
          })()}
        </>:<SquadDirectory groups={groups} games={groupGames(markets.filter(m=>m.tags.includes('NCAA Football')))} busy={busy} onOpen={id=>{setSelectedProposal(null);setSquadTab('Chat');setShowMembers(false);void run(()=>openGroup(id));}} onCreate={()=>setShowGroupForm(!showGroupForm)} onMarket={m=>void run(()=>openMarket(m))}/>}
        {showGroupForm&&!detail&&<View style={styles.card}><Text style={styles.heading}>Bring your people.</Text><Field label="Group name" value={groupName} onChangeText={setGroupName} maxLength={60}/><Button title="Create group" disabled={busy||!groupName.trim()} onPress={create}/><Field label="Or paste an invitation" value={inviteText} onChangeText={setInviteText} autoCapitalize="none"/><Button title="Open invitation" secondary disabled={busy||!inviteText} onPress={()=>void run(async()=>{const token=inviteFromUrl(inviteText.trim(),apiUrl,process.env.EXPO_PUBLIC_APP_SCHEME||'socialplays');if(!token)throw Error('Paste a valid invitation.');await SecureStore.setItemAsync(pendingKey,token);setInvite(token);setInviteText('');})}/></View>}
      </>}
      {tab === 'Profile' && <>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={styles.title}>Profile</Text><Pressable accessibilityRole="button" onPress={()=>setShowSettings(!showSettings)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent,fontSize:14}}>Settings</Text></Pressable></View>
        {!user?<Login run={run} busy={busy}/>:<>
          <View style={{alignItems:'center',paddingVertical:20,gap:12}}><View style={{width:72,height:72,borderRadius:36,backgroundColor:colors.avatar,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:28,color:colors.accent,fontWeight:'600'}}>{(profile?.name||'Member')[0]}</Text></View><Text style={styles.heading}>{profile?.name||'Member'}</Text><Text style={styles.muted}>Your plays. Your people.</Text></View>
          {showSettings&&<View style={{gap:16}}><Field label="Display name" value={name} onChangeText={setName} maxLength={60}/><Button title="Save name" disabled={busy||!name.trim()} onPress={()=>void run(async()=>{await api('profile',{name});await refresh();})}/><RecoveryEmail run={run} busy={busy}/><WalletCheck run={run} busy={busy}/><Button title="Sign out" secondary disabled={busy} onPress={()=>void run(logout)}/><Button title="Delete account" secondary disabled={busy} onPress={()=>Alert.alert('Delete your account?','Permanently delete your profile, posts and practice plays?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>void run(async()=>{await api('account/delete',{confirm:'DELETE'});await logout();})}])}/></View>}
          <PortfolioProfile marksUpdatedAt={marksUpdatedAt} trades={trades} markets={markets} busy={busy} onShare={t=>{setShareTrade(t);setRecipients([]);setNote('');}} onMarket={symbol=>void run(async()=>{const selected=markets.find(m=>m.id===symbol);if(!selected)throw Error('This market is unavailable. Its cost remains in your history.');await openMarket(selected);})}/>

        </>}
      </>}
    </ScrollView>
    {tab==='Groups'&&detail&&user&&squadTab==='Chat'&&<ChatComposer key={detail.group.id} busy={busy} onSend={sendMessage}/>}
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
    <Modal visible={!!shareTrade} animationType="slide" onRequestClose={() => { if (!busy) setShareTrade(null); }}><SafeAreaView style={styles.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Text style={styles.title}>Share your play?</Text>{errorBanner}<Text style={styles.muted}>Send this practice buy as a proposal to your groups. Choose up to ten groups. Sharing never places another trade.</Text>
      {groups.map(g => <Button key={g.id} title={`${recipients.includes(g.id) ? '✓ ' : ''}${g.name}`} secondary={!recipients.includes(g.id)} disabled={busy || (!recipients.includes(g.id) && recipients.length >= 10)} onPress={() => setRecipients(ids => ids.includes(g.id) ? ids.filter(id => id !== g.id) : [...ids, g.id])} />)}
      {!groups.length && <Text style={styles.text}>Create or join a group first. This play will be saved in Your plays.</Text>}
      <Field label="Add your take (optional)" value={note} onChangeText={setNote} multiline maxLength={500} /><Button title="Send proposal" disabled={busy || !recipients.length} onPress={() => void run(async () => { await api(`demo-trades/${shareTrade!.id}/share`, { groupIds: recipients, note }); setShareTrade(null); await refresh(); setTab('Groups'); })} /><Button title="Keep it to myself" secondary disabled={busy} onPress={() => setShareTrade(null)} />
    </ScrollView></SafeAreaView></Modal>
  </KeyboardAvoidingView></SafeAreaView>;
}
