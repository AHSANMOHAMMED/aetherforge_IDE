import { test, expect } from '@playwright/test';
import { clickHeader } from './helpers';

test('terminal panel shows PTY gate in web shell', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Terminal requires the desktop runtime.')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('New terminal').click({ force: true });
});
