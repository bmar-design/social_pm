module.exports = {
  expo: {
    name: 'Social Plays', slug: 'social-plays', version: '0.1.0',
    orientation: 'portrait', userInterfaceStyle: 'light',
    scheme: process.env.EXPO_PUBLIC_APP_SCHEME || 'socialplays',
    ios: {
      supportsTablet: false,
      bundleIdentifier: process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || 'com.yourcompany.socialplays',
      usesAppleSignIn: true,
    },
    plugins: ['expo-secure-store', 'expo-web-browser', 'expo-apple-authentication'],
    experiments: { tsconfigPaths: true },
  },
};
