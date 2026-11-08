import {test,expect} from '@playwright/test';

test('infrastructure starts with unavailable field data and explicit scenario opt-in',async({page})=>{
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{detail:'Unavailable'}}));
  await page.goto('/infrastructure', {waitUntil:'domcontentloaded'});
  await expect(page.getByText('Operational status not verified. No authorized infrastructure observations are connected.')).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Show illustrative scenario assets'})).not.toBeChecked();
  await expect(page.locator('body')).not.toContainText(/SECURE \(DG|RECOMMENDED EVACUATION|320 Coastal Sirens/);
  await page.getByRole('checkbox',{name:'Show illustrative scenario assets'}).check();
  await expect(page.getByText(/ILLUSTRATIVE SCENARIO — asset names/)).toBeVisible();
  await page.getByRole('button',{name:/Shelters/i}).click();
  await expect(page.locator('body')).toContainText('Unavailable');
  await expect(page.locator('body')).not.toContainText(/SECURE \(DG|RECOMMENDED EVACUATION/);
});

test('failed forecast request offers retry without choosing an active demo',async({page})=>{
  await page.route('**/api/history/search*',route=>route.fulfill({json:[]}));
  const urls:string[]=[];
  await page.route('**/api/active-systems*',route=>{urls.push(route.request().url());return route.fulfill({status:503,json:{detail:'Unavailable'}});});
  await page.goto('/forecast', {waitUntil:'domcontentloaded'});
  await expect(page.getByRole('button',{name:/Retry/i})).toBeVisible();
  await expect(page.locator('body')).toContainText('unavailable');
  expect(urls.every(url=>!url.includes('simulate=true')&&!url.includes('BOB'))).toBe(true);
});

test('hyphenated source ID uses explicit provenance and unvalidated accuracy',async({page})=>{
  await page.route('**/api/history/search*',route=>route.fulfill({json:[]}));
  await page.route('**/api/active-systems*',route=>route.fulfill({json:[{id:'LIVE-IMD-FIXTURE',name:'Source fixture',basin:'Bay of Bengal',lat:15,lon:85,category:'Unknown',intensity_knots:null,provenance:'LIVE_OBSERVATION',is_stale:true,observation_time_utc:'2020-01-01T00:00:00Z',track_forecast:[]}]}));
  await page.goto('/forecast', {waitUntil:'domcontentloaded'});
  await expect(page.getByText('LIVE_OBSERVATION',{exact:true}).first()).toBeVisible();
  await expect(page.locator('body')).toContainText('Not validated');
  await expect(page.getByRole('main')).not.toContainText('HISTORICAL_ARCHIVE');
  await expect(page.locator('body')).toContainText('STALE — current conditions not verified');
  await expect(page.locator('body')).toContainText('Track waypoints unavailable');
  await expect(page.getByRole('main')).not.toContainText(/STABLE|Steering ridge|Official IMD-compatible/);
});

test('archive outage has a retry and does not report an empty successful result',async({page})=>{
  await page.route('**/api/history/search*',route=>route.fulfill({status:503,json:{detail:'Unavailable'}}));
  await page.goto('/archive', {waitUntil:'domcontentloaded'});
  // The shared client retries transient 503 responses twice before reporting failure.
  await expect(page.getByRole('button',{name:'Retry archive'})).toBeVisible({timeout:15000});
  await expect(page.locator('body')).not.toContainText('No historical cyclones found');
});

test('landing page does not advertise unimplemented inference or delivery',async({page})=>{
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).not.toContainText(/Gemini 3\.7|NDMA \/ SDMA Dispatches|100% Liquidity|14 extra hours|12ms|7-Language Executive/);
  await expect(page.locator('body')).toContainText('Independent evaluation');
});
