import React,{useEffect,useRef,useState} from 'react';
import {Text,View,Linking,Platform} from 'react-native';
import {useEmbeddedSolanaWallet} from '@privy-io/expo';
import {ed25519} from '@noble/curves/ed25519';
import {base58,base64} from '@scure/base';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {Button,styles} from './ui';
import {account,builderConfig,ownerMessage,publicKey,request,utf8,PascalError,type Auth} from './pascal';

export function PascalAccount(){
 if(process.env.EXPO_PUBLIC_PASCAL_ENABLED!=='true'||process.env.EXPO_PUBLIC_UI_PREVIEW==='true'||Platform.OS==='web')return null;
 return <ConnectedAccount/>;
}
function ConnectedAccount(){
 const wallet=useEmbeddedSolanaWallet(),owner=wallet.wallets?.[0]?.address;
 const locked=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const [snapshot,setSnapshot]=useState<any>(null),[deposit,setDeposit]=useState(''),[key,setKey]=useState('');
 let builder;let configError='';
 try{builder=builderConfig(process.env.EXPO_PUBLIC_PASCAL_BUILDER_PUBLIC_KEY,process.env.EXPO_PUBLIC_PASCAL_BUILDER_FEE_RATE);}catch(e){configError=(e as Error).message;}
 const run=async(fn:()=>Promise<void>)=>{if(locked.current)return;locked.current=true;setBusy(true);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{locked.current=false;setBusy(false);}};
 useEffect(()=>{
  let active=true;setKey('');setSnapshot(null);setDeposit('');setStatus('');
  if(owner)void SecureStore.getItemAsync(`pascal-key-${owner}`).then(stored=>{if(active&&stored)setKey(JSON.parse(stored).publicKey);}).catch(()=>{if(active)setError('Could not restore the saved trading key.');});
  return()=>{active=false;};
 },[owner]);
 const refresh=async()=>{
  if(!owner)return;
  const next=await account(owner);setSnapshot(next);
  const address=await request(`accounts/${owner}/deposit-address`);
  setDeposit(address.registered?address.deposit_address||'':'');
  const stored=await SecureStore.getItemAsync(`pascal-key-${owner}`);
  if(stored){const record=JSON.parse(stored);setKey(record.publicKey);}
 };
 const sign=async(command:'create_trading_key'|'revoke_trading_key'|'register_deposit_address',args:unknown[])=>{
  if(!owner)throw Error('Create a wallet first.');
  // Persist a strictly increasing owner nonce before any wallet prompt/network write.
  const nonceKey=`pascal-nonce-${owner}`,previous=Number(await SecureStore.getItemAsync(nonceKey)||0);
  const time=Math.max(Date.now(),previous+1);await SecureStore.setItemAsync(nonceKey,String(time));
  const auth:Auth={owner,signer:owner,client_ts_ms:String(time),recv_window_ms:'60000'};
  const activeWallet=wallet.wallets?.[0];if(!activeWallet||activeWallet.address!==owner)throw Error('Wallet disconnected.');
  const message=ownerMessage(command,args,auth),provider=await activeWallet.getProvider();
  const result=await provider.request({method:'signMessage',params:{message}});
  // Privy returns base64 for embedded Solana signatures. Verify actual bytes,
  // accepting base58 only if cryptographic verification succeeds as well.
  let signature:Uint8Array|undefined;
  for(const codec of [base64,base58]){try{const bytes=codec.decode(result.signature);if(bytes.length===64&&ed25519.verify(bytes,utf8(message),publicKey(owner))){signature=bytes;break;}}catch{}}
  if(!signature)throw Error('The wallet signature did not verify against Pascal’s exact message bytes.');
  return {...auth,signature:base58.encode(signature)};
 };
 const authorize=async()=>{
  if(!owner)return;
  const storageKey=`pascal-key-${owner}`;
  let record=JSON.parse(await SecureStore.getItemAsync(storageKey)||'null');
  if(record)throw Error('Revoke the saved trading key before creating another.');
  const seed=await Crypto.getRandomBytesAsync(32),publicKey=base58.encode(ed25519.getPublicKey(seed)),expiration=Date.now()+86400000;
  record={seed:base64.encode(seed),publicKey,expiration,name:'SocialPlays'};
  // Save before submission so an ambiguous registration remains recoverable.
  await SecureStore.setItemAsync(storageKey,JSON.stringify(record),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
  seed.fill(0);setKey(publicKey);
  let auth;
  try{auth=await sign('create_trading_key',[record.name,publicKey,expiration]);}
  catch(e){await SecureStore.deleteItemAsync(storageKey);setKey('');throw e;}
  await request('trading-keys',{trading_key:publicKey,name:record.name,expiration_ts_ms:String(expiration),auth});
  setStatus('Trading key registered for 24 hours. It cannot withdraw funds.');
 };
 const revoke=async()=>{
  if(!owner||!key)return;
  const auth=await sign('revoke_trading_key',[key]);
  try{await request('trading-key-revocations',{trading_key:key,auth});}
  catch(e){
   if(!(e instanceof PascalError)||e.code!=='TRADING_KEY_NOT_FOUND')throw e;
   const active=await request(`accounts/${owner}/trading-keys`);
   if(!Array.isArray(active)||active.some((record:any)=>record.trading_key===key))throw e;
  }
  await SecureStore.deleteItemAsync(`pascal-key-${owner}`);setKey('');setStatus('Trading key revoked.');
 };
 return <View style={styles.card}><Text style={styles.heading}>Pascal account</Text>
  <Text style={styles.muted}>USDC trading account. Funds and positions are separate from practice plays.</Text>
  {!!owner&&<Text selectable style={styles.muted}>{owner}</Text>}
  {wallet.status==='not-created'&&<Button title="Create Solana wallet" disabled={busy} onPress={()=>void run(async()=>{await wallet.create();})}/>}
  {!!owner&&<><Button title="Refresh Pascal account" disabled={busy} onPress={()=>void run(refresh)}/>
   <Button title="Register USDC deposit address" disabled={busy} onPress={()=>void run(async()=>{const auth=await sign('register_deposit_address',[owner]);const result=await request('deposit-addresses',{owner,auth});setDeposit(result.registered?result.deposit_address||'':'');setStatus('Deposit address registered.');})}/>
   {!!deposit&&<><Text style={styles.muted}>Solana USDC deposit address. Pending deposits are not spendable.</Text><Text selectable style={styles.text}>{deposit}</Text></>}
   {snapshot&&<><Text style={styles.text}>Available: {snapshot.collateral_usd??'Unavailable'} USDC</Text><Text style={styles.muted}>{snapshot.positions?.length??0} positions · {snapshot.orders?.length??0} open orders · {snapshot.pending_deposits?.length??0} pending deposits · {snapshot.pending_withdrawals?.length??0} pending withdrawals</Text>{(snapshot.positions||[]).map((position:any,i:number)=><Text key={position.symbol||i} style={styles.muted}>{position.symbol}: {position.size??position.position_size??'—'} contracts · P&L {position.unrealized_pnl_usd??'Unavailable'} USD</Text>)}</>}
   {!key?<Button title="Authorize trading for 24 hours" disabled={busy} onPress={()=>void run(authorize)}/>:<><Text selectable style={styles.muted}>Saved trading key: {key}</Text><Button title="Revoke saved trading key" disabled={busy} onPress={()=>void run(revoke)}/></>}
  </>}
  <Text style={styles.muted}>{configError|| (builder?`Builder wallet: ${builder.builder_pubkey} · fee rate ${builder.builder_fee_rate}`:'Builder wallet and fee rate have not been configured.')}</Text>
  <Text style={styles.muted}>In-app trading is unavailable until builder signature encoding is verified. Keep this integration wallet unfunded until device recovery and withdrawal acceptance tests pass.</Text>
  <Button title="Open Pascal" secondary onPress={()=>void Linking.openURL('https://app.pascal.trade')}/>
  {!!status&&<Text style={styles.text}>{status}</Text>}{!!error&&<Text accessibilityRole="alert" style={styles.muted}>{error}</Text>}
 </View>;
}
