import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('record local reports and settings JavaScript delivery', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { detail: 'Fixture provider outage' } }));
  await page.route('**/health**', route => route.fulfill({ status: 503, json: { status: 'unready' } }));
  const measurements = [];
  for (const path of ['/reports', '/settings']) {
    await page.goto(path, { waitUntil: 'load' });
    await expect(page.getByRole('main')).toBeVisible();
    const result = await page.evaluate(() => {
      const scripts = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .filter(r => r.initiatorType === 'script' && r.name.startsWith(location.origin));
      return { scripts: scripts.length, decodedJavascriptBytes: scripts.reduce((n, r) => n + r.decodedBodySize, 0),
        transferredJavascriptBytes: scripts.reduce((n, r) => n + r.transferSize, 0) };
    });
    expect(result.decodedJavascriptBytes).toBeGreaterThan(0);
    measurements.push({ path, ...result });
  }
  const label = process.env.V7_PROFILE_LABEL === 'before' ? 'before' : 'after';
  writeFileSync(`../docs/v7-local-performance-${label}.json`, JSON.stringify({
    scope: 'Local production build; mocked unavailable providers; script delivery only, not hosted load or field performance',
    measurements
  }, null, 2));
});
