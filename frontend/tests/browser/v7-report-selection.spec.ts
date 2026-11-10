import {test, expect} from '@playwright/test';

const report = (id: string) => ({mode:'EXPERIMENTAL_ANALYSIS',
  system:{id,name:`${id} report`,basin:'Not available',lat:15,lon:85,intensity_knots:null,category:'Unknown',is_simulation:id==='DEMO'},
  bulletins:[],affected_districts:[],port_signals:[],cap_xml:''});

test('late manually requested demo cannot replace a newly selected report',async({page})=>{
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let started!:()=>void;
  const demoStarted=new Promise<void>(resolve=>{started=resolve;});
  let delivered!:()=>void;
  const demoDelivered=new Promise<void>(resolve=>{delivered=resolve;});
  await page.route('**/api/history/search*',route=>route.fulfill({json:[]}));
  await page.route('**/api/reports/bulletins?*',async route=>{
    const params=new URL(route.request().url()).searchParams;
    if(params.has('simulate')) {
      started();await gate;await route.fulfill({json:report('DEMO')});delivered();return;
    }
    if(params.get('cyclone_id')==='NEW') return route.fulfill({json:report('NEW')});
    return route.fulfill({status:503,json:{detail:'Unavailable'}});
  });
  await page.goto('/reports');
  await page.getByRole('button',{name:'Open synthetic demonstration report',exact:true}).click();
  await demoStarted;
  await page.evaluate(()=>{
    localStorage.setItem('cyclonet_selected_cyclone_id','NEW');
    window.dispatchEvent(new Event('cyclonet:preferences'));
  });
  await expect(page.getByRole('button',{name:'JSON',exact:true})).toBeVisible();
  release();await demoDelivered;
  // Let the delivered body and React updates settle before exporting what is displayed.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'JSON',exact:true}).click();
  const file=await downloaded;
  const stream=await file.createReadStream();
  const parts=[];for await(const part of stream!) parts.push(part);
  expect(JSON.parse(Buffer.concat(parts).toString()).system.id).toBe('NEW');
  await expect(page.getByRole('main')).not.toContainText('DEMO report');
});
