import { test, expect } from '@playwright/test';

test.describe('renderer smoke', () => {
  test('serves built app shell', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AetherForge IDE/i);
    await expect(page.locator('#root')).toBeVisible();
  });
});
