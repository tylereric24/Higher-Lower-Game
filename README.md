# Gridiron Higher/Lower

Football stats higher/lower game for iOS, Android and the web. Guess whether a player's
season beat the one on screen: passing TDs, passing yards, rushing yards, receiving yards
or receptions, across ~3,900 player-seasons from 1999 through 2025 plus a few pre-1999
legends.

- **Daily challenge**: 10 matchups, the same for everyone that day, with a shareable
  emoji score grid and a daily streak. Quitting mid-puzzle keeps your answers, so retries
  can't be farmed.
- **Classic**: endless streak, one miss ends it. Pick a stat or play Mixed. Difficulty ramps
  by shrinking the gap between the two values (30%+ early, ~1-12% after 15 in a row) and
  widening the pool from league leaders to every qualified season.
- **Monetization**: AdMob banner (menus only, never during play), a capped interstitial
  (every 3rd finished run, at most once per 3 minutes), an opt-in rewarded ad to keep a
  streak alive once per run, and a one-time "Remove Ads" purchase through RevenueCat.
  Google UMP consent and iOS App Tracking Transparency are handled before any ad request.

The original Python terminal game lives in `cli/` and now reads the same dataset.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173 (web build: no ads, no purchases)
npm test           # engine + daily generator tests
npm run build      # typecheck + production bundle in dist/
python3 cli/main.py
```

Layout: `src/game.ts` (engine and difficulty), `src/daily.ts` (seeded daily puzzle),
`src/data.ts` (dataset), `src/storage.ts` (save data via Capacitor Preferences),
`src/monetization/` (AdMob, RevenueCat, config), `src/ui/` (screens).

### Refreshing stats

```sh
npm run data -- --last 2026   # after each season's Super Bowl
```

`scripts/build_data.py` pulls regular-season stats from
[nflverse-data](https://github.com/nflverse/nflverse-data) (CC-BY 4.0; the in-app credit
satisfies attribution) and writes `src/data/seasons.json`. Note that rebuilding the data
changes daily puzzles, so ship data updates as their own release.

## Ship it

Native projects live in `android/` and `ios/`. Use `npm run cap:sync` after any web change,
then `npx cap open android` (Android Studio) or `npx cap open ios` (Xcode, macOS only).

1. **Accounts**: Apple Developer Program ($99/yr), Google Play Console ($25 once), AdMob,
   RevenueCat.
2. **Name and IDs**: confirm the app name is free on both stores and clear of trademarks.
   Keep "NFL" out of the name, subtitle, keywords and screenshots, and use no team logos.
   Change `appId` in `capacitor.config.ts` (it's permanent once uploaded), then update the
   Android `applicationId`/package and iOS bundle ID to match.
3. **AdMob**: create an iOS app and an Android app, each with a banner (adaptive), an
   interstitial and a rewarded unit. Put the unit IDs in `.env.production` (see
   `.env.example`) and the app IDs in `android/app/src/main/res/values/strings.xml` and
   `ios/App/App/Info.plist` (`GADApplicationIdentifier`). Until then everything runs on
   Google's test IDs. In **Privacy & messaging**, publish a GDPR message and a US state
   regulations message, or the consent form won't appear. Host an `app-ads.txt` on the
   developer website listed in your store pages. Add Google's full SKAdNetwork ID list to
   `Info.plist` (only Google's own ID is included now).
4. **Remove Ads**: create a non-consumable product (for example `remove_ads`, $2.99) in App
   Store Connect and Play Console. In RevenueCat, create the entitlement `no_ads`, attach
   both products, and make an offering current with a single package. Put the public SDK
   keys in `.env.production`.
5. **Privacy**: fill in and host `PRIVACY.md` (GitHub Pages works) and set
   `VITE_PRIVACY_URL`. App Store privacy label: Device ID, Product Interaction, Advertising
   Data, Purchase History; Device ID and Advertising Data used for tracking. Play Data
   safety: Device or other IDs, App interactions, Purchase history, shared for advertising.
6. **Store assets**: 1024px icon (`npx @capacitor/assets generate`), screenshots, a content
   rating questionnaire (no objectionable content) and a target-age declaration of 13+.
7. **Release**: `npm run cap:sync`, then archive in Xcode / build a signed AAB in Android
   Studio. Test on a real device with test ads before switching to live IDs; tapping your
   own live ads gets AdMob accounts banned.

## Legal notes

Stats are facts and come from a CC-BY dataset. Player and team names are used only to
identify the season being asked about. Not affiliated with or endorsed by the NFL, the
NFLPA or any team. This isn't legal advice; if the app gets traction, a short consult with
an IP lawyer on right-of-publicity exposure is cheap insurance.
