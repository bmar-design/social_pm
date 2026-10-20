const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.watchFolders = [require('path').resolve(__dirname, '../hosted/lib')];
config.resolver.unstable_enablePackageExports = true;
// Privy's documented Metro compatibility settings for its transitive packages.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'isows' || moduleName.startsWith('zustand')) {
    const next = { ...context, unstable_enablePackageExports: false };
    return next.resolveRequest(next, moduleName, platform);
  }
  if (moduleName === 'jose') {
    const next = { ...context, unstable_conditionNames: ['browser'] };
    return next.resolveRequest(next, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
