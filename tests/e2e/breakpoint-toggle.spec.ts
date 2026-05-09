import { test, expect } from '@playwright/test';
import { openSidebarTab } from './helpers';

test.use({
  viewport: { width: 1280, height: 800 }
});

test('breakpoint toggle (E2E harness)', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __AF_E2E__: boolean }).__AF_E2E__ = true;
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openSidebarTab(page, 'Run & Debug');
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('aetherforge:e2e-debug-toggle-breakpoint', {
        detail: { file: '/tmp/e2e-sample.ts', line: 1 }
      })
    );
  });
  await expect(page.getByText('e2e-sample.ts:1')).toBeVisible();
});
