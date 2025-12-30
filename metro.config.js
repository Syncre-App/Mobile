const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

// Completely disable Watchman - use Node's fs.watch instead
// This fixes "Operation not permitted" errors on macOS
config.watcher = {
  ...config.watcher,
  watchman: false,
};

module.exports = config;
