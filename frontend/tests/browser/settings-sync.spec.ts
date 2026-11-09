import {test, expect} from '@playwright/test';

test('dashboard refresh reads public observations without requesting admin ingestion',async({page})=>{
  let posts=0, statusReads=0;
  await page.route('**/api/**',route=>{
    if(route.request().method()==='POST'){posts++;return route.fulfill({status:401,json:{detail:'Administrator required'}});}
    if(route.request().url().includes('/ingest/status')) statusReads++;
    return route.fulfill({json:route.request().url().includes('/ingest/status') ? {
      status:'degraded',basin_status:'STATUS_UNCERTAIN',last_sync:null,is_syncing:false,active_systems_count:0,sources_status:{IMD_RSMC:'DEGRADED'}
    }:[]});
  });
  await page.goto('/dashboard',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>statusReads).toBeGreaterThan(0);
  const before=statusReads;
  await page.getByRole('button',{name:/Sync Live Feeds|Refresh live data/}).click();
  await expect.poll(()=>statusReads).toBeGreaterThan(before);
  await expect(page.getByRole('button',{name:'Refresh live data'})).toBeEnabled();
  expect(posts).toBe(0);
  await expect(page.getByText(/Administrative authorization required/)).toHaveCount(0);
});

test('settings describes actual notification and wind-convention behavior',async({page})=>{
  await page.goto('/settings',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('main')).not.toContainText(/Web Push connected|Browser Notification Active|\+14%|1\.14x|Listening on user endpoint/);
  await expect(page.getByRole('button',{name:'Send test notification'})).toBeVisible();
  await expect(page.getByRole('main')).toContainText('No push subscription or live alert delivery is connected');
  await expect(page.getByRole('heading',{name:'Settings',exact:true}).last()).toBeVisible();
  if(process.env.SETTINGS_SCREENSHOT_PREFIX) await page.screenshot({path:process.env.SETTINGS_SCREENSHOT_PREFIX+'-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Light',exact:true}).click();
  await expect(page.locator('html')).toHaveClass(/light/);
  if(process.env.SETTINGS_SCREENSHOT_PREFIX) await page.screenshot({path:process.env.SETTINGS_SCREENSHOT_PREFIX+'-light.png',fullPage:true});
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('button',{name:'Light',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('display preference is accessible, persisted, and never advertises converted observations',async({page})=>{
  await page.goto('/settings',{waitUntil:'domcontentloaded'});
  const jtwc=page.getByRole('button',{name:/JTWC categories/});
  await jtwc.focus();
  await page.keyboard.press('Enter');
  await expect(jtwc).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('main')).toContainText('No automatic wind conversion');
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(jtwc).toHaveAttribute('aria-pressed','true');
});

test('settings fits a narrow viewport and invalid endpoints cannot be saved',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/settings',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Custom backend/}).click();
  await page.getByLabel('Backend URL').fill('javascript:alert(1)');
  await page.getByRole('button',{name:'Save endpoint'}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('HTTP or HTTPS');
  expect(await page.evaluate(()=>localStorage.getItem('cyclonet_data_source'))).not.toBe('CUSTOM');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await expect(page.getByRole('main').getByRole('heading',{name:'Settings',exact:true})).toBeInViewport();
  if(process.env.SETTINGS_SCREENSHOT_PREFIX) await page.screenshot({path:process.env.SETTINGS_SCREENSHOT_PREFIX+'-mobile.png',fullPage:true});
});

test('settings opens at the top after navigating from a scrolled page',async({page})=>{
  await page.route('**/api/**',route=>route.fulfill({json:[]}));
  await page.goto('/dashboard',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.locator('aside nav').getByRole('link',{name:'Settings',exact:true}).click();
  const heading=page.getByRole('main').getByRole('heading',{name:'Settings',exact:true});
  await expect(heading).toBeInViewport();
  const top=(await heading.boundingBox())!.y;
  const headerBottom=await page.locator('header').evaluate(el=>el.getBoundingClientRect().bottom);
  expect(top).toBeGreaterThanOrEqual(headerBottom);
});

test('custom backend saves a normalized URL and persists across reload',async({page})=>{
  await page.goto('/settings',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Custom backend/}).click();
  await page.getByLabel('Backend URL').fill('https://weather.example/api/');
  await page.getByRole('button',{name:'Save endpoint'}).click();
  await expect(page.getByRole('button',{name:/Custom backend/})).toHaveAttribute('aria-pressed','true');
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByLabel('Backend URL')).toHaveValue('https://weather.example');
});

test('denied browser permission does not claim notifications are active',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'Notification',{value:class {static permission='denied';}}));
  await page.goto('/settings',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Send test notification'}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('permission is blocked');
  await expect(page.getByRole('main')).toContainText('No push subscription or live alert delivery is connected');
});
