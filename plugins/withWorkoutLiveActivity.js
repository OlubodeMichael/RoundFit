/**
 * Expo config plugin — adds the WorkoutLiveActivity Widget Extension target to
 * the Xcode project and sets the required Info.plist keys.
 *
 * Applied automatically via app.config.js:
 *   plugins: [..., "./plugins/withWorkoutLiveActivity"]
 */

const {
  withInfoPlist,
  withXcodeProject,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const EXTENSION_NAME    = 'WorkoutLiveActivity';
const EXTENSION_SOURCES = [
  'ActivityAttributes.swift',
  'WorkoutLiveActivityWidget.swift',
  'WorkoutLiveActivityBundle.swift',
];

// ─── 1. Main app Info.plist — enable Live Activities ─────────────────────────

const withLiveActivityPlist = (config) =>
  withInfoPlist(config, (mod) => {
    mod.modResults['NSSupportsLiveActivities'] = true;
    mod.modResults['NSSupportsLiveActivitiesFrequentUpdates'] = true;
    return mod;
  });

// ─── 2. Ensure extension source directory exists ─────────────────────────────

const withExtensionFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    (mod) => {
      const iosRoot = mod.modRequest.platformProjectRoot;
      const extDir  = path.join(iosRoot, EXTENSION_NAME);
      if (!fs.existsSync(extDir)) fs.mkdirSync(extDir, { recursive: true });
      return mod;
    },
  ]);

// ─── 3. Add Widget Extension target to .xcodeproj ───────────────────────────

const withExtensionTarget = (config) =>
  withXcodeProject(config, (mod) => {
    const xcodeProject = mod.modResults;
    const iosRoot      = mod.modRequest.platformProjectRoot;
    const extBundleId  = `${config.ios?.bundleIdentifier ?? 'com.michaelolu.roundfit'}.WorkoutLiveActivity`;

    // Idempotent — skip if the target was already added on a prior prebuild
    if (xcodeProject.pbxTargetByName(EXTENSION_NAME)) return mod;

    const extDir = path.join(iosRoot, EXTENSION_NAME);
    if (!fs.existsSync(extDir)) fs.mkdirSync(extDir, { recursive: true });

    // Group inside the project for the extension files
    const groupKey =
      xcodeProject.findPBXGroupKey({ name: EXTENSION_NAME }) ??
      xcodeProject.addPbxGroup([], EXTENSION_NAME, EXTENSION_NAME).uuid;

    // Add source + plist files to the group (skip if missing on disk)
    for (const filename of [...EXTENSION_SOURCES, 'Info.plist']) {
      const filePath = path.join(extDir, filename);
      if (!fs.existsSync(filePath)) continue;

      xcodeProject.addFile(`${EXTENSION_NAME}/${filename}`, groupKey, {
        lastKnownFileType: filename.endsWith('.plist')
          ? 'text.plist.xml'
          : 'sourcecode.swift',
      });
    }

    // Create the extension target
    const target = xcodeProject.addTarget(
      EXTENSION_NAME,
      'app_extension',
      EXTENSION_NAME,
      extBundleId,
    );

    if (target) {
      // Add Swift sources to the new target's compile phase
      xcodeProject.addBuildPhase(
        EXTENSION_SOURCES.map((f) => `${EXTENSION_NAME}/${f}`),
        'PBXSourcesBuildPhase',
        'Sources',
        target.uuid,
      );

      // Build settings for the extension
      const setProp = (key, val, cfg) =>
        xcodeProject.addBuildProperty(key, val, cfg, target.uuid);

      for (const cfg of ['Debug', 'Release']) {
        setProp('SWIFT_VERSION',                  '5.0',  cfg);
        setProp('TARGETED_DEVICE_FAMILY',         '"1,2"', cfg);
        setProp('IPHONEOS_DEPLOYMENT_TARGET',     '16.1', cfg);
        setProp('INFOPLIST_FILE',                 `${EXTENSION_NAME}/Info.plist`, cfg);
        setProp('PRODUCT_BUNDLE_IDENTIFIER',      extBundleId, cfg);
        setProp('CODE_SIGN_STYLE',                'Automatic', cfg);
        setProp('LD_RUNPATH_SEARCH_PATHS',        '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"', cfg);
        setProp('GENERATE_INFOPLIST_FILE',        'NO', cfg);
        setProp('CURRENT_PROJECT_VERSION',        '1', cfg);
        setProp('MARKETING_VERSION',              '1.0', cfg);
      }

      // Embed the extension into the main app
      xcodeProject.addBuildPhase(
        [`${EXTENSION_NAME}.appex`],
        'PBXCopyFilesBuildPhase',
        'Embed Foundation Extensions',
        xcodeProject.getFirstTarget().uuid,
        'wrapper.app-extension',
      );
    }

    return mod;
  });

// ─── Compose ──────────────────────────────────────────────────────────────────

module.exports = (config) => {
  config = withLiveActivityPlist(config);
  config = withExtensionFiles(config);
  config = withExtensionTarget(config);
  return config;
};
