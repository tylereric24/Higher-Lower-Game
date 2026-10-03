import { Capacitor } from '@capacitor/core';
import {
  Purchases,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from '@revenuecat/purchases-capacitor';
import { persist, save } from '../storage';
import { hideBanner } from './ads';
import { PURCHASES } from './config';

let configured = false;
let removeAdsPackage: PurchasesPackage | undefined;

export const purchasesSupported = Capacitor.isNativePlatform() && PURCHASES.apiKey !== '';

function applyCustomerInfo(info: CustomerInfo): void {
  const owned = PURCHASES.entitlement in info.entitlements.active;
  if (owned !== save.noAds) {
    save.noAds = owned;
    void persist();
  }
  if (owned) void hideBanner();
}

export async function initPurchases(): Promise<void> {
  if (!purchasesSupported) return;
  try {
    await Purchases.configure({ apiKey: PURCHASES.apiKey });
    configured = true;
    const { customerInfo } = await Purchases.getCustomerInfo();
    applyCustomerInfo(customerInfo);
    const offerings = await Purchases.getOfferings();
    removeAdsPackage = offerings.current?.availablePackages[0];
  } catch (e) {
    console.warn('purchases unavailable', e);
  }
}

export function removeAdsPrice(): string | undefined {
  return removeAdsPackage?.product.priceString;
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'failed';

export async function buyRemoveAds(): Promise<PurchaseOutcome> {
  if (!configured || !removeAdsPackage) return 'failed';
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: removeAdsPackage });
    applyCustomerInfo(customerInfo);
    return save.noAds ? 'purchased' : 'failed';
  } catch (e) {
    const code = (e as { code?: string }).code;
    return code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ? 'cancelled' : 'failed';
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!configured) return false;
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    applyCustomerInfo(customerInfo);
  } catch {
    // fall through with current state
  }
  return save.noAds;
}
