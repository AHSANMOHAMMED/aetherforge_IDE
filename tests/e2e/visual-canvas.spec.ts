import { test, expect } from '@playwright/test';

test.describe('visual canvas & command palette', () => {
  test('opens command mode with chord and lists canvas commands', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();

    const chord = process.platform === 'darwin' ? 'Meta+Shift+P' : 'Control+Shift+P';
    await page.keyboard.press(chord);

    const input = page.getByPlaceholder('Type a command...');
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill('Visual Canvas');
    await expect(page.getByText('Open Visual Canvas')).toBeVisible();
  });
});
