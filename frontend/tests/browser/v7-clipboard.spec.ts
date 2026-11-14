import {test,expect,type Page} from '@playwright/test';

async function report(page:Page) {
  await page.route('**/api/history/search*',r=>r.fulfill({json:[]}));
  await page.route('**/api/reports/bulletins?*',r=>r.fulfill({json:{mode:'EXPERIMENTAL_ANALYSIS',system:{id:'COPY',name:'Copy fixture',lat:15,lon:85,category:'Unknown',intensity_knots:null},bulletins:[1,2].map(n=>({id:`COPY-${n}`,number:n,title:`Fixture bulletin ${n}`,full_text:`Fixture content ${n}`,category:'Unknown',alert_level:'YELLOW',timestamp_ist:'Fixture time',is_latest:n===1})),affected_districts:[],port_signals:[]}}));
  await page.goto('/reports',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Experimental Analyses/}).click();
}
async function infrastructure(page:Page) {
  await page.route('**/api/history/search*',r=>r.fulfill({json:[]}));
  await page.route('**/api/active-systems*',r=>r.fulfill({json:[]}));
  await page.route('**/api/surge/calculate*',r=>r.fulfill({json:{peak_surge_height_m:0}}));
  await page.route('**/api/surge/profile*',r=>r.fulfill({json:{sectors:[]}}));
  await page.route('**/api/gee/rainfall-pathways*',r=>r.fulfill({json:{pathways:[]}}));
  await page.route('**/api/alerts/dispatch',r=>r.fulfill({json:{dispatch_id:'COPY-DRAFT',cap_xml:'Exercise XML',sms_payload:{},sachet_payload:{},siren_payload:{},vhf_payload:'',municipal_briefing:[]}}));
  await page.goto('/infrastructure?tab=dispatch',{waitUntil:'domcontentloaded'});
  await page.getByRole('checkbox',{name:'Show illustrative scenario assets'}).check();
  await page.getByRole('button',{name:'Generate exercise draft',exact:true}).click();
  await expect(page.getByText('ID: COPY-DRAFT',{exact:true})).toBeVisible();
}
async function chat(page:Page) {
  await page.route('**/api/chat',r=>r.fulfill({json:{response:'Copy fixture response',sources:[],timestamp:'fixture'}}));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Ask CycloNet AI'}).click();
  await page.getByPlaceholder('Ask me anything about cyclones...').fill('Explain cyclogenesis');
  await page.getByTitle('Send Message').click();
  await expect(page.getByText('Copy fixture response',{exact:true})).toBeVisible();
}
for(const kind of ['report','infrastructure','chat'] as const) {
  test(`${kind} copy reports denied permission, waits for success, and can retry`,async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      let fail=true;
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:(value:string)=>{
        if(fail){fail=false;return Promise.reject(new DOMException('Denied','NotAllowedError'));}
        Reflect.set(window,'copiedFixtureText',value);
        return new Promise<void>(resolve=>Reflect.set(window,'resolveFixtureCopy',resolve));
      }}});
    });
    await (kind==='report'?report:kind==='infrastructure'?infrastructure:chat)(page);
    const copy=page.getByRole('button',{name:kind==='infrastructure'?'Copy XML':'Copy',exact:true}).first();
    await copy.click();
    await expect(page.getByText('Copy failed. Select the text and copy it manually.',{exact:true})).toBeVisible();
    await copy.click();
    await expect(page.getByText('Copying…',{exact:true})).toBeVisible();
    await expect(page.getByText('Copied to clipboard.',{exact:true})).toHaveCount(0);
    await page.evaluate(()=>Reflect.get(window,'resolveFixtureCopy')());
    await expect(page.getByText('Copied to clipboard.',{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>Reflect.get(window,'copiedFixtureText'))).toBe(kind==='report'?'Fixture content 1':kind==='infrastructure'?'Exercise XML':'Copy fixture response');
    expect(errors).toEqual([]);
    if(kind==='report') {
      const second=page.getByRole('button',{name:'Select bulletin 2',exact:true});
      await second.focus();await page.keyboard.press('Enter');
      await expect(second).toHaveAttribute('aria-pressed','true');
      await expect(page.getByRole('heading',{name:'Fixture bulletin 2',exact:true})).toBeVisible();
    }
  });
}
test('missing clipboard API fails safely without a success indicator',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
  await chat(page);
  await page.getByRole('button',{name:'Copy',exact:true}).click();
  await expect(page.getByText('Copy failed. Select the text and copy it manually.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Copied',exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
});
