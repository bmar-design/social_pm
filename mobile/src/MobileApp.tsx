import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
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

type Group = { id: string; name: string; memberCount: number; proposalCount: number };
type Trade = { id: string; symbol: string; title: string; opposite: string; side: string; contracts: number; cost_cents: number; created: number };
type Review = { market: Market; side: 'yes' | 'no'; amount: number; price: number; id: string; reviewedAt: number };
const pendingKey = 'pending-group-invite';
const tabs = ['Games', 'Groups', 'Your plays', 'You'] as const;

export function MobileApp() {
  const auth = usePrivy();
  // Remount private UI on an account change so no previous user's state survives.
  return <SessionApp key={auth.user?.id || 'guest'} />;
}

function SessionApp() {
  const { user, isReady, getAccessToken, logout } = usePrivy();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  const [tab, setTab] = useState<typeof tabs[number]>('Games');
  const [markets, setMarkets] = useState<Market[]>([]), [groups, setGroups] = useState<Group[]>([]), [trades, setTrades] = useState<Trade[]>([]);
  const [profile, setProfile] = useState<{ id: string; name: string } | null>(null), [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false), [blocked, setBlocked] = useState<{id:string;name:string}[]>([]);
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
      ...(user ? [api('me').then(data => { setProfile(data.user); setNeedsName(data.needsName); setName(data.needsName ? '' : data.user?.name || ''); }), api('groups').then(data => setGroups(data.groups)), api('demo-trades').then(data => setTrades(data.trades)), api('blocks').then(data => setBlocked(data.blocks))] : []),
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
    setMarket(fresh.market); setSide('yes'); setReview(null); setAmount('10');
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
    setMarket(fresh.market); setReview({ market: fresh.market, side, amount: cents, price: micros, id: Crypto.randomUUID(), reviewedAt: Date.now() });
  });
  const confirm = () => void run(async () => {
    if (!review) return;
    const result = await api('demo-trades', { requestId: review.id, symbol: review.market.id, side: review.side, amountCents: review.amount, priceMicros: review.price });
    // The same request ID survives errors so an ambiguous network retry cannot duplicate a buy.
    setReview(null); setMarket(null); setShareTrade(result.trade); setRecipients([]); setNote(''); await refresh(); setTab('Your plays');
  });
  const games = groupGames(markets).filter(game => `${game.name} ${game.home} ${game.away}`.toLowerCase().includes(search.toLowerCase()));
  const fill = review ? simulateBuy(review.amount, review.price) : null;
  if (!isReady) return <SafeAreaView style={styles.page}><Text style={[styles.text, { padding: 24 }]}>Opening your account…</Text></SafeAreaView>;
  const errorBanner = error ? <View accessibilityRole="alert" style={styles.card}><Text style={styles.text}>{error}</Text><Button title="Dismiss" secondary onPress={() => setError('')} /></View> : null;
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl tintColor={colors.accent} refreshing={loading} onRefresh={() => void run(refresh)} />}>
      <Text style={styles.label}>SOCIAL PLAYS · PRACTICE MODE</Text>{!market && errorBanner}
      {tab === 'Games' && <><Text style={styles.title}>Find your next play.</Text><Text style={styles.muted}>College football, with your people. All buys use practice dollars.</Text>
        <Field label="Search games" value={search} onChangeText={setSearch} />
        {!loading && !games.length && <Text style={styles.text}>No games available. Pull down to refresh.</Text>}
        {games.map(game => <View key={game.id} style={styles.card}><Text style={styles.muted}>{game.startsAt ? new Date(game.startsAt).toLocaleString() : 'Season market'}</Text><Text style={styles.heading}>{game.name}</Text>
          <Text style={styles.muted}>{game.markets.length} markets · indicative prices</Text>{game.markets.map(m => <Button key={m.id} title={`${m.title} · ${m.price === null ? 'Unavailable' : `${Math.round(m.price * 100)}¢`}`} secondary disabled={busy} onPress={() => void run(() => openMarket(m))} />)}</View>)}</>}
      {tab === 'Groups' && <><Text style={styles.title}>{detail ? detail.group.name : 'Your groups'}</Text>
        {invite && inviteRestored && <View style={styles.card}><Text style={styles.heading}>Your friend invited you.</Text><Text style={styles.muted}>Join this private group to see its conversation.</Text><Button title={user ? 'Join group' : 'Sign in to join'} disabled={busy} onPress={join} /><Button title="Dismiss invite" secondary onPress={() => void run(async () => { await SecureStore.deleteItemAsync(pendingKey); setInvite(''); })} /></View>}
        {!user ? <Button title="Sign in to find your people" onPress={() => setLogin(true)} /> : detail ? <>
          <Button title="Back to groups" secondary onPress={() => setDetail(null)} /><Text style={styles.muted}>{detail.members.map((m: any) => m.name).join(', ')}</Text>
          <Button title="Invite friends" onPress={() => void run(() => Share.share({ message: `Join ${detail.group.name} on Social Plays: ${apiUrl}/?invite=${detail.group.invite}\nOpen in the iPhone app: ${process.env.EXPO_PUBLIC_APP_SCHEME || 'socialplays'}://invite/${detail.group.invite}` }))} />
          <Button title="Refresh conversation" secondary disabled={busy} onPress={() => void run(() => openGroup(detail.group.id))} />
          <Text style={styles.muted}>Tail and Fade share your opinion. They never place an order.</Text>
          {!detail.proposals.length && <Text style={styles.text}>Start with an angle. Find a game and share your practice play.</Text>}
          {detail.proposals.map((p: any) => <View style={styles.card} key={p.id}><Text style={styles.muted}>{p.authorName} · {new Date(p.created).toLocaleString()}</Text><Text style={styles.heading}>{p.side === 'yes' ? p.title : p.opposite}</Text>{!!p.note && <Text style={styles.text}>{p.note}</Text>}
            <View style={styles.row}>{(['tail', 'fade'] as const).map(stance => <Button key={stance} title={`${stance === 'tail' ? 'Tail' : 'Fade'} · ${stance === 'tail' ? p.tails : p.fades}${p.myStance === stance ? ' ✓' : ''}`} secondary={p.myStance !== stance} disabled={busy} onPress={() => void run(async () => { await api(`groups/${detail.group.id}/responses`, { proposalId: p.id, stance: p.myStance === stance ? 'none' : stance }); await openGroup(detail.group.id); })} />)}</View>
            <Button title="Report this post" secondary disabled={busy} onPress={() => Alert.alert('Report post', 'Send this post for review?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', onPress: () => void run(async () => { await api('reports', { proposalId: p.id, reason: 'Reported from iPhone' }); Alert.alert('Report received', 'The post has been submitted for review.'); }) }])} />
            {p.author !== user.id && <Button title={`Block ${p.authorName}`} secondary disabled={busy} onPress={() => Alert.alert('Block this member?', 'Their posts will be hidden from your feeds. You can unblock them in You.', [{text:'Cancel',style:'cancel'},{text:'Block',style:'destructive',onPress:()=>void run(async()=>{await api('blocks',{userId:p.author});await refresh();await openGroup(detail.group.id);})}])} />}
          </View>)}
        </> : <>{groups.map(g => <View key={g.id} style={styles.card}><Text style={styles.heading}>{g.name}</Text><Text style={styles.muted}>{g.memberCount} members · {g.proposalCount} ideas</Text><Button title="Open group" secondary disabled={busy} onPress={() => void run(() => openGroup(g.id))} /></View>)}
          <Field label="New group name" value={groupName} onChangeText={setGroupName} maxLength={60} /><Button title="Create a group" disabled={busy || !groupName.trim()} onPress={create} /></>}
        <Field label="Paste a group invitation" value={inviteText} onChangeText={setInviteText} autoCapitalize="none" />
        <Button title="Open invitation" secondary disabled={busy || !inviteText} onPress={() => void run(async () => { const token = inviteFromUrl(inviteText.trim(), apiUrl, process.env.EXPO_PUBLIC_APP_SCHEME || 'socialplays'); if (!token) throw Error('Paste a valid invitation from this app.'); await SecureStore.setItemAsync(pendingKey, token); setInvite(token); setInviteText(''); })} />
      </>}
      {tab === 'Your plays' && <><Text style={styles.title}>Your practice plays</Text><Text style={styles.muted}>Simulated buys at live quote snapshots. No real money, settlement or guaranteed fills.</Text>
        {!user ? <Button title="Sign in to view your plays" onPress={() => setLogin(true)} /> : !trades.length ? <Text style={styles.text}>Your first play starts with a game.</Text> : trades.map(t => <View style={styles.card} key={t.id}><Text style={styles.label}>PRACTICE BUY</Text><Text style={styles.heading}>{t.side === 'yes' ? t.title : t.opposite}</Text><Text style={styles.text}>{t.contracts} contracts · {money(t.cost_cents)}</Text><Text style={styles.muted}>{new Date(t.created).toLocaleString()}</Text><Button title="Share to a group" secondary onPress={() => { setShareTrade(t); setRecipients([]); setNote(''); }} /></View>)}</>}
      {tab === 'You' && <><Text style={styles.title}>{profile?.name || 'Your space'}</Text>{!user ? <Login run={run} busy={busy} /> : <>
        <Field label="Display name" value={name} onChangeText={setName} maxLength={60} /><Button title="Save name" disabled={busy || !name.trim()} onPress={() => void run(async () => { await api('profile', { name }); await refresh(); })} />
        <RecoveryEmail run={run} busy={busy} /><WalletCheck run={run} busy={busy} />
        {!!blocked.length && <View style={styles.card}><Text style={styles.heading}>Blocked members</Text>{blocked.map(member=><Button key={member.id} title={`Unblock ${member.name}`} secondary disabled={busy} onPress={()=>void run(async()=>{await api('blocks',{userId:member.id,remove:true});await refresh();})}/>)}</View>}
        <Text style={styles.muted}>Your phone and recovery email are private. Group members see your chosen name and anything you share. Sharing a practice play is always optional.</Text>
        <Button title="Sign out" secondary disabled={busy} onPress={() => void run(logout)} />
        <Button title="Delete account" secondary disabled={busy} onPress={() => Alert.alert('Delete your account?', 'This permanently deletes your profile, practice plays and posts. It also removes your sign-in account. This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete account', style: 'destructive', onPress: () => void run(async () => { await api('account/delete', { confirm: 'DELETE' }); await logout(); }) }])} />
      </>}</>}
    </ScrollView>
    <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 8, gap: 4, borderTopWidth: 1, borderColor: colors.border }}>{tabs.map(t => <View key={t} style={{ flex: 1 }}><Button title={t} secondary={tab !== t} onPress={() => { setTab(t); setDetail(null); setError(''); }} /></View>)}</View>
    <Modal visible={login && !user} animationType="slide" onRequestClose={() => setLogin(false)}><SafeAreaView style={styles.page}><KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Button title="Back to browsing" secondary onPress={() => setLogin(false)} />{errorBanner}<Login run={run} busy={busy} /></ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
    <Modal visible={!!user && needsName} animationType="slide" onRequestClose={()=>{}}><SafeAreaView style={styles.page}><KeyboardAvoidingView behavior="padding" style={{flex:1}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Text style={styles.title}>What should your friends call you?</Text><Text style={styles.muted}>Only your chosen name is shown in groups.</Text>{errorBanner}<Field label="Display name" value={name} onChangeText={setName} maxLength={60} autoFocus/><Button title="Continue" disabled={busy||!name.trim()} onPress={()=>void run(async()=>{await api('profile',{name});await refresh();})}/><Button title="Sign out" secondary disabled={busy} onPress={()=>void run(logout)}/></ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
    <Modal visible={!!market} animationType="slide" onRequestClose={() => { if (!busy) { setMarket(null); setReview(null); } }}><SafeAreaView style={styles.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Button title="Back to games" secondary disabled={busy} onPress={() => { setMarket(null); setReview(null); }} />{errorBanner}{market && <><Text style={styles.label}>PRACTICE BUY</Text><Text style={styles.title}>{market.game}</Text><Text style={styles.muted}>{market.event}</Text>
        {review && fill ? <View style={styles.card}><Text style={styles.heading}>Review your practice play</Text><Text style={styles.text}>{review.side === 'yes' ? review.market.title : review.market.opposite}</Text><Text style={styles.text}>{fill.contracts} contracts · {money(fill.costCents)} total</Text><Text style={styles.muted}>Practice fees: $0. Potential payout including stake: {money(fill.payoutCents)}. Maximum simulated loss: {money(fill.costCents)}. Assumes an immediate full fill; real trading can differ. Sharing happens after confirmation.</Text><Button title={busy ? 'Confirming…' : 'Confirm practice buy'} disabled={busy} onPress={confirm} /><Button title="Edit amount or outcome" secondary disabled={busy} onPress={() => setReview(null)} /></View> : <><Text style={styles.heading}>{market.title}</Text><Button title={`${market.title}${side === 'yes' ? ' ✓' : ''}`} secondary={side !== 'yes'} onPress={() => setSide('yes')} /><Button title={`${market.opposite}${side === 'no' ? ' ✓' : ''}`} secondary={side !== 'no'} onPress={() => setSide('no')} /><Field label="Practice dollars" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /><Button title="Review practice buy" disabled={busy} onPress={() => { if (!user) { setMarket(null); setLogin(true); } else prepareReview(); }} /><Text style={styles.muted}>A fresh quote is checked before review and again by the server on confirmation. No actual order is submitted.</Text></>}
      </>}</ScrollView></SafeAreaView></Modal>
    <Modal visible={!!shareTrade} animationType="slide" onRequestClose={() => { if (!busy) setShareTrade(null); }}><SafeAreaView style={styles.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Text style={styles.title}>Your play. Your people.</Text>{errorBanner}<Text style={styles.muted}>Choose up to ten groups. Sharing never places another buy.</Text>
      {groups.map(g => <Button key={g.id} title={`${recipients.includes(g.id) ? '✓ ' : ''}${g.name}`} secondary={!recipients.includes(g.id)} disabled={busy || (!recipients.includes(g.id) && recipients.length >= 10)} onPress={() => setRecipients(ids => ids.includes(g.id) ? ids.filter(id => id !== g.id) : [...ids, g.id])} />)}
      {!groups.length && <Text style={styles.text}>Create or join a group first. This play will be saved in Your plays.</Text>}
      <Field label="Add your take (optional)" value={note} onChangeText={setNote} multiline maxLength={500} /><Button title="Share practice play" disabled={busy || !recipients.length} onPress={() => void run(async () => { await api(`demo-trades/${shareTrade!.id}/share`, { groupIds: recipients, note }); setShareTrade(null); await refresh(); setTab('Groups'); })} /><Button title="Keep it to myself" secondary disabled={busy} onPress={() => setShareTrade(null)} />
    </ScrollView></SafeAreaView></Modal>
  </KeyboardAvoidingView></SafeAreaView>;
}
