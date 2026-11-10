import {test, expect} from '@playwright/test';

for (const routePath of ['/forecast','/infrastructure','/compare']) {
  test(`${routePath} cancels a stalled source read and offers recovery`,async({page})=>{
    await page.clock.install();
    await page.addInitScript(()=>{
      const original=window.fetch.bind(window);
      const cancelled:string[]=[];
      Reflect.set(window,'cancelledSourceReads',cancelled);
      window.fetch=(input,options)=>{
        if(String(input).includes('/api/active-systems')) options?.signal?.addEventListener('abort',()=>cancelled.push(String(input)),{once:true});
        return original(input,options);
      };
    });
    let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    let started!:()=>void;
    const requested=new Promise<void>(resolve=>{started=resolve;});
    await page.route('**/api/history/search*',route=>route.fulfill({json:[]}));
    await page.route('**/api/active-systems*',async route=>{
      started();await gate;await route.fulfill({json:[]});
    });
    await page.goto(routePath,{waitUntil:'domcontentloaded'});
    await requested;
    await page.clock.fastForward(13000);
    try {
      const button=routePath==='/forecast'?'Retry track source':routePath==='/compare'?'Retry comparison':'Retry source';
      await expect(page.getByRole('button',{name:button,exact:true})).toBeVisible();
      await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'cancelledSourceReads').length)).toBeGreaterThan(0);
    } finally {release();}
  });
}

test('a malformed scenario component cannot publish partial calculations, and retry recovers',async({page})=>{
  let broken=true;
  await page.route('**/api/history/search*',route=>route.fulfill({json:[]}));
  await page.route('**/api/active-systems*',route=>route.fulfill({json:[]}));
  await page.route('**/api/surge/calculate*',route=>route.fulfill({json:{peak_surge_height_m:9.876,inland_penetration_km:1}}));
  await page.route('**/api/surge/profile*',route=>broken
    ?route.fulfill({contentType:'application/json',body:'{'})
    :route.fulfill({json:{sectors:[]}}));
  await page.route('**/api/gee/rainfall-pathways*',route=>route.fulfill({json:{pathways:[]}}));
  await page.route('**/api/gee/layers*',route=>route.fulfill({json:{layers:[]}}));
  await page.goto('/infrastructure',{waitUntil:'domcontentloaded'});
  await page.getByRole('checkbox',{name:'Show illustrative scenario assets'}).check();
  const metric=page.getByText('Peak Storm Surge Height',{exact:true}).locator('..');
  await expect(page.getByText('Scenario calculation unavailable. No complete result was received.',{exact:true})).toBeVisible();
  await expect(metric).toContainText('Unavailable');
  await expect(metric).not.toContainText('9.876');
  broken=false;
  await page.getByRole('button',{name:'Retry scenario',exact:true}).click();
  await expect(metric).toContainText('9.876');
});
