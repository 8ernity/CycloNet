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

test('chatbot assistant opens via header button and closes on Escape', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { detail: 'Fixture outage' } }));
  await page.route('**/health**', route => route.fulfill({ status: 503, json: { status: 'unready' } }));
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Ask CycloNet AI' }).click();
  const dialog = page.getByRole('dialog', { name: 'CycloNet AI assistant' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('mobile viewport renders core routes without horizontal overflow or axe violations', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { detail: 'Fixture outage' } }));
  await page.route('**/health**', route => route.fulfill({ status: 503, json: { status: 'unready' } }));
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    for (const routePath of ['/dashboard', '/forecast', '/reports', '/infrastructure']) {
      await page.goto(routePath, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('main')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${routePath} exceeded ${width}px viewport width`).toBe(false);
      await page.addScriptTag({ path: path.resolve('node_modules/axe-core/axe.min.js') });
      const result = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (options: unknown) => Promise<AxeResults> } }).axe;
        return axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
      });
      expect(result.violations, `${routePath} ${width}px axe violations`).toEqual([]);
    }
  }
});

test('populated fixture states pass WCAG accessibility checks on desktop', async ({ page }) => {
  test.setTimeout(180000);
  const sampleSystem = {
    id: 'BOB03-2020',
    name: 'Amphan',
    basin: 'Bay of Bengal',
    lat: 16.5,
    lon: 87.2,
    category: 'Very Severe Cyclonic Storm',
    intensity_knots: 85,
    provenance: 'HISTORICAL_BEST_TRACK',
    telemetry_type: 'HISTORICAL_BEST_TRACK',
    source: 'IMD / IBTrACS fixture',
    is_stale: true,
    is_simulation: true,
    track_forecast: [
      { lat: 14.2, lon: 86.4, time_offset_hours: -12, intensity_knots: 70, category: 'Very Severe Cyclonic Storm', is_forecast: false, is_observed: true },
      { lat: 16.5, lon: 87.2, time_offset_hours: 0, intensity_knots: 85, category: 'Very Severe Cyclonic Storm', is_forecast: false, is_observed: true },
      { lat: 19.1, lon: 88.0, time_offset_hours: 12, intensity_knots: 65, category: 'Very Severe Cyclonic Storm', is_forecast: true, is_observed: false },
    ],
  };
  await page.route('**/api/history/search*', route => route.fulfill({ json: [
    { id: 'BOB03-2020', name: 'Amphan', year: '2020', maxCategory: 'Super Cyclonic Storm', basin: 'Bay of Bengal', dates: 'May 16-21' },
    { id: 'BOB02-2019', name: 'Fani', year: '2019', maxCategory: 'Extremely Severe Cyclonic Storm', basin: 'Bay of Bengal', dates: 'Apr 26-May 04' },
  ] }));
  await page.route('**/api/active-systems*', route => route.fulfill({ json: [sampleSystem] }));
  await page.route('**/api/cyclones*', route => route.fulfill({ json: [sampleSystem] }));
  await page.route('**/api/ingest/status*', route => route.fulfill({ json: { status: 'degraded', basin_status: 'STATUS_UNCERTAIN', active_systems_count: 0, sources_status: { IMD_RSMC: 'UNAVAILABLE' }, last_sync: null, is_syncing: false } }));
  await page.route('**/api/reports/bulletins*', route => route.fulfill({ json: {
    mode: 'HISTORICAL_REPLAY',
    system: sampleSystem,
    bulletins: [{ id: 'EX-1', number: 1, title: 'Experimental Summary', full_text: 'Sample content', category: 'Very Severe Cyclonic Storm', alert_level: 'ORANGE', timestamp_ist: 'Not available', is_latest: true }],
    affected_districts: [],
    port_signals: [],
    cap_xml: '<alert />',
  } }));
  await page.route('**/api/surge/*', route => route.fulfill({ json: { peak_surge_height_m: 1.8, inland_penetration_km: 3.2, sectors: [] } }));
  await page.route('**/api/gee/*', route => route.fulfill({ json: { pathways: [], layers: [] } }));

  for (const routePath of ['/', '/dashboard', '/forecast', '/archive', '/compare', '/reports', '/infrastructure']) {
    await page.goto(routePath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('main')).toBeVisible();
    await page.addScriptTag({ path: path.resolve('node_modules/axe-core/axe.min.js') });
    const result = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (options: unknown) => Promise<AxeResults> } }).axe;
      return axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    });
    expect(result.violations, `Populated ${routePath} axe violations`).toEqual([]);
  }
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
      findings.push({
        path: routePath,
        violations: result.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map(n => ({ target: n.target, html: n.html, failureSummary: n.failureSummary })),
        })),
      });
    }
    await testInfo.attach(`accessibility-${theme}.json`, { body: JSON.stringify(findings, null, 2), contentType: 'application/json' });
    expect(findings.filter(f => f.violations.length)).toEqual([]);
  });
}
