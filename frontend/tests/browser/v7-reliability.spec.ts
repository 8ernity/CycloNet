import {test,expect} from '@playwright/test';

test('HTTP 503 readiness is visible rather than silently treated as a waking service',async({page})=>{
  await page.route('**/health**',route=>route.fulfill({status:503,json:{status:'unready'}}));
  await page.goto('/settings',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('Backend unavailable. Data may be out of date.')).toBeVisible();
});

test('mobile navigation opens, supports keyboard dismissal, and reaches settings',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/dashboard',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Open navigation'}).click();
  await expect(page.getByRole('navigation',{name:'Mobile navigation'})).toBeVisible();
  if(process.env.V7_SCREENSHOTS) await page.screenshot({path:'../.verification/v7-mobile-navigation.png'});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation',{name:'Mobile navigation'})).not.toBeVisible();
  await page.getByRole('button',{name:'Open navigation'}).click();
  await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Settings'}).click();
  await expect(page.getByRole('main').getByRole('heading',{name:'Settings',exact:true})).toBeInViewport();
});

for(const [device,width,height] of [['mobile',390,844],['tablet',820,1180],['desktop',1440,900]] as const) {
  test(`${device} pages remain usable during a provider outage`,async({page})=>{
    test.setTimeout(90000);
    await page.setViewportSize({width,height});
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',route=>route.fulfill({status:503,json:{detail:'Fixture provider outage'}}));
    await page.route('**/health**',route=>route.fulfill({status:503,json:{status:'unready'}}));
    for(const path of ['/dashboard','/classification','/archive','/compare','/forecast','/reports','/infrastructure','/settings']) {
      await page.goto(path,{waitUntil:'domcontentloaded'});
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.locator('header h1')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}
