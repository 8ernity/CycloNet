import {test, expect} from '@playwright/test';

async function openChat(page: import('@playwright/test').Page) {
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Ask CycloNet AI'}).click();
  await expect(page.getByTitle('Close Assistant')).toBeVisible();
}

test('new conversation cancels the old request and can send immediately', async({page})=>{
  let releaseOld!:()=>void;
  let requestStarted!:()=>void;
  const held=new Promise<void>(resolve=>{releaseOld=resolve;});
  const started=new Promise<void>(resolve=>{requestStarted=resolve;});
  let calls=0;
  await page.route('**/api/chat',async route=>{
    calls++;
    if(calls===1) {
      requestStarted();
      await held;
      await route.fulfill({json:{response:'OBSOLETE_REPLY',sources:[],timestamp:'fixture'}}).catch(()=>{});
    } else {
      await route.fulfill({json:{response:'CURRENT_REPLY',sources:[],timestamp:'fixture'}});
    }
  });
  try {
    await openChat(page);
    await page.getByPlaceholder('Ask me anything about cyclones...').fill('First question');
    await page.getByTitle('Send Message').click();
    await started;
    await page.getByTitle('More Options').click();
    await page.getByRole('button',{name:'New Conversation'}).click();
    await page.getByPlaceholder('Ask me anything about cyclones...').fill('Second question');
    await expect(page.getByTitle('Send Message')).toBeEnabled();
    await page.getByTitle('Send Message').click();
    await expect(page.getByText('CURRENT_REPLY',{exact:true})).toBeVisible();
    releaseOld();
    await expect(page.getByText('OBSOLETE_REPLY',{exact:true})).toHaveCount(0);
    await expect(page.getByText('Source information is unavailable.',{exact:false})).toHaveCount(0);
  } finally {releaseOld();}
});

for(const [name,payload] of [
  ['object response',{response:{text:'invalid'},sources:[]}],
  ['invalid sources',{response:'INVALID_REPLY',sources:{official:true}}],
  ['excessive response',{response:'x'.repeat(12001),sources:[]}],
] as const) {
  test(`malformed chat ${name} shows a recoverable error`,async({page})=>{
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/chat',route=>route.fulfill({json:payload}));
    await openChat(page);
    await page.getByPlaceholder('Ask me anything about cyclones...').fill('Explain cyclogenesis');
    await page.getByTitle('Send Message').click();
    await expect(page.getByText(/Source information is unavailable/)).toBeVisible();
    await page.getByPlaceholder('Ask me anything about cyclones...').fill('Try again');
    await expect(page.getByTitle('Send Message')).toBeEnabled();
    expect(errors).toEqual([]);
  });
}
