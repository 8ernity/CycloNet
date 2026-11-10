import {test, expect} from '@playwright/test';

const storm = (id: string) => ({id, name: `${id} fixture`, basin: 'Bay of Bengal', lat: 15, lon: 85,
  category: 'Unknown', intensity_knots: null, provenance: 'HISTORICAL_BEST_TRACK', is_stale: true,
  track_forecast: [{lat:15,lon:85,time_offset_hours:0,intensity_knots:null,category:'Unknown',is_forecast:false}]});

test('launch dashboard navigates without reloading and identifies the actual basemap', async ({page}) => {
  await page.route('**/api/**', route => route.fulfill({json: []}));
  await page.goto('/');
  await page.evaluate(() => Object.assign(window, {navigationMarker: 'retained'}));
  await page.getByRole('button', {name: 'Launch CycloNet Dashboard', exact: true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await page.evaluate(() => Reflect.get(window, 'navigationMarker'))).toBe('retained');
  await expect(page.getByText('🗺️ Esri World Imagery basemap', {exact: true}).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('INSAT-3DR Satellite Live Surveillance');
});

test('late forecast and catalog responses cannot overwrite a new selection or its removal', async ({page}) => {
  let releaseCatalog!: () => void;
  const catalogGate = new Promise<void>(resolve => { releaseCatalog = resolve; });
  let releaseOld!: () => void;
  const oldGate = new Promise<void>(resolve => { releaseOld = resolve; });
  let oldRequested!: () => void;
  const oldStarted = new Promise<void>(resolve => { oldRequested = resolve; });
  await page.route('**/api/history/search*', async route => {
    await catalogGate;
    await route.fulfill({json: [{id: 'OLD', name: 'Old'}, {id: 'NEW', name: 'New'}]});
  });
  await page.route('**/api/active-systems*', async route => {
    const id = new URL(route.request().url()).searchParams.get('cyclone_id') || 'CURRENT';
    if (id === 'OLD') { oldRequested(); await oldGate; }
    await route.fulfill({json: [storm(id)]});
  });
  await page.goto('/forecast?cyclone_id=OLD');
  await oldStarted;
  await page.evaluate(() => {
    localStorage.setItem('cyclonet_selected_cyclone_id', 'NEW');
    window.dispatchEvent(new Event('cyclonet:preferences'));
  });
  await expect(page.getByRole('heading', {name: 'NEW fixture', exact: true})).toBeVisible();
  await expect(page.getByText('Esri base imagery (not live telemetry)', {exact:true}).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('INSAT-3DR & GEE Live Surveillance');
  releaseCatalog();
  releaseOld();
  await expect(page.getByRole('combobox', {name: 'Select storm'}).locator('option')).toHaveCount(3);
  await expect(page.getByRole('combobox', {name: 'Select storm'})).toHaveValue('NEW');
  await page.getByRole('combobox', {name: 'Select storm'}).selectOption('');
  await expect(page.getByRole('heading', {name: 'CURRENT fixture', exact: true})).toBeVisible();
  await expect(page).toHaveURL(/\/forecast$/);
  expect(await page.evaluate(() => localStorage.getItem('cyclonet_selected_cyclone_id'))).toBeNull();
});

test('refresh live data clears an archive selected through the URL', async ({page}) => {
  await page.route('**/api/ingest/status', route => route.fulfill({json: {status: 'degraded', sources_status: {}, basin_status: 'STATUS_UNCERTAIN'}}));
  await page.route('**/api/active-systems*', route => {
    const id = new URL(route.request().url()).searchParams.get('cyclone_id') || 'CURRENT';
    return route.fulfill({json: [storm(id)]});
  });
  await page.goto('/dashboard?simulate=ARCHIVE');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cyclonet_selected_cyclone_id'))).toBe('ARCHIVE');
  await page.getByRole('button', {name: /Refresh live data/i}).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cyclonet_selected_cyclone_id'))).toBeNull();
  await expect(page.getByText(/CURRENT fixture/).first()).toBeVisible();
});
