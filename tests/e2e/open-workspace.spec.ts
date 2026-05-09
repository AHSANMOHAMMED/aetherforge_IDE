import { test, expect } from '@playwright/test';
import { clickHeader } from './helpers';

test('open-workspace flow surfaces desktop requirement in web shell', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await clickHeader(page, 'Open Folder');
  await expect(page.getByText(/Electron runtime unavailable/)).toBeVisible({ timeout: 30_000 });
});
