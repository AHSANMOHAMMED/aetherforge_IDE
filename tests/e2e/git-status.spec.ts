import { test, expect } from '@playwright/test';
import { openSidebarTab, resetAppStorage } from './helpers';

test('git sidebar shows workspace gate', async ({ page }) => {
  await resetAppStorage(page);
  await openSidebarTab(page, 'Source Control');
  await expect(page.getByText('Open a workspace to use Source Control')).toBeVisible();
});
