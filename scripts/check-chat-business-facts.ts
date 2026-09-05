import assert from 'node:assert/strict';
import { handler } from '../netlify/functions/chat';
import { publicContact } from '../src/data/business';

// Process-local test environment only. No dotenv loading, provider requests or CRM writes.
delete process.env.DEEPSEEK_API_KEY;
delete process.env.GM_CRM_BRIDGE_URL;
delete process.env.GM_CRM_BRIDGE_SECRET;
let requests = 0;
globalThis.fetch = async () => { requests++; throw new Error('Network disabled in fact-policy test'); };
for (const question of ['How much does a patio cost?', 'What does your warranty cover?', 'Do you serve my town?']) {
  const response = await handler({ httpMethod: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: question }] }) });
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.source, 'fallback');
  assert.ok(body.reply.includes(publicContact.phoneDisplay));
  assert.doesNotMatch(body.reply, /No job minimum|Every build carries|WSIB certified|\$5M|12–16|\$99|free call/i);
}
assert.equal(requests, 0);
assert.equal((await handler({ httpMethod:'GET',body:null })).statusCode,405);
assert.equal((await handler({ httpMethod:'POST',body:'{' })).statusCode,400);
assert.equal((await handler({ httpMethod:'POST',body:JSON.stringify({messages:[]}) })).statusCode,400);

// Synthetic fetch stub inspects the actual prompt assembled by the real handler.
process.env.DEEPSEEK_API_KEY = 'synthetic-test-only';
let capturedPrompt = '';
globalThis.fetch = async (_url, init) => {
  requests++;
  capturedPrompt = JSON.parse(String(init?.body)).messages[0].content;
  return new Response(JSON.stringify({choices:[{message:{content:'Please confirm the project terms with the team.'}}]}),{status:200,headers:{'Content-Type':'application/json'}});
};
const result = await handler({httpMethod:'POST',body:JSON.stringify({messages:[{role:'user',content:'Are design visits free?'}]})});
assert.equal(result.statusCode,200);
assert.match(capturedPrompt,/Do not assert a minimum investment/);
assert.match(capturedPrompt,/Do not characterize the appointment as free or paid/);
assert.ok(capturedPrompt.includes(publicContact.phoneDisplay));
assert.doesNotMatch(capturedPrompt,/\$99|\$5M|No job minimum:|They excavate a 12/);
assert.equal(requests,1);
console.log('PASS: 3 real fallback paths, 3 validation boundaries, 1 synthetic prompt-assembly path; zero external network requests.');
