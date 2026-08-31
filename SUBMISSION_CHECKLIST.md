# RoundFit — Pre-Submission Checklist

**Outstanding items only.** Last verified 2026-08-31 against the code, the
RevenueCat API, Railway, and the live site. Completed work is removed as it
lands — see git history and `LAUNCH_CHECKLIST.md` for what came before.

Legend: 🔴 rejection · 🟠 fails before review · 🟡 verify · ⚪ not a blocker

---

## 🔴 Monetization

- [ ] **Submit both IAPs with the binary — nothing works until this happens.**
      `co.roundfit.app.pro.monthly` and `.annual` are both `READY_TO_SUBMIT` and
      have never been submitted. Apple does not vend a *first* in-app purchase to
      StoreKit until it is attached to an app version and that version is
      submitted for review.

      This is already breaking the app at runtime: the SDK throws
      `CONFIGURATION_ERROR` (code 23) — *"None of the products registered in the
      RevenueCat dashboard could be fetched from App Store Connect"* — so the
      paywall has no products to show. Ruled out as causes: RevenueCat's ASC API
      key and In-App Purchase key both validate clean, the bundle ID matches, the
      product identifiers match, and builds resolve the `appl_` App Store key.

      Two things to rule out before assuming it is only the submission:
      - [ ] **Simulator?** Simulators never fetch live products. Needs a physical
            device with a sandbox Apple Account, or a StoreKit Configuration file.
      - [ ] **Paid Applications Agreement** active in App Store Connect →
            Business, with banking and tax complete. RevenueCat lists this as the
            single most common cause and it is invisible to the credential check.

      To develop against purchases before submitting, add a StoreKit
      Configuration file to the Xcode scheme — then remove it before testing
      against the real App Store, or it becomes its own cause of empty offerings.

- [ ] **Delete the duplicate `monthly` subscription in App Store Connect.** It
      sits in the `RoundFit Pro` group with no price, no territories and no
      localizations (`MISSING_METADATA`). Its RevenueCat product is archived, but
      that does not touch the store. An incomplete subscription in the group
      blocks the version submission and may be contributing to the fetch failure.

- [ ] **Publish the paywall draft — the Terms link fix is not live.** Both footer
      links pointed at `/privacy`, so the link labelled "Terms" opened the privacy
      policy. The draft now points `AEA4Pk_gNQ` at
      `https://www.roundfit.co/terms` (verified 200). Publish in the builder,
      then re-check the footer. *(The CTA and label fixes are already live.)*

- [ ] **Confirm the paywall's personalisation is dynamic, not static text.** The
      rendered paywall reads "WILLIAM'S CUSTOM PLAN" and "You'll reach 165 lb by
      Aug 12". If those are hardcoded rather than RevenueCat variables, every user
      sees a stranger's name and a fixed date — on both the signup paywall and the
      Settings one.

- [ ] **Verify the rest of the 3.1.2 furniture** — price, billing period,
      auto-renew disclosure, **Restore Purchases**, and tappable Terms + Privacy.
      The design lives in the dashboard (`pw4dc9a9e35bf64396`), so it cannot be
      checked from the repo.

- [ ] **Review the shared paywall copy.** Both entry points render the same
      dashboard paywall. The current copy is written for the onboarding moment and
      also appears when an existing user taps Settings → Upgrade, where a plan
      reveal makes little sense. Accept it, or give the settings path its own
      offering and paywall.

- [ ] **Harden the paywall against a failed offerings load.** The
      `isPurchasesConfigured()` fallback in both paywall screens only catches a
      *missing key*. When the key is present but offerings fail — exactly what is
      happening now — `RevenueCatUI.Paywall` renders its own error and the user
      has no way forward. The paywall is the one screen an App Review tester will
      definitely open.

- [ ] **Decide `PAYWALL_ENABLED`** (`constants/subscription.ts:33`, `false`).
      Paid launch → flip to `true`, which also backstops every route into the app
      (lapsed subscription, reinstall, deep link). Free launch → do not submit the
      IAPs at all.

- [ ] **Sandbox purchase test, end to end**, on a real device: purchase →
      entitlement resolves → premium unlocks → restore on a fresh install.
      Cover **both** paywall entry points and **both** sign-up routes: the
      post-signup gate (email *and* Sign in with Apple — the OAuth path used to
      skip the paywall entirely) and Settings → Subscription → Upgrade to Premium.
      Also confirm a **returning log-in** goes straight to the home screen and is
      not shown the paywall again.
      This is also the only thing that proves Railway's `REVENUECAT_SECRET_KEY`
      holds the current key — `getSubscriber` has a bare `catch` that returns
      `null` and logs nothing, so a wrong key is invisible until a purchase
      doesn't unlock.

---

## 🟠 Before the build can be uploaded

- [ ] **Decide whether the watch app ships.** `ios/RoundFit.xcodeproj/project.pbxproj`
      is modified and `RoundFitWatch.xcscheme`, `WatchDesign.swift`,
      `WatchHeroViews.swift` are untracked. EAS builds from git, so right now it
      does **not** ship. Commit it and App Review reviews it — an unfinished watch
      app is its own rejection.

- [ ] **`npm run version:bump` before the production build**, and
      `npm run version:check` before submitting. iOS versioning is local-source:
      `app.config.js` is the truth and the script syncs the watch app, watch widget
      and Live Activity extension, which App Store Connect requires to match the
      host app exactly. Never edit those numbers by hand.

---

## 🟡 Security hygiene

- [ ] **Rotate the RevenueCat secret key once more.** The key currently in Railway
      was pasted into a chat transcript. Rotate, update Railway, redeploy — and
      don't paste the new one anywhere. Liveness can be confirmed from the
      deployment record and logs without the value.

---

## ⚪ Worth a look, not blockers

- [ ] Products are available in **US and Canada only**, with
      `available_in_new_territories: false`, despite prices set for ~180
      territories. Probably not intended — and it means a tester outside those two
      storefronts will never see products.
- [ ] US monthly is **$14.99**; `LAUNCH_CHECKLIST.md` and older marketing copy
      still say $9.99. Make the store and the copy agree.
- [ ] `SUBSCRIPTION_PLAN.md` §7 now contradicts the code: it argues for a
      **pre-signup** paywall ("the plan reveal is peak motivation"), but the
      paywall was deliberately moved to **after sign-up**, before the home screen.
      Update the doc so the reasoning matches what ships.
- [ ] `components/log/PhotoAnalysisModal.tsx:466` reads "Micronutrient data coming
      soon." Low risk as an empty state.
- [ ] Crash reporting still not installed (`LAUNCH_CHECKLIST.md` §4). Not a
      rejection risk, but it was wanted before release.
- [ ] `app.json` is dead config — `app.config.js` exports a plain object, so
      `app.json` is ignored entirely and has drifted. Delete it.
- [ ] `roundfit-backend` `getSubscriber` swallows every error in a bare `catch`.
      Add a log line so RevenueCat auth/network failures are diagnosable.
