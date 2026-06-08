// @ts-check
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const base = getDefaultConfig(__dirname);

// Watchman can fail on macOS with FSEventStreamStart errors; Metro then crashes
// after the crawl retry. Disabling Watchman uses Node/native file watching instead.
/** @type {import('expo/metro-config').MetroConfig} */
module.exports = {
  ...base,
  resolver: {
    ...base.resolver,
    useWatchman: false,
  },
};
