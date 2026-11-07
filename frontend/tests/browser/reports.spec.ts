import { test, expect } from '@playwright/test';
test('report outage shows retry and never creates an agency bulletin', async ({ page }) => {
  await page.route('**/api/history/search', route => route.fulfill({json:[]}));
  await page.route('**/api/reports/bulletins?*', route => route.fulfill({status:503,json:{detail:'Source unavailable'}}));
  await page.goto('/reports');
  await expect(page.getByText('Report unavailable. Source data could not be loaded.')).toBeVisible();
  await expect(page.getByRole('button', {name:/retry/i})).toBeVisible();
  await expect(page.getByText('INDIA METEOROLOGICAL DEPARTMENT', {exact:true})).toHaveCount(0);
  await expect(page.getByRole('button', {name:/demo/i})).toBeVisible();
});
test('unavailable wind remains unavailable on the live dashboard', async ({page}) => {
  await page.route('**/api/active-systems*', route => route.fulfill({json:[{id:'NULL-WIND',name:'Fixture storm',basin:'Bay of Bengal',lat:15,lon:85,intensity_knots:null,category:'Not available',track_forecast:[],is_live_telemetry:true}]}));
  await page.route('**/api/ingest/status', route => route.fulfill({json:{status:'degraded',last_sync:null,is_syncing:false,active_systems_count:1,sources_status:{JTWC:'STALE'}}}));
  await page.goto('/dashboard');
  await expect(page.getByText('Fixture storm', {exact:true}).first()).toBeVisible();
  await expect(page.getByText('Not available').first()).toBeVisible();
  await expect(page.getByText(/Basin Quiet/)).toHaveCount(0);
});
test('empty telemetry cannot become an all-clear or invented accuracy claim', async ({page}) => {
  await page.route('**/api/active-systems*', route => route.fulfill({json:[]}));
  await page.route('**/api/ingest/status', route => route.fulfill({json:{status:'degraded',last_sync:null,is_syncing:false,active_systems_count:0,sources_status:{}}}));
  await page.goto('/dashboard');
  await expect(page.getByText(/Current basin conditions could not be verified/)).toBeVisible();
  await expect(page.getByText(/NIL \(0%|Operational \(100%|94.2% Ingestion|basin is calm/)).toHaveCount(0);
});
