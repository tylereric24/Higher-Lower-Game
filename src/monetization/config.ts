import { Capacitor } from '@capacitor/core';

/**
 * Real ad unit IDs and store keys come from build-time env vars (see .env.example).
 * Anything left unset falls back to Google's published test units, and test mode stays
 * on, so a dev build can never serve live ads or generate invalid traffic.
 */
const env = import.meta.env;
const platform = Capacitor.getPlatform();

const TEST_UNITS = {
  ios: {
    banner: 'ca-app-pub-3940256099942544/2435281174',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
  android: {
    banner: 'ca-app-pub-3940256099942544/9214589741',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
};

function units() {
  if (platform === 'ios') {
    return {
      banner: env.VITE_ADMOB_IOS_BANNER,
      interstitial: env.VITE_ADMOB_IOS_INTERSTITIAL,
      rewarded: env.VITE_ADMOB_IOS_REWARDED,
    };
  }
  return {
    banner: env.VITE_ADMOB_ANDROID_BANNER,
    interstitial: env.VITE_ADMOB_ANDROID_INTERSTITIAL,
    rewarded: env.VITE_ADMOB_ANDROID_REWARDED,
  };
}

const live = units();
const test = platform === 'ios' ? TEST_UNITS.ios : TEST_UNITS.android;

export const ADS = {
  testing: !(live.banner && live.interstitial && live.rewarded),
  banner: live.banner || test.banner,
  interstitial: live.interstitial || test.interstitial,
  rewarded: live.rewarded || test.rewarded,
  /** Interstitial after every Nth finished classic run... */
  interstitialEveryRuns: 3,
  /** ...and never more often than this. */
  interstitialMinGapMs: 3 * 60_000,
};

export const PURCHASES = {
  apiKey: (platform === 'ios' ? env.VITE_RC_IOS_KEY : env.VITE_RC_ANDROID_KEY) || '',
  /** RevenueCat entitlement granted by the one-time "Remove Ads" product. */
  entitlement: 'no_ads',
};

export const PRIVACY_POLICY_URL =
  env.VITE_PRIVACY_URL || 'https://github.com/tylereric24/Higher-Lower-Game/blob/main/PRIVACY.md';
