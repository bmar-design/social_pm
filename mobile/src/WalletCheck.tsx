import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { Button, styles } from './ui';

// Explicitly a development diagnostic. Never signs a trading authorization,
// registers a Pascal key, funds an address, or submits a transaction.
export function WalletCheck({ run, busy }: { run: (fn: () => Promise<unknown>) => void; busy: boolean }) {
  const wallet = useEmbeddedSolanaWallet();
  const [result, setResult] = useState('');
  if (!__DEV__ || process.env.EXPO_PUBLIC_UI_PREVIEW === 'true') return null;
  return <View style={styles.card}><Text style={styles.heading}>Wallet integration check</Text><Text style={styles.muted}>Development only. Creates a Solana wallet and signs a diagnostic message. Keep this wallet unfunded. Pascal compatibility still requires a separate integration check.</Text>
    <Text style={styles.muted}>Status: {wallet.status}</Text>
    {wallet.wallets?.[0] && <Text selectable style={styles.muted}>{wallet.wallets[0].address}</Text>}
    {wallet.status === 'not-created' && <Button title="Create test wallet" disabled={busy} onPress={() => run(async () => { await wallet.create(); })} />}
    {wallet.status === 'connected' && <Button title="Test message signing" disabled={busy} onPress={() => run(async () => {
      const provider = await wallet.wallets[0].getProvider();
      const response = await provider.request({ method: 'signMessage', params: { message: `Social Plays diagnostic only. No trading permission. ${Date.now()}` } });
      if (!response.signature) throw Error('No signature returned.');
      setResult('Signature returned. Next: verify Pascal message encoding and account recovery on a second device.');
    })} />}
    {!!result && <Text style={styles.text}>{result}</Text>}
  </View>;
}
