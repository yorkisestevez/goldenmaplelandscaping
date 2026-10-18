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
