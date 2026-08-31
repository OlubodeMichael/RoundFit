#!/usr/bin/env node
/**
 * Keep every iOS bundle's version in lockstep with `app.config.js`.
 *
 * App Store Connect rejects an upload whose embedded watch app or app extension
 * doesn't carry the *same* CFBundleShortVersionString and CFBundleVersion as the
 * host app. RoundFit ships four bundles — the app, the watch app, the watch
 * widget and the Live Activity extension — and only the host app's Info.plist
 * was ever being updated, so the numbers drifted apart silently and only
 * surfaced at upload time.
 *
 * `app.config.js` (`version` + `ios.buildNumber`) is the single source of truth;
 * this script pushes it into the native files.
 *
 *   node scripts/sync-ios-versions.js           # sync native files to app.config
 *   node scripts/sync-ios-versions.js --bump    # buildNumber += 1, then sync
 *   node scripts/sync-ios-versions.js --check   # verify only, non-zero on drift
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_CONFIG = path.join(ROOT, 'app.config.js');
const PBXPROJ = path.join(ROOT, 'ios/RoundFit.xcodeproj/project.pbxproj');
const PLISTS = [
  'ios/RoundFit/Info.plist',
  'ios/RoundFitWatch/Info.plist',
  'ios/RoundFitWatchWidget/Info.plist',
  'ios/WorkoutLiveActivity/Info.plist',
].map((p) => path.join(ROOT, p));

/** Build configs for the embedded bundles, which version via build settings. */
const EMBEDDED_BUNDLE_ID = /PRODUCT_BUNDLE_IDENTIFIER = co\.roundfit\.app\.(watchkitapp|WorkoutLiveActivity)/;

const mode = process.argv.includes('--check')
  ? 'check'
  : process.argv.includes('--bump')
    ? 'bump'
    : 'sync';

const problems = [];
const changes = [];

function readAppConfig() {
  const source = fs.readFileSync(APP_CONFIG, 'utf8');
  const version = source.match(/^\s*version:\s*"([^"]+)"/m);
  const buildNumber = source.match(/^\s*buildNumber:\s*"([^"]+)"/m);
  if (!version) throw new Error('Could not find `version` in app.config.js');
  if (!buildNumber) throw new Error('Could not find `ios.buildNumber` in app.config.js');
  return { source, version: version[1], buildNumber: buildNumber[1] };
}

function setPlistValue(file, key, value) {
  const text = fs.readFileSync(file, 'utf8');
  const pattern = new RegExp(`(<key>${key}</key>\\s*\\n\\s*<string>)([^<]*)(</string>)`);
  const found = text.match(pattern);
  const label = path.relative(ROOT, file);

  if (!found) {
    problems.push(`${label}: no ${key} entry`);
    return;
  }
  if (found[2] === value) return;

  if (mode === 'check') {
    problems.push(`${label}: ${key} is ${found[2]}, expected ${value}`);
    return;
  }
  fs.writeFileSync(file, text.replace(pattern, `$1${value}$3`));
  changes.push(`${label}: ${key} ${found[2]} → ${value}`);
}

/**
 * Rewrite CURRENT_PROJECT_VERSION / MARKETING_VERSION, but only inside build
 * configs belonging to an embedded bundle — the host app target versions from
 * its Info.plist and must not be touched.
 */
function syncPbxproj(version, buildNumber) {
  const text = fs.readFileSync(PBXPROJ, 'utf8');
  let touched = 0;

  const updated = text.replace(/buildSettings = \{[\s\S]*?\n\t\t\t\};/g, (block) => {
    if (!EMBEDDED_BUNDLE_ID.test(block)) return block;

    let next = block;
    for (const [key, want] of [
      ['CURRENT_PROJECT_VERSION', buildNumber],
      ['MARKETING_VERSION', version],
    ]) {
      next = next.replace(new RegExp(`(${key} = )([^;]*)(;)`), (whole, lead, current, tail) => {
        if (current === want) return whole;
        if (mode === 'check') {
          problems.push(`project.pbxproj: ${key} is ${current}, expected ${want}`);
          return whole;
        }
        touched += 1;
        return `${lead}${want}${tail}`;
      });
    }
    return next;
  });

  if (mode !== 'check' && updated !== text) {
    fs.writeFileSync(PBXPROJ, updated);
    changes.push(`project.pbxproj: ${touched} embedded build setting(s) → ${version} (${buildNumber})`);
  }
}

const config = readAppConfig();
let { version, buildNumber } = config;

if (mode === 'bump') {
  const next = String(Number(buildNumber) + 1);
  if (!Number.isFinite(Number(buildNumber))) {
    throw new Error(`buildNumber "${buildNumber}" is not numeric — bump it by hand`);
  }
  fs.writeFileSync(
    APP_CONFIG,
    config.source.replace(/^(\s*buildNumber:\s*")[^"]+(")/m, `$1${next}$2`),
  );
  changes.push(`app.config.js: buildNumber ${buildNumber} → ${next}`);
  buildNumber = next;
}

for (const plist of PLISTS) {
  setPlistValue(plist, 'CFBundleShortVersionString', version);
  setPlistValue(plist, 'CFBundleVersion', buildNumber);
}
syncPbxproj(version, buildNumber);

if (problems.length) {
  console.error(`iOS versions are out of sync (expected ${version} / ${buildNumber}):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('\nRun `npm run version:sync` to fix.');
  process.exit(1);
}

if (mode === 'check') {
  console.log(`✓ All iOS bundles at ${version} (${buildNumber})`);
} else if (changes.length) {
  for (const c of changes) console.log(`  ${c}`);
  console.log(`✓ All iOS bundles at ${version} (${buildNumber})`);
} else {
  console.log(`✓ Already in sync at ${version} (${buildNumber})`);
}
