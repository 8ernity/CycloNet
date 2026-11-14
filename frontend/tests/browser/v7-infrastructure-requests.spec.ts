import {test,expect,type Page} from '@playwright/test';

async function scenario(page:Page) {
  await page.addInitScript(()=>{
    const original=window.fetch.bind(window);
    const cancelled:string[]=[];Reflect.set(window,'cancelledDraftRequests',cancelled);
    window.fetch=(input,options)=>{
      if (/alerts\/dispatch|pre-landfall-briefing/.test(String(input))) options?.signal?.addEventListener('abort',()=>cancelled.push(String(input)),{once:true});
      return original(input,options);
    };
  });
  await page.route('**/api/history/search*',route=>route.fulfill({json:[]}));
  await page.route('**/api/active-systems*',route=>route.fulfill({json:[]}));
  await page.route('**/api/surge/calculate*',route=>route.fulfill({json:{peak_surge_height_m:0,inland_penetration_km:0}}));
  await page.route('**/api/surge/profile*',route=>route.fulfill({json:{sectors:[]}}));
  await page.route('**/api/gee/rainfall-pathways*',route=>route.fulfill({json:{pathways:[]}}));
  await page.goto('/infrastructure?tab=dispatch',{waitUntil:'domcontentloaded'});
  await page.getByRole('checkbox',{name:'Show illustrative scenario assets'}).check();
  await expect(page.getByText('Peak Storm Surge Height',{exact:true}).locator('..')).toContainText('0');
}
const draft=(id:string)=>({dispatch_id:id,cap_xml:'EXERCISE ONLY',sms_payload:{},sachet_payload:{},siren_payload:{},vhf_payload:'',municipal_briefing:[]});

test('changing a draft region cancels old work and allows a current draft immediately',async({page})=>{
  await scenario(page);
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  let started!:()=>void;const requested=new Promise<void>(resolve=>{started=resolve;});
  let first=true;
  await page.route('**/api/alerts/dispatch',async route=>{
    expect(route.request().postDataJSON().surge).toBe(0);
    if(first){first=false;started();await gate;await route.fulfill({json:draft('OBSOLETE-DRAFT')});}
    else await route.fulfill({json:draft('CURRENT-DRAFT')});
  });
  await page.getByRole('button',{name:/Dispatch Multi-Channel Advisory|Generate exercise draft/i}).click();
  await requested;
  try {
    await page.locator('input[value="Sundarbans & Odisha Coastal Corridor"]').fill('Revised exercise region');
    await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'cancelledDraftRequests').length)).toBeGreaterThan(0);
    await page.getByRole('button',{name:'Generate exercise draft',exact:true}).click();
    await expect(page.getByText('ID: CURRENT-DRAFT',{exact:true})).toBeVisible();
    release();
    await expect(page.getByText('ID: OBSOLETE-DRAFT',{exact:true})).toHaveCount(0);
    await page.getByRole('checkbox',{name:'Show illustrative scenario assets'}).uncheck();
    await page.getByRole('checkbox',{name:'Show illustrative scenario assets'}).check();
    await expect(page.getByText('ID: CURRENT-DRAFT',{exact:true})).toHaveCount(0);
  } finally {release();}
});

test('closing a pending summary cancels it and a new summary cannot be overwritten',async({page})=>{
  await scenario(page);
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  let started!:()=>void;const requested=new Promise<void>(resolve=>{started=resolve;});
  let first=true;
  await page.route('**/api/ai/pre-landfall-briefing',async route=>{
    if(first){first=false;started();await gate;await route.fulfill({json:{briefing:{executive_summary:'OBSOLETE-SUMMARY',action_checklist:[]}}});}
    else await route.fulfill({json:{briefing:{executive_summary:'CURRENT-SUMMARY',action_checklist:[]}}});
  });
  await page.getByRole('button',{name:'Scenario summary',exact:true}).click();await requested;
  try {
    const modal=page.getByRole('heading',{name:'Deterministic scenario summary',exact:true}).locator('../../..');
    await modal.getByRole('button').first().click();
    await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'cancelledDraftRequests').length)).toBeGreaterThan(0);
    await page.getByRole('button',{name:'Scenario summary',exact:true}).click();
    await expect(page.getByText('CURRENT-SUMMARY',{exact:true})).toBeVisible();
    release();await expect(page.getByText('OBSOLETE-SUMMARY',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Close scenario summary'})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button',{name:'Close scenario summary'})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Scenario summary',exact:true})).toBeFocused();
  } finally {release();}
});

test('malformed exercise results show failure and never claim transmission',async({page})=>{
  await scenario(page);
  await page.route('**/api/alerts/dispatch',route=>route.fulfill({json:{dispatch_id:'INVALID',cap_xml:{unexpected:true}}}));
  await page.getByRole('button',{name:/Dispatch Multi-Channel Advisory|Generate exercise draft/i}).click();
  await expect(page.getByText('Exercise request failed. No broadcast was sent.',{exact:true})).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText(/Transmitting|EXERCISE DRAFT CREATED/);
});
