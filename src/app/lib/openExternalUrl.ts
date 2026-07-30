import { Browser } from '@capacitor/browser';
import { isNativeApp } from '../../integrations/platform/isNativeApp.ts';

/**
 * Opens an external URL in the system browser when running inside a Capacitor native app,
 * or using window.open in standard web browser environments.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (isNativeApp()) {
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Global capture-phase click handler to ensure external anchor tags (`target="_blank"` or external http/https hrefs)
 * open via Capacitor Browser when running in a native app shell.
 */
export function handleExternalLinkClick(event: MouseEvent): void {
  if (!isNativeApp()) return;

  const target = event.target as HTMLElement | null;
  const anchor = target?.closest('a') as HTMLAnchorElement | null;
  if (!anchor || !anchor.href) return;

  const href = anchor.href;
  const isExternalHttp = href.startsWith('http://') || href.startsWith('https://');
  const isBlankTarget = anchor.target === '_blank';

  if (isExternalHttp && isBlankTarget) {
    event.preventDefault();
    event.stopPropagation();
    void Browser.open({ url: href });
  }
}
