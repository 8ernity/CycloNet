import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page,tab:string) {
  await page.route('**/api/history/search*',r=>r.fulfill({json:[]}));
  await page.route('**/api/active-systems*',r=>r.fulfill({json:[]}));
  await page.route('**/api/surge/profile*',r=>r.fulfill({json:{sectors:[]}}));
  await page.route('**/api/gee/rainfall-pathways*',r=>r.fulfill({json:{pathways:[]}}));
  await page.goto(`/infrastructure?tab=${tab}`,{waitUntil:'domcontentloaded'});
  await page.getByRole('checkbox',{name:'Show illustrative scenario assets'}).check();
}
test('failed surge cannot create grid or road exposure or a severe-surge classification',async({page})=>{
  let fail=true;
  await page.route('**/api/surge/calculate*',r=>fail?r.fulfill({status:503,json:{detail:'Unavailable'}}):r.fulfill({json:{peak_surge_height_m:0,severity_level:'FIXTURE_ZERO',inland_penetration_km:0}}));
  await setup(page,'grid');
  await expect(page.getByRole('button',{name:'Retry scenario',exact:true})).toBeVisible();
  await expect(page.getByText('Grid exposure unavailable: a complete current scenario calculation is required.',{exact:true}).first()).toBeVisible();
  await expect(page.getByText(/\d+% (CRITICAL|HIGH|MODERATE|LOW)/)).toHaveCount(0);
  await page.getByRole('button',{name:/Road scenario exposure/}).click();
  await expect(page.getByText('Road exposure unavailable: a complete current scenario calculation is required.',{exact:true}).first()).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText(/🔵 SAFE|🟠 RISKY|🔴 INUNDATED|Predicted Flood Depth:/);
  await page.getByRole('button',{name:'Storm Surge & Drainage Choke Points',exact:true}).click();
  await expect(page.getByText('SEVERE_SURGE',{exact:true})).toHaveCount(0);
  fail=false;await page.getByRole('button',{name:'Retry scenario',exact:true}).click();
  await expect(page.getByText('FIXTURE_ZERO',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Road scenario exposure/}).click();
  await expect(page.getByText('Illustrative flood depth:',{exact:true}).first()).toBeVisible();
});
test('illustrative threshold results require data, compare both inputs and clear after changes',async({page})=>{
  let fail=true;
  await page.route('**/api/surge/calculate*',r=>fail?r.fulfill({status:503,json:{detail:'Unavailable'}}):r.fulfill({json:{peak_surge_height_m:2,inland_penetration_km:0}}));
  await setup(page,'insurance');
  const evaluate=page.getByRole('button',{name:/Simulate Sandbox Payout Trigger|Evaluate illustrative thresholds/});
  await expect(page.getByRole('button',{name:'Retry scenario',exact:true})).toBeVisible();
  await expect(evaluate).toBeDisabled();
  fail=false;await page.getByRole('button',{name:'Retry scenario',exact:true}).click();
  await evaluate.click();await expect(page.getByText('Illustrative thresholds not met.',{exact:true})).toBeVisible();
  const tier=page.getByRole('button',{name:'Select Tier 2 (Severe Storm)',exact:true});
  await tier.focus();await page.keyboard.press('Enter');
  await expect(tier).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('Illustrative thresholds not met.',{exact:true})).toHaveCount(0);
  await evaluate.click();await expect(page.getByText('Illustrative thresholds met.',{exact:true})).toBeVisible();
  await expect(page.getByText(/No policy eligibility, payout or transfer is established/)).toBeVisible();
  await page.getByRole('checkbox',{name:'Show illustrative scenario assets'}).uncheck();
  await page.getByRole('checkbox',{name:'Show illustrative scenario assets'}).check();
  await expect(page.getByText('Illustrative thresholds met.',{exact:true})).toHaveCount(0);
});
