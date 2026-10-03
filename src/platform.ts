import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { save } from './storage';

export async function buzz(kind: 'correct' | 'wrong'): Promise<void> {
  if (!save.settings.haptics) return;
  try {
    if (kind === 'correct') await Haptics.impact({ style: ImpactStyle.Light });
    else await Haptics.notification({ type: NotificationType.Error });
  } catch {
    // no haptics on this device
  }
}

/** Native share sheet where available, clipboard otherwise. Returns what happened. */
export async function shareResult(text: string): Promise<'shared' | 'copied' | 'failed'> {
  let canShare = false;
  try {
    canShare = (await Share.canShare()).value;
  } catch {
    // no share sheet on this platform
  }
  if (canShare) {
    try {
      await Share.share({ text });
      return 'shared';
    } catch {
      return 'failed'; // dismissed by the user
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
