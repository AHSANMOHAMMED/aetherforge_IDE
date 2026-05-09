import { test, expect } from '@playwright/test';
import { openSidebarTab } from './helpers';

test('AI panel accepts @-mention style prompt', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openSidebarTab(page, 'AI');
  const box = page.locator('#sidebar-panel-ai').getByPlaceholder(/Reference files inline with @path/i);
  await box.waitFor({ state: 'visible', timeout: 30_000 });
  await box.fill('Explain @src/renderer/App.tsx briefly');
  await expect(box).toHaveValue(/@src\/renderer\/App\.tsx/);
});
