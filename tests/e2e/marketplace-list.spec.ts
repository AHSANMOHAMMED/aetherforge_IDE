import { test, expect } from '@playwright/test';
import { clickHeader } from './helpers';

test('marketplace lists catalog in web shell', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await clickHeader(page, 'Marketplace');
  await expect(page.getByRole('heading', { name: 'Extensions Marketplace' })).toBeVisible();
  await expect(page.getByPlaceholder('Search extensions…')).toBeVisible();
});
