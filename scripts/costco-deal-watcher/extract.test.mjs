import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractOntarioLocations,
  looksLikeCologneDeal,
  locationFingerprint,
} from './extract.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const warehouses = JSON.parse(
  readFileSync(join(dir, 'ontario-warehouses.json'), 'utf8')
);

describe('looksLikeCologneDeal', () => {
  test('matches Costco $99 cologne posts', () => {
    assert.equal(
      looksLikeCologneDeal('Costco has the designer cologne set for $99 at Barrie'),
      true
    );
  });

  test('rejects unrelated Costco posts', () => {
    assert.equal(looksLikeCologneDeal('Costco rotisserie chicken $5 Barrie'), false);
  });

  test('rejects $79.99 cologne as not the $99 drop', () => {
    assert.equal(
      looksLikeCologneDeal('Jo Malone English Pear Cologne $79.99 Costco.com'),
      false
    );
  });

  test('rejects $229.99 cologne', () => {
    assert.equal(
      looksLikeCologneDeal('Creed Aventus Eau de Parfum Cologne $229.99 Costco'),
      false
    );
  });
});

describe('extractOntarioLocations', () => {
  test('Barrie warehouse number', () => {
    const locs = extractOntarioLocations(
      'Saw the $99 cologne at Costco warehouse 1258 this morning',
      warehouses
    );
    assert.ok(locs.some((l) => l.city === 'Barrie' && l.number === '1258'));
  });

  test('Barrie city name', () => {
    const locs = extractOntarioLocations(
      'My Costco in Barrie still has the fragrance deal',
      warehouses
    );
    assert.ok(locs.some((l) => l.city === 'Barrie'));
  });

  test('ignores Buffalo / US warehouses', () => {
    const locs = extractOntarioLocations(
      'Costco Buffalo warehouse 1192 has the $99 cologne, also saw it in Rochester NY',
      warehouses
    );
    assert.equal(locs.length, 0);
  });

  test('London UK is not treated as Ontario without a cue', () => {
    const locs = extractOntarioLocations(
      'Costco London has a cologne set but I am in the UK',
      warehouses
    );
    assert.equal(locs.some((l) => l.city === 'London'), false);
  });

  test('London Ontario matches', () => {
    const locs = extractOntarioLocations(
      'Costco London Ontario still had the $99 cologne',
      warehouses
    );
    assert.ok(locs.some((l) => l.city === 'London'));
  });

  test('fingerprint is stable', () => {
    const a = extractOntarioLocations('Barrie Costco and Mississauga Heartland', warehouses);
    const b = extractOntarioLocations('Mississauga Heartland then Barrie Costco', warehouses);
    assert.equal(locationFingerprint(a), locationFingerprint(b));
  });
});
