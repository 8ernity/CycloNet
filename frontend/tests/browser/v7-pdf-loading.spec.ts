import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openFixtureReport(page: Page) {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { detail: 'Fixture unavailable' } }));
  await page.route('**/api/reports/bulletins?*', route => route.fulfill({ json: {
    mode: 'EXPERIMENTAL_ANALYSIS', system: { id: 'FIXTURE', name: 'Local PDF fixture', basin: 'Not available',
      lat: 15, lon: 85, intensity_knots: null, central_pressure_hpa: null, category: 'Not available',
      source: 'Local browser test fixture', observation_time_utc: null, is_simulation: true },
    bulletins: [], affected_districts: [], port_signals: [], cap_xml: ''
  } }));
  await page.goto('/reports', { waitUntil: 'load' });
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true }).first()).toBeEnabled();
}

test('PDF library loads on demand and produces an actual download', async ({ page }) => {
  await openFixtureReport(page);
  const scripts: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).first().click();
  const download = await downloadPromise;
  expect(scripts.some(url => url.includes('/_next/static/chunks/'))).toBe(true);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const file = await download.path();
  expect(file).toBeTruthy();
  const contents = await readFile(file!);
  expect(contents.subarray(0, 5).toString()).toBe('%PDF-');
  expect(contents.length).toBeGreaterThan(1000);
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true }).first()).toBeEnabled();
});

test('failed PDF chunk load reports failure and restores the control', async ({ page }) => {
  await openFixtureReport(page);
  await page.route('**/_next/static/chunks/*.js', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Download PDF', exact: true }).first().click();
  await expect(page.getByText(/PDF generation error:/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true }).first()).toBeEnabled();
  await expect(page.getByText(/Generated & downloaded/)).toHaveCount(0);
});
