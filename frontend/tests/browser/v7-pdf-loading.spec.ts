import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openFixtureReport(page: Page, wind: number | null = null) {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { detail: 'Fixture unavailable' } }));
  await page.route('**/api/reports/bulletins?*', route => route.fulfill({ json: {
    mode: 'EXPERIMENTAL_ANALYSIS', system: { id: 'FIXTURE', name: 'Local PDF fixture', basin: 'Not available',
      lat: -15, lon: -85, intensity_knots: wind, central_pressure_hpa: null, category: 'Source fixture category',
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
  // jsPDF's uncompressed text operands separate wrapped lines with T*.
  // Assert the printed words, rather than requiring one raw PDF operand.
  const printedText = Array.from(contents.toString().matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g),
    match => match[1].replace(/\\([\\()])/g, '$1')).join(' ');
  expect(printedText).toContain('Forecast not available');
  expect(printedText).toContain('Source fixture category');
  expect(printedText).not.toContain('Landfall');
  if (process.env.V7_PDF_PREVIEW) await download.saveAs(process.env.V7_PDF_PREVIEW);
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true }).first()).toBeEnabled();
});

test('report exports preserve source category and label illustrative exposure', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cyclonet_data_source', 'JTWC'));
  await openFixtureReport(page, 35);
  await expect(page.getByText(/Sea conditions and coastal squalls are not established/)).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  const download = await pending;
  const report = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(report.system.category).toBe('Source fixture category');
  expect(report.system.intensity_knots).toBe(35);
  expect(report.system.source).toBe('Local browser test fixture');
  expect(report.displayPreference.type).toBe('JTWC');
  expect(report.infrastructureExposure.is_simulation).toBe(true);
  expect(report.parametricInsuranceTriggers.is_simulation).toBe(true);
  expect(report.disclaimer).toContain('Not an official warning');
});

test('failed PDF chunk load reports failure and restores the control', async ({ page }) => {
  await openFixtureReport(page);
  await page.route('**/_next/static/chunks/*.js', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Download PDF', exact: true }).first().click();
  await expect(page.getByText(/PDF generation error:/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true }).first()).toBeEnabled();
  await expect(page.getByText(/Generated & downloaded/)).toHaveCount(0);
});
