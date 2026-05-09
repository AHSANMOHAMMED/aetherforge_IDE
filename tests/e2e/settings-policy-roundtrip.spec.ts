import { test, expect } from '@playwright/test';
import { clickHeader } from './helpers';

test('settings policy air-gap persists across reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await clickHeader(page, 'Project settings');
  await expect(page.getByRole('heading', { name: 'Project Settings' })).toBeVisible({ timeout: 30_000 });

  const airGap = page.getByRole('checkbox', { name: /Air-gap mode/i });
  const wasChecked = await airGap.isChecked();
  await airGap.click();
  await expect(airGap).toBeChecked({ checked: !wasChecked });

  await page.reload();
  await clickHeader(page, 'Project settings');
  await expect(airGap).toBeChecked({ checked: !wasChecked });
  await airGap.click();
});
