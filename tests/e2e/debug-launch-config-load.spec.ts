import { test, expect } from '@playwright/test';
import { openSidebarTab } from './helpers';

test('debug panel loads launch config selector', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openSidebarTab(page, 'Run & Debug');
  await expect(page.getByText('Run & Debug').first()).toBeVisible();
  await expect(page.locator('#sidebar-panel-debug select')).toContainText('No launch.json found');
});
