import { test, expect } from '@playwright/test';
import path from 'node:path';
import type { AxeResults } from 'axe-core';

test('illustrative sample selection works with the keyboard', async ({ page }) => {
  await page.goto('/classification', { waitUntil: 'domcontentloaded' });
  const sample = page.getByRole('button', { name: 'Select illustrative sample frame 2' });
  await sample.focus();
  await page.keyboard.press('Enter');
  await expect(sample).toHaveAttribute('aria-pressed', 'true');
});

test('missing comparison records do not invent a basin', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { detail: 'Fixture outage' } }));
  await page.goto('/compare', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Basin not available', { exact: true })).toHaveCount(2);
});

for (const theme of ['dark', 'light']) {
  test(`${theme} pages pass automated accessibility checks during unavailable data`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    await page.route('**/api/**', route => route.fulfill({ status: 503, json: { detail: 'Fixture provider outage' } }));
    await page.route('**/health**', route => route.fulfill({ status: 503, json: { status: 'unready' } }));
    const findings = [];
    for (const routePath of ['/dashboard', '/classification', '/archive', '/compare', '/forecast', '/reports', '/infrastructure', '/settings']) {
      await page.goto(routePath, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      await page.addScriptTag({ path: path.resolve('node_modules/axe-core/axe.min.js') });
      const result = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (options: unknown) => Promise<AxeResults> } }).axe;
        return axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      });
      findings.push({ path: routePath, violations: result.violations.map(v => ({
        id: v.id, impact: v.impact, description: v.description,
        nodes: v.nodes.map(n => ({ target: n.target, html: n.html, failureSummary: n.failureSummary }))
      })) });
    }
    await testInfo.attach(`accessibility-${theme}.json`, { body: JSON.stringify(findings, null, 2), contentType: 'application/json' });
    expect(findings.filter(f => f.violations.length)).toEqual([]);
  });
}
