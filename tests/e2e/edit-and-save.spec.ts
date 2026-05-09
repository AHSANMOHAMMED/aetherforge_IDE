import { test, expect } from '@playwright/test';
import { platform } from 'node:os';
import { clickHeader } from './helpers';

test('edit-and-save on virtual canvas tab', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Split mode mounts CodeEditorPanel with the virtual canvas tab active (see app-store setMode('split')).
  await clickHeader(page, 'Split');
  const monacoSurface = page.locator('[data-monaco-editor] .monaco-editor');
  await monacoSurface.waitFor({ state: 'visible', timeout: 60_000 });
  await monacoSurface.click();
  const selectAll = platform() === 'darwin' ? 'Meta+A' : 'Control+A';
  await page.keyboard.press(selectAll);
  await page.keyboard.type('// e2e save test');
  await clickHeader(page, 'Save');
  await expect(page.getByText('Virtual file saved in memory', { exact: true }).first()).toBeVisible();
});
