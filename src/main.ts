import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { initAds } from './monetization/ads';
import { initPurchases } from './monetization/purchases';
import { loadSave } from './storage';
import './styles.css';
import './ui/classic';
import './ui/daily';
import './ui/menus';
import { current, go } from './ui/router';

async function boot(): Promise<void> {
  await loadSave();
  go('home');
  // Store/ads SDKs come up after first paint; a slow network never blocks the menu.
  await initPurchases();
  await initAds();
  if (current !== 'play' && current !== 'daily') go(current);
}

if (Capacitor.getPlatform() === 'android') {
  void App.addListener('backButton', () => {
    if (current === 'home') void App.exitApp();
    else go('home');
  });
}

void boot();
