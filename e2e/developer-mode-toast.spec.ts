import { expect, test, type Page } from '@playwright/test';

/**
 * The developer-mode tap toast must never cover the version label being tapped (#1686), on a phone-width layout
 * (with the bottom tab bar) and on desktop.
 */

const VIEWPORTS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

const PATHS = ['/', '/help'] as const;

async function dismissCookieBanner(page: Page) {
  await page.getByRole('button', { name: 'Manage' }).click();
  await page.getByRole('button', { name: 'Reject non-essential' }).click();
  await expect(page.getByRole('dialog', { name: 'Cookie consent' })).not.toBeVisible();
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

for (const viewport of VIEWPORTS) {
  for (const path of PATHS) {
    test(`tap toast clears the version label (${viewport.name}, ${path})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.goto(path);
      await dismissCookieBanner(page);

      const version = page.getByTestId('build-version');
      for (let tap = 1; tap <= 5; tap += 1) {
        await version.click();
        if (tap < 2) continue;
        const label = await version.boundingBox();
        const box = await page
          .getByRole('status')
          .filter({ hasText: /developer mode/i })
          .last()
          .boundingBox();
        expect(label, 'version label is on screen').not.toBeNull();
        expect(box, `toast after tap ${tap}`).not.toBeNull();
        expect(overlaps(label!, box!), `toast covers the label after tap ${tap}`).toBe(false);
      }
      await expect(page.getByTestId('developer-mode-badge')).toBeVisible();
    });
  }
}
