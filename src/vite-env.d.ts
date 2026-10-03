/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMOB_IOS_BANNER?: string;
  readonly VITE_ADMOB_IOS_INTERSTITIAL?: string;
  readonly VITE_ADMOB_IOS_REWARDED?: string;
  readonly VITE_ADMOB_ANDROID_BANNER?: string;
  readonly VITE_ADMOB_ANDROID_INTERSTITIAL?: string;
  readonly VITE_ADMOB_ANDROID_REWARDED?: string;
  readonly VITE_RC_IOS_KEY?: string;
  readonly VITE_RC_ANDROID_KEY?: string;
  readonly VITE_PRIVACY_URL?: string;
}
declare const __APP_VERSION__: string;
