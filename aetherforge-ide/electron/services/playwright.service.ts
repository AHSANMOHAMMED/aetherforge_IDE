import { createRequire } from 'node:module';
import type { AnalyzeUrlPayload, AnalyzeUrlResult } from '../../src/common/ipc';
import logger from '../logger';

const require = createRequire(import.meta.url);

const URL_ALLOWLIST_PROTOCOLS = new Set(['http:', 'https:']);

export async function analyzeUrl(payload: AnalyzeUrlPayload): Promise<AnalyzeUrlResult> {
  let url: URL;
  try {
    url = new URL(payload.url);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }
  if (!URL_ALLOWLIST_PROTOCOLS.has(url.protocol)) {
    return { ok: false, error: `Unsupported protocol: ${url.protocol}` };
  }
  // block private IPs
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|::1)/i.test(url.hostname)) {
    return { ok: false, error: 'Cannot analyze private/local addresses' };
  }

  let playwright: typeof import('playwright');
  try {
    playwright = require('playwright') as typeof import('playwright');
  } catch (err) {
    logger.warn('Playwright not available', err);
    return { ok: false, error: 'Playwright is not installed in this build' };
  }

  let browser: import('playwright').Browser | null = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url.href, { waitUntil: 'networkidle', timeout: 30_000 });

    const title = await page.title();
    const extracted = await page.evaluate(() => {
      const getText = (selector: string): string[] =>
        Array.from(document.querySelectorAll(selector))
          .slice(0, 8)
          .map((el) => (el.textContent ?? '').trim())
          .filter(Boolean);
      const buttons = getText('button, [role="button"], a.button, a[role="button"]');
      const headings = getText('h1, h2, h3');
      const bodyStyles = getComputedStyle(document.body);
      const navCount = document.querySelectorAll('nav, [role="navigation"]').length;
      const cardCount = document.querySelectorAll('article, .card, [data-card]').length;
      return {
        bodyBackground: bodyStyles.backgroundColor,
        bodyColor: bodyStyles.color,
        bodyFont: bodyStyles.fontFamily,
        buttons,
        headings,
        navCount,
        cardCount,
        htmlSnippet: document.documentElement.outerHTML.slice(0, 12000)
      };
    });

    const screenshot = await page.screenshot({ type: 'png', fullPage: true });
    const uiSummary = [
      `Primary font: ${extracted.bodyFont}`,
      `Background: ${extracted.bodyBackground}`,
      `Text color: ${extracted.bodyColor}`,
      `Navigation blocks: ${extracted.navCount}`,
      `Card-like blocks: ${extracted.cardCount}`,
      `Headings: ${extracted.headings.join(' | ') || 'none detected'}`,
      `Buttons: ${extracted.buttons.join(' | ') || 'none detected'}`
    ].join('\n');

    return {
      ok: true,
      title,
      htmlSnippet: extracted.htmlSnippet,
      uiSummary,
      screenshotBase64: screenshot.toString('base64')
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Playwright analysis failed' };
  } finally {
    if (browser) await browser.close();
  }
}
