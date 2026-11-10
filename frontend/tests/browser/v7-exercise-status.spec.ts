import {test,expect} from '@playwright/test';

test('exercise failure never reports transmission and a successful retry creates only a draft',async({page})=>{
  let fail=true;
  await page.route('**/api/history/search*',route=>route.fulfill({json:[]}));
  await page.route('**/api/reports/bulletins?*',route=>route.fulfill({json:{
    mode:'EXPERIMENTAL_ANALYSIS',system:{id:'EXERCISE',name:'Exercise fixture',lat:15,lon:85,category:'Unknown',intensity_knots:null},
    bulletins:[],affected_districts:[],port_signals:[],cap_xml:''
  }}));
  await page.route('**/api/alerts/broadcast-test',route=>fail
    ?route.fulfill({status:403,json:{detail:'Forbidden'}})
    :route.fulfill({json:{dispatch_id:'DRAFT-FIXTURE',timestamp:'2026-01-01T00:00:00Z',message_payload:'EXERCISE ONLY. No transmission.'}}));
  await page.goto('/reports',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Broadcast|Exercise drafts/i}).first().click();
  await expect(page.getByRole('main')).not.toContainText(/Gateway Handshake|Siren Trigger Synchronized|Delivery Confirmation/);
  await page.getByRole('button',{name:'Generate exercise draft',exact:true}).click();
  await expect(page.getByText('Exercise request failed. No broadcast was sent.',{exact:true})).toBeVisible();
  await expect(page.getByText('Draft received. No transmission or hardware activation occurred.',{exact:true})).toHaveCount(0);
  fail=false;
  await page.getByRole('button',{name:'Generate exercise draft',exact:true}).click();
  await expect(page.getByText('Draft received. No transmission or hardware activation occurred.',{exact:true})).toBeVisible();
  await expect(page.getByText(/Exercise draft receipt: DRAFT-FIXTURE/)).toBeVisible();
});
