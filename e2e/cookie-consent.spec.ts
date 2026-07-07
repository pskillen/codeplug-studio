import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('shows cookie banner on first visit', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Cookie consent' })).toBeVisible();
});

test('decline hides banner, persists choice, and sends no GA traffic', async ({ page }) => {
  const analyticsHosts: string[] = [];
  page.on('request', (request) => {
    const host = new URL(request.url()).hostname;
    if (host.includes('googletagmanager.com') || host.includes('google-analytics.com')) {
      analyticsHosts.push(host);
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Essential only' }).click();
  await expect(page.getByRole('dialog', { name: 'Cookie consent' })).not.toBeVisible();

  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Cookie consent' })).not.toBeVisible();

  await page.goto('/help');
  expect(analyticsHosts).toEqual([]);
});

test('accept hides banner and persists choice', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accept analytics' }).click();
  await expect(page.getByRole('dialog', { name: 'Cookie consent' })).not.toBeVisible();

  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Cookie consent' })).not.toBeVisible();
});
