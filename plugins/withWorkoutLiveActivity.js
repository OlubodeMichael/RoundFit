/**
 * Expo config plugin — sets up Live Activity prerequisites:
 *   1. Adds NSSupportsLiveActivities to the main app Info.plist
 *   2. Ensures ios/WorkoutLiveActivity/ directory exists so Swift files survive prebuild
 *
 * The Widget Extension Xcode target itself must be added manually in Xcode once
 * (File → New → Target → Widget Extension, see plugins/SETUP_LIVE_ACTIVITY.md).
 * Automated target creation via xcode-js is broken for Widget Extensions —
 * CocoaPods rejects the resulting project because the .appex reference ends up
 * with no PBXGroup parent.
 */

const { withInfoPlist, withDangerousMod } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const EXTENSION_NAME    = 'WorkoutLiveActivity';
const EXTENSION_SOURCES = [
  'ActivityAttributes.swift',
  'WorkoutLiveActivityWidget.swift',
  'WorkoutLiveActivityBundle.swift',
  'Info.plist',
];

// ─── 1. Main app Info.plist — enable Live Activities ─────────────────────────

const withLiveActivityPlist = (config) =>
  withInfoPlist(config, (mod) => {
    mod.modResults['NSSupportsLiveActivities'] = true;
    mod.modResults['NSSupportsLiveActivitiesFrequentUpdates'] = true;
    return mod;
  });

// ─── 2. Copy extension source files into the ios/ folder on prebuild ─────────
//
// Expo prebuild wipes the ios/ directory on --clean, so we keep authoritative
// copies in this plugins/ folder and restore them after every prebuild.

const withExtensionFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    (mod) => {
      const iosRoot   = mod.modRequest.platformProjectRoot;
      const targetDir = path.join(iosRoot, EXTENSION_NAME);
      // Canonical files live in plugins/ — survive `expo prebuild --clean`
      const sourceDir = path.join(
        mod.modRequest.projectRoot,
        'plugins',
        EXTENSION_NAME,
      );

      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      if (fs.existsSync(sourceDir)) {
        for (const filename of EXTENSION_SOURCES) {
          const src = path.join(sourceDir, filename);
          const dst = path.join(targetDir, filename);
          if (fs.existsSync(src)) {
            // Overwrite so updates in plugins/ propagate
            fs.copyFileSync(src, dst);
          }
        }
      }

      return mod;
    },
  ]);

// ─── Compose ──────────────────────────────────────────────────────────────────

module.exports = (config) => {
  config = withLiveActivityPlist(config);
  config = withExtensionFiles(config);
  return config;
};
