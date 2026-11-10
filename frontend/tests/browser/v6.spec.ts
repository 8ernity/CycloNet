import {test,expect} from '@playwright/test';

test('opened assistant accurately describes available educational and source-status functions',async({page})=>{
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{detail:'Unavailable'}}));
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Ask CycloNet AI'}).click();
  await expect(page.getByTitle('Close Assistant')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Gemini 3\.7|3\.7 Flash|Estimate intensity from satellite frames|Generate municipal operational memo/);
  await expect(page.locator('body')).toContainText('Education and source status');
});

test('offline sample image cannot create intensity measurements or operational instructions',async({page})=>{
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{detail:'Unavailable'}}));
  await page.goto('/classification', {waitUntil:'domcontentloaded'});
  const classificationResponse = page.waitForResponse(response => response.url().includes('/api/classify') && response.request().method() === 'POST');
  await page.getByAltText('Demo Frame 4',{exact:true}).locator('..').click();
  expect((await classificationResponse).status()).toBe(503);
  await expect(page.getByRole('button',{name:'Export Analysis'})).toBeEnabled();
  await expect(page.locator('body')).not.toContainText(/Calibrated Ref|Enforce total coastal evacuation|Recommended Operational Action|89.3%/);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export Analysis'}).click();
  const download=await downloadPromise;
  const stream=await download.createReadStream();
  const chunks=[];
  for await (const chunk of stream!) chunks.push(chunk);
  const payload=JSON.parse(Buffer.concat(chunks).toString());
  expect(payload.result.wind_speed_knots).toBeNull();
  expect(payload.result.confidence).toBeNull();
  expect(payload.result.scientifically_validated).toBe(false);
  expect(payload.geminiResult.status).toBe('ANALYSIS_UNAVAILABLE');
  await expect(page.getByRole('button',{name:'Confirm & Log to Archive'})).toHaveCount(0);
  expect(JSON.stringify(payload)).not.toMatch(/Enforce total coastal evacuation|catastrophic surge warnings/);
});

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
  await page.getByRole('button',{name:/Road scenario exposure/i}).click();
  await expect(page.locator('body')).not.toContainText(/recommend safe alternative|Corridor 1 \(Mandatory\)/);
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
  await expect(page.locator('body')).not.toContainText(/unmatched precision|Designed to ISO 27001|10m Inundation Vector|Slope: 0.75m/);
  for(const label of ['Image classification','Surge scenarios','Infrastructure examples']) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect(page.locator('body')).not.toContainText(/105 KT Benchmark|-82.4°C Core|Ready \(7 Languages\)|3.85 meters|4.2 km Inland|NH-16 & SH-5 Monitored|Policy Rule Armed/);
  }
  await expect(page.locator('body')).toContainText('Independent evaluation');
});
