import type { Page } from '@playwright/test';

/** Best-effort: clear localforage (session + caches) so e2e starts from a clean IDE state. */
export async function resetAppStorage(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('localforage');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      })
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
}

/** Primary header actions (banner). Uses native DOM click so the handler runs even if a sibling (e.g. mode bar shadow) wins hit-testing for synthetic pointer events. */
export async function clickHeader(page: Page, name: string): Promise<void> {
  const btn = page.getByRole('banner').getByRole('button', { name, exact: true });
  await btn.evaluate((el) => (el as HTMLButtonElement).click());
}

/** Sidebar tab buttons use Lucide icons; selection is via `title` from SIDEBAR_TABS. */
export async function openSidebarTab(page: Page, title: string): Promise<void> {
  const tab = page.locator(`nav[aria-label="Sidebar"] button[title="${title}"]`);
  await tab.evaluate((el) => (el as HTMLButtonElement).click());
}
