import {test,expect} from '@playwright/test';

/**
 * Sophie's replies turn /book, /cost-estimator and /contact into buttons. The build rewrites quoted internal paths to
 * their slashed form (buildTools/trailingSlashLinks.ts), so a reply piece compared with a quoted '/book' never matched
 * and the mention showed as plain text. Sophie's socket and the fallback function are stubbed: nothing leaves the page.
 */
const REPLY='Happy to help. You can /book a visit, try the /cost-estimator, or /contact us.';

test('links in Sophie\'s reply become buttons',async({page,context})=>{
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.abort());
 await context.route('**/.netlify/functions/**',r=>r.fulfill({status:500,body:''}));
 await context.routeWebSocket(/elevenlabs\.io/,ws=>{
  ws.onMessage(raw=>{
   const msg=JSON.parse(String(raw));
   if(msg.type==='conversation_initiation_client_data')ws.send(JSON.stringify({type:'conversation_initiation_metadata'}));
   if(msg.type==='user_message')ws.send(JSON.stringify({type:'agent_response',agent_response_event:{agent_response:REPLY}}));
  });
 });
 await page.goto('/services/');
 await page.getByRole('button',{name:'Decline'}).click();
 await page.getByRole('button',{name:/^Open chat with Sophie/}).click();
 const chat=page.getByRole('dialog',{name:'Golden Maple chat assistant'});
 await chat.getByLabel('Type your message').fill('Can someone come look at my yard?');
 await chat.getByLabel('Send message').click();
 await expect(chat.getByText('Happy to help.')).toBeVisible();
 for(const name of ['book a site visit','cost calculator','contact us'])await expect(chat.getByRole('button',{name,exact:true})).toBeVisible();
 await expect(chat.getByText('/book',{exact:false})).toHaveCount(0);
 await chat.getByRole('button',{name:'book a site visit',exact:true}).click();
 await expect(page).toHaveURL(/\/book\/?$/);
});

for (const scenario of [
  {
    name: 'keeps a maintenance price follow-up in maintenance and accepts a switch to construction',
    path: '/services/',
    turns: ['Do you offer lawn care?', 'How much does it cost?'],
  },
  {
    name: 'answers a generic maintenance price question without the construction calculator',
    path: '/services/',
    turns: ['How much is maintenance?'],
  },
  {
    name: 'uses the maintenance enquiry for the maintenance page cost button',
    path: '/services/landscape-maintenance-barrie/',
    turns: [],
  },
]) {
  test(scenario.name, async ({ page, context }) => {
    await context.route('**/*', (route) => /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(route.request().url()) ? route.continue() : route.abort());
    await context.route('**/.netlify/functions/**', (route) => route.fulfill({ status: 500, body: '' }));
    await context.routeWebSocket(/elevenlabs\.io/, (socket) => socket.close());
    await page.goto(scenario.path);
    await page.getByRole('button', { name: 'Decline' }).click();
    await page.getByRole('button', { name: /^Open chat with Sophie/ }).click();
    const chat = page.getByRole('dialog', { name: 'Golden Maple chat assistant' });
    const maintenanceLinks = chat.getByRole('button', { name: 'request a maintenance quote' });
    const send = async (text: string) => {
      await chat.getByLabel('Type your message').fill(text);
      await chat.getByLabel('Send message').click();
    };

    if (!scenario.turns.length) {
      await chat.getByRole('button', { name: 'What would mine cost?' }).click();
      await expect(maintenanceLinks).toHaveCount(1, { timeout: 2500 });
    }
    for (const [index, turn] of scenario.turns.entries()) {
      await send(turn);
      await expect(maintenanceLinks).toHaveCount(index + 1, { timeout: 2500 });
    }
    await expect(chat.getByText('Happy to. What are you planning?')).toHaveCount(0);

    if (scenario.turns.length === 2) {
      await send('What would a new patio cost?');
      await expect(chat.getByText('Roughly how big is the patio?')).toBeVisible();
      await send('How much does it cost?');
      await expect(chat.getByText('Happy to. What are you planning?')).toBeVisible();
      await expect(maintenanceLinks).toHaveCount(2);
    }
  });
}
