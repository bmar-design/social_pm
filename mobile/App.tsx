import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PrivyProvider } from '@privy-io/expo';
import { PrivyElements } from '@privy-io/expo/ui';
import { MobileApp } from './src/MobileApp';
import { styles } from './src/ui';

export default function App() {
  const preview = process.env.EXPO_PUBLIC_UI_PREVIEW === 'true';
  const appId = preview ? 'ui-preview' : process.env.EXPO_PUBLIC_PRIVY_APP_ID;
  const clientId = preview ? 'ui-preview' : process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;
  return <SafeAreaProvider><StatusBar style="light" />{appId && clientId ?
    <PrivyProvider appId={appId} clientId={clientId}><MobileApp /><PrivyElements /></PrivyProvider> :
    <SafeAreaView style={styles.page}><View style={styles.content}><Text style={styles.title}>Social Plays</Text>
      <Text style={styles.text}>The iPhone app is ready to configure.</Text><Text style={styles.muted}>Add your Privy app ID, mobile client ID and app API URL to the mobile environment, then restart the development build.</Text>
    </View></SafeAreaView>}</SafeAreaProvider>;
}
