import assert from 'node:assert/strict';
import { DAILY_PRODUCTION_RATES, applyDailyProductionFloor } from '../src/utils/pricingDoctrine.ts';

assert.deepEqual(DAILY_PRODUCTION_RATES, {
  bottom: 3400,
  target: 3700,
  premium: 4000,
});

const floored = applyDailyProductionFloor({
  labourLow: 2500,
  labourHigh: 4200,
  daysLow: 1,
  daysHigh: 1.5,
});
assert.equal(floored.labourLow, 3400);
assert.equal(floored.labourHigh, 6000);

const untouched = applyDailyProductionFloor({
  labourLow: 12000,
  labourHigh: 18000,
  daysLow: 2,
  daysHigh: 3,
});
assert.equal(untouched.labourLow, 12000);
assert.equal(untouched.labourHigh, 18000);

console.log('live estimator daily pricing floor test passed');
