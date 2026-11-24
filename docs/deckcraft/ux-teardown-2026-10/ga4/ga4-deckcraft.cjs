// Read-only GA4 pull for the DeckCraft UX teardown. Uses the existing foreman SA helper (analytics.readonly).
const { saToken } = require('C:/Users/yorki/Hermes Agent/skills/_lib/google-sa');
const PROPERTY = 'properties/519541477';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const [start, end] = [process.argv[2] || '2026-09-28', process.argv[3] || 'yesterday'];

async function run(token, body) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${PROPERTY}:runReport`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateRanges: [{ startDate: start, endDate: end }], limit: 500, ...body }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error?.message || res.status };
  return (json.rows || []).map(r => [...(r.dimensionValues || []).map(d => d.value), ...(r.metricValues || []).map(m => Number(m.value))]);
}
const deckPage = { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: 'deck-designer' } } };
const deckEvents = { filter: { fieldName: 'eventName', stringFilter: { matchType: 'BEGINS_WITH', value: 'deckcraft_' } } };

(async () => {
  const t = await saToken(SCOPE);
  const out = {};
  out.pageByDevice = await run(t, { dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'sessions' }, { name: 'userEngagementDuration' }], dimensionFilter: deckPage });
  out.pagePaths = await run(t, { dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }], dimensionFilter: deckPage });
  out.pageByWeek = await run(t, { dimensions: [{ name: 'isoYearIsoWeek' }], metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }], dimensionFilter: deckPage, orderBys: [{ dimension: { dimensionName: 'isoYearIsoWeek' } }] });
  out.events = await run(t, { dimensions: [{ name: 'eventName' }, { name: 'customEvent:event_label' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: deckEvents, orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }] });
  out.eventsByDevice = await run(t, { dimensions: [{ name: 'eventName' }, { name: 'deviceCategory' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: deckEvents });
  out.leads = await run(t, { dimensions: [{ name: 'eventName' }, { name: 'pagePath' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: { andGroup: { expressions: [deckPage, { filter: { fieldName: 'eventName', inListFilter: { values: ['generate_lead', 'cta_click', 'page_view', 'user_engagement', 'scroll'] } } }] } } });
  out.sources = await run(t, { dimensions: [{ name: 'sessionSourceMedium' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }], dimensionFilter: { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'CONTAINS', value: 'deck-designer' } } }, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] });
  out.browsers = await run(t, { dimensions: [{ name: 'browser' }, { name: 'operatingSystem' }, { name: 'city' }], metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }], dimensionFilter: deckPage, orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }] });
  out.siteTotals = await run(t, { metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }] });
  console.log(JSON.stringify({ start, end, ...out }, null, 1));
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
