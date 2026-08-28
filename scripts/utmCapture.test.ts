import assert from 'node:assert/strict';

type MockStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

function installBrowser(href: string, storage?: MockStorage, referrer = ''): Map<string, string> {
  const values = new Map<string, string>();
  const activeStorage: MockStorage = storage ?? {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  const url = new URL(href);
  const globals = globalThis as unknown as {
    window: unknown; document: unknown; sessionStorage: MockStorage; localStorage: MockStorage;
  };
  globals.window = { location: { href, pathname: url.pathname, search: url.search } };
  globals.document = { referrer };
  globals.sessionStorage = activeStorage;
  globals.localStorage = activeStorage;
  return values;
}

const attribution = await import('../src/utils/utmCapture.ts');

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('persists a validated first campaign touch and exposes latest touch', () => {
  const storage = installBrowser('https://goldenmaplelandscaping.ca/contact?campaign_id=summer_2026&variant_id=hero-a&touch_id=spoofed&utm_source=google', undefined, 'https://google.ca');
  attribution.initAttributionCapture();
  const fields = attribution.getAttributionFields();
  assert.equal(fields.campaign_id, 'summer_2026');
  assert.equal(fields.variant_id, 'hero-a');
  assert.match(fields.touch_id, /^touch:/);
  assert.equal(fields.latest_touch_id, fields.touch_id);
  assert.notEqual(fields.touch_id, 'spoofed');
  assert.equal(fields.utm_source, 'google');
  assert.equal(fields.referrer, 'https://google.ca');
  assert.ok(storage.get('gm_attribution'));
});

test('never overwrites first touch but updates latest touch only from explicit valid campaign parameters', () => {
  const storage = installBrowser('https://goldenmaplelandscaping.ca/?campaign_id=first&variant_id=a&touch_id=t1');
  attribution.initAttributionCapture();
  installBrowser('https://goldenmaplelandscaping.ca/services?utm_campaign=ignored', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); },
  });
  attribution.initAttributionCapture();
  installBrowser('https://goldenmaplelandscaping.ca/contact?campaign_id=second&variant_id=b&touch_id=t2', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); },
  });
  attribution.initAttributionCapture();
  const fields = attribution.getAttributionFields();
  assert.equal(fields.campaign_id, 'first');
  assert.equal(fields.variant_id, 'a');
  assert.match(fields.touch_id, /^touch:/);
  assert.equal(fields.latest_campaign_id, 'second');
  assert.equal(fields.latest_variant_id, 'b');
  assert.match(fields.latest_touch_id, /^touch:/);
  assert.notEqual(fields.latest_touch_id, fields.touch_id);
});

test('records literal direct first landing and keeps a later campaign as latest only', () => {
  const storage = installBrowser('https://goldenmaplelandscaping.ca/about');
  attribution.initAttributionCapture();
  installBrowser('https://goldenmaplelandscaping.ca/contact?campaign_id=later&variant_id=v1&touch_id=t3', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); },
  });
  attribution.initAttributionCapture();
  const fields = attribution.getAttributionFields();
  assert.equal(fields.landing_page, '/about');
  assert.equal(fields.campaign_id, undefined);
  assert.equal(fields.latest_campaign_id, 'later');
});

test('rejects malformed or oversized identifiers without changing existing attribution', () => {
  const storage = installBrowser('https://goldenmaplelandscaping.ca/?campaign_id=good&variant_id=v1&touch_id=t1');
  attribution.initAttributionCapture();
  installBrowser(`https://goldenmaplelandscaping.ca/?campaign_id=${'x'.repeat(129)}&variant_id=bad!&touch_id=%3Cscript%3E`, {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); },
  });
  attribution.initAttributionCapture();
  const fields = attribution.getAttributionFields();
  assert.equal(fields.campaign_id, 'good');
  assert.equal(fields.latest_campaign_id, 'good');
  assert.equal(fields.latest_variant_id, 'v1');
  assert.match(fields.latest_touch_id, /^touch:/);
});

test('handles disabled storage and malformed stored JSON safely', () => {
  const disabled: MockStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  installBrowser('https://goldenmaplelandscaping.ca/?campaign_id=ok&variant_id=v&touch_id=t', disabled);
  assert.doesNotThrow(() => attribution.initAttributionCapture());
  assert.deepEqual(attribution.getAttributionFields(), {});
  installBrowser('https://goldenmaplelandscaping.ca/', { getItem: () => '{bad json', setItem: () => {} });
  assert.equal(attribution.readAttribution(), null);
});

test('uses exactly one conversion ID for Meta event dedup and conversion attribution', () => {
  assert.deepEqual(attribution.getConversionEventFields('550e8400-e29b-41d4-a716-446655440000'), {
    event_id: '550e8400-e29b-41d4-a716-446655440000',
    conversion_event_id: '550e8400-e29b-41d4-a716-446655440000',
  });
  assert.throws(() => attribution.getConversionEventFields('bad id'), /invalid conversion event id/);
});

test('ignores partial campaign touches so latest campaign and variant never form a false pair', () => {
  const values = installBrowser('https://goldenmaplelandscaping.ca/?campaign_id=first&variant_id=a');
  attribution.initAttributionCapture();
  installBrowser('https://goldenmaplelandscaping.ca/?campaign_id=second', {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  });
  attribution.initAttributionCapture();
  const fields = attribution.getAttributionFields();
  assert.equal(fields.latest_campaign_id, 'first');
  assert.equal(fields.latest_variant_id, 'a');
});

test('drops oversized incoming UTM values before persistence', () => {
  installBrowser(`https://goldenmaplelandscaping.ca/?utm_campaign=${'x'.repeat(501)}`);
  attribution.initAttributionCapture();
  assert.equal(attribution.getAttributionFields().utm_campaign, undefined);
});

test('expires persistent attribution after the documented inactivity window', () => {
  let removed = false;
  installBrowser('https://goldenmaplelandscaping.ca/', {
    getItem: () => JSON.stringify({ campaign_id: 'old', variant_id: 'v1', _expires_at: Date.now() - 1 }),
    setItem: () => {},
    removeItem: () => { removed = true; },
  });
  assert.equal(attribution.readAttribution(), null);
  assert.equal(removed, true);
});
