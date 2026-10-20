import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useLoginWithSMS, useLoginWithOAuth, useLoginWithEmail, useLinkEmail } from '@privy-io/expo';
import { Button, Field, styles } from './ui';

export function Login({ run, busy }: { run: (fn: () => Promise<unknown>) => void; busy: boolean }) {
  const sms = useLoginWithSMS(), emailLogin = useLoginWithEmail(), apple = useLoginWithOAuth();
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [identifier, setIdentifier] = useState(''), [code, setCode] = useState(''), [sent, setSent] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const send = () => run(async () => {
    if (Date.now() < resendAt) throw Error('Wait a minute before requesting another code.');
    if (method === 'phone') {
      const phone = identifier.replace(/[\s()-]/g, '');
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw Error('Include your country code, for example +1 313 555 0123.');
      await sms.sendCode({ phone });
    } else await emailLogin.sendCode({ email: identifier.trim() });
    setSent(true); setResendAt(Date.now() + 60000);
  });
  return <View style={styles.card}><Text style={styles.label}>YOUR PEOPLE. YOUR NEXT PLAY.</Text><Text style={styles.title}>Come on in.</Text>
    <Text style={styles.muted}>Verify your account to create a group or make a practice play. Your phone number stays private.</Text>
    <Field label={method === 'phone' ? 'Phone number with country code' : 'Email address'} value={identifier} onChangeText={setIdentifier}
      keyboardType={method === 'phone' ? 'phone-pad' : 'email-address'} autoCapitalize="none" editable={!sent && !busy} autoComplete={method === 'phone' ? 'tel' : 'email'} />
    {sent && <Field label="Verification code" value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" />}
    <Button title={busy ? 'Please wait…' : sent ? 'Verify and continue' : 'Send code'} disabled={busy || !identifier || (sent && !code)} onPress={sent ? () => run(() => method === 'phone' ? sms.loginWithCode({ code, phone: identifier.replace(/[\s()-]/g, '') }) : emailLogin.loginWithCode({ code, email: identifier.trim() })) : send} />
    {sent && <><Button title="Resend code" secondary disabled={busy} onPress={send} /><Button title="Change number or email" secondary disabled={busy} onPress={() => { setSent(false); setCode(''); }} /></>}
    {Platform.OS === 'ios' ? <View pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy ? 0.4 : 1 }}><AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={14} style={{ height: 48, width: '100%' }} onPress={() => run(() => apple.login({ provider: 'apple' }))} /></View> :
      <Button title="Continue with Apple" secondary disabled={busy} onPress={() => run(() => apple.login({ provider: 'apple' }))} />}
    <Button title={method === 'phone' ? 'Use email instead' : 'Use phone instead'} secondary disabled={busy} onPress={() => { setMethod(method === 'phone' ? 'email' : 'phone'); setIdentifier(''); setCode(''); setSent(false); }} />
    <Text style={styles.muted}>Sign back in using the same method to restore your groups and practice plays.</Text>
  </View>;
}

export function RecoveryEmail({ run, busy }: { run: (fn: () => Promise<unknown>) => void; busy: boolean }) {
  const link = useLinkEmail();
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [sent, setSent] = useState(false), [done, setDone] = useState(false);
  return <View style={styles.card}><Text style={styles.heading}>Account recovery</Text><Text style={styles.muted}>Link an email while signed in. Use that email to access this same account if your phone number changes.</Text>
    {done ? <Text style={styles.text}>Recovery email verified.</Text> : <><Field label="Recovery email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!sent} />
      {sent && <Field label="Email verification code" value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" />}
      <Button title={sent ? 'Verify recovery email' : 'Send email code'} disabled={busy || !email || (sent && !code)} onPress={() => run(async () => {
        if (sent) { await link.linkWithCode({ email: email.trim(), code }); setDone(true); }
        else { await link.sendCode({ email: email.trim() }); setSent(true); }
      })} /></>}
  </View>;
}
