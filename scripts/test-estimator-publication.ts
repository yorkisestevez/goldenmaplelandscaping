import React from 'react';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import EstimateBreakdown from '../src/components/EstimateBreakdown';
import { computeEstimate } from '../src/utils/estimateEngine';
import { FIXTURES } from './estimator-fixtures';
for (const [name,input] of FIXTURES) {
 const estimate=computeEstimate(input);
 if (!estimate.lines) continue;
 const html=renderToStaticMarkup(React.createElement(EstimateBreakdown,{...estimate,...estimate.lines,confidencePercent:8}));
 assert.doesNotMatch(html,/ICPI.certified|12[–-]16|5.year.{0,30}warranty/i,`${name}: calculator details leak unresolved business claims`);
}
console.log('Estimator rendered publication: PASS across all engine fixtures');
