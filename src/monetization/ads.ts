import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { save } from '../storage';
import { ADS } from './config';

let ready = false;
let privacyOptionsRequired = false;
let bannerShown = false;
let runsSinceInterstitial = 0;
let lastInterstitialAt = 0;
let interstitialLoaded = false;
let rewardedLoaded = false;

/** Ads exist only in the native apps; the web build is ad-free. */
export const adsSupported = Capacitor.isNativePlatform();

/**
 * Order matters: SDK init, then the UMP consent form (GDPR/US state privacy), then the
 * iOS App Tracking Transparency prompt. Ads are requested only if consent allows it.
 */
export async function initAds(): Promise<void> {
  if (!adsSupported) return;
  try {
    await AdMob.initialize({ initializeForTesting: ADS.testing });
    let consent = await AdMob.requestConsentInfo();
    if (consent.status === AdmobConsentStatus.REQUIRED && consent.isConsentFormAvailable) {
      consent = await AdMob.showConsentForm();
    }
    // The plugin doesn't export the PrivacyOptionsRequirementStatus enum; compare its value.
    privacyOptionsRequired = String(consent.privacyOptionsRequirementStatus) === 'REQUIRED';
    if (Capacitor.getPlatform() === 'ios') {
      const { status } = await AdMob.trackingAuthorizationStatus();
      if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
    }
    ready = consent.canRequestAds;
    await AdMob.addListener(BannerAdPluginEvents.SizeChanged, ({ height }) => {
      document.documentElement.style.setProperty('--banner-h', `${height}px`);
    });
    if (ready) void preloadRewarded();
    if (ready && !save.noAds) void preloadInterstitial();
  } catch (e) {
    console.warn('ads unavailable', e);
    ready = false;
  }
}

export function needsPrivacyOptions(): boolean {
  return privacyOptionsRequired;
}

export async function showPrivacyOptions(): Promise<void> {
  await AdMob.showPrivacyOptionsForm();
}

export async function showBanner(): Promise<void> {
  if (!ready || save.noAds || bannerShown) return;
  bannerShown = true;
  try {
    await AdMob.showBanner({
      adId: ADS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      isTesting: ADS.testing,
    });
  } catch {
    bannerShown = false;
  }
}

export async function hideBanner(): Promise<void> {
  if (!bannerShown) return;
  bannerShown = false;
  document.documentElement.style.setProperty('--banner-h', '0px');
  try {
    await AdMob.removeBanner();
  } catch {
    // already gone
  }
}

async function preloadInterstitial(): Promise<void> {
  try {
    await AdMob.prepareInterstitial({ adId: ADS.interstitial, isTesting: ADS.testing });
    interstitialLoaded = true;
  } catch {
    interstitialLoaded = false;
  }
}

/** Called when a classic run ends; shows an interstitial on a capped cadence. */
export async function onRunFinished(): Promise<void> {
  if (!ready || save.noAds) return;
  runsSinceInterstitial++;
  const due =
    runsSinceInterstitial >= ADS.interstitialEveryRuns &&
    Date.now() - lastInterstitialAt >= ADS.interstitialMinGapMs;
  if (!due || !interstitialLoaded) return;
  try {
    await AdMob.showInterstitial();
    runsSinceInterstitial = 0;
    lastInterstitialAt = Date.now();
  } catch {
    // no fill or show failure: try again next run
  } finally {
    interstitialLoaded = false;
    void preloadInterstitial();
  }
}

async function preloadRewarded(): Promise<void> {
  try {
    await AdMob.prepareRewardVideoAd({ adId: ADS.rewarded, isTesting: ADS.testing });
    rewardedLoaded = true;
  } catch {
    rewardedLoaded = false;
  }
}

export function rewardedAvailable(): boolean {
  return ready && rewardedLoaded;
}

/** Resolves true only if the player watched to the reward. */
export async function showRewarded(): Promise<boolean> {
  if (!rewardedAvailable()) return false;
  let rewarded = false;
  const handle = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
    rewarded = true;
  });
  try {
    const item = await AdMob.showRewardVideoAd();
    rewarded ||= item.amount > 0;
  } catch {
    // dismissed early or failed to show
  } finally {
    await handle.remove();
    rewardedLoaded = false;
    void preloadRewarded();
  }
  return rewarded;
}
