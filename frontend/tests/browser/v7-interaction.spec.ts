import { test, expect } from '@playwright/test';
import path from 'node:path';
import type { AxeResults } from 'axe-core';

test('keyboard users can skip navigation and focus page content', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('assistant has a name, focuses input, and Escape restores its opener', async ({ page }) => {
  await page.route('**/api/chat', route => route.fulfill({ json: { response: 'Fixture educational reply', sources: [], timestamp: 'fixture', category: 'general' } }));
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  const opener = page.getByRole('button', { name: 'Ask CycloNet AI' });
  await opener.click();
  await expect(page.getByRole('dialog', { name: 'CycloNet AI assistant' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message CycloNet AI' })).toBeFocused();
  const snapshot = await page.getByRole('dialog', { name: 'CycloNet AI assistant' }).ariaSnapshot();
  expect(snapshot).toContain('Message CycloNet AI');
  await page.addScriptTag({ path: path.resolve('node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<AxeResults> } }).axe;
    const result = await axe.run('[role="dialog"]', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return result.violations;
  });
  expect(violations).toEqual([]);
  await page.getByRole('textbox', { name: 'Message CycloNet AI' }).fill('Explain cyclones');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('log', { name: 'Conversation' })).toContainText('Fixture educational reply');
  await expect(page.getByRole('log', { name: 'Conversation' })).toHaveAttribute('aria-live', 'polite');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'CycloNet AI assistant' })).toBeHidden();
  await expect(opener).toBeFocused();
});

test('saved desktop assistant dimensions fit a narrow screen and resize', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('cyclonet_chat_size_v4', JSON.stringify({ width: 900, height: 900 }));
    localStorage.setItem('cyclonet_chat_pos_v4', JSON.stringify({ x: 800, y: 600 }));
  });
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Ask CycloNet AI' }).click();
  const window = page.locator('.liquid-glass-panel');
  await expect(window).toBeVisible();
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const box = await window.boundingBox();
      return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height;
    }).toBe(true);
  }
});

test('closed assistant does not poll screen context', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__cyclonet_current_context', { configurable: true, get() {
      document.documentElement.dataset.contextReads = String(Number(document.documentElement.dataset.contextReads || 0) + 1);
      return null;
    } });
  });
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  expect(await page.locator('html').getAttribute('data-context-reads')).toBeNull();
});

test('reduced motion disables decorative hero autoplay and smooth scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.locator('.parallax video').evaluateAll(videos => videos.every(video => (video as HTMLVideoElement).paused))).toBe(true);
  await expect(page.locator('html')).not.toHaveClass(/lenis-smooth/);
});
