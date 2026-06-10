import {
  asFiniteNumber,
  extractCumulativeFromStatResult,
  extractQuantityFromStatEntry,
  normaliseDistanceQuantity,
  parseSumQuantityFromStatistics,
} from '@/utils/healthkit-stats';

describe('asFiniteNumber', () => {
  it('accepts finite numbers and numeric strings, rejects everything else', () => {
    expect(asFiniteNumber(42)).toBe(42);
    expect(asFiniteNumber(0)).toBe(0);
    expect(asFiniteNumber('3.5')).toBe(3.5);
    expect(asFiniteNumber('')).toBeNull();
    expect(asFiniteNumber('abc')).toBeNull();
    expect(asFiniteNumber(NaN)).toBeNull();
    expect(asFiniteNumber(Infinity)).toBeNull();
    expect(asFiniteNumber(null)).toBeNull();
    expect(asFiniteNumber(undefined)).toBeNull();
    expect(asFiniteNumber({})).toBeNull();
  });
});

describe('extractQuantityFromStatEntry', () => {
  it('reads a direct positive number', () => {
    expect(extractQuantityFromStatEntry(1200)).toEqual({ qty: 1200, unit: '' });
  });

  it('reads a HKQuantity object and lowercases the unit', () => {
    expect(extractQuantityFromStatEntry({ quantity: 5.2, unit: 'KM' })).toEqual({ qty: 5.2, unit: 'km' });
    expect(extractQuantityFromStatEntry({ value: 800 })).toEqual({ qty: 800, unit: '' });
    expect(extractQuantityFromStatEntry({ count: 30 })).toEqual({ qty: 30, unit: '' });
  });

  it('treats zero / negative / missing as "no value" (the lifetime-total guard)', () => {
    expect(extractQuantityFromStatEntry(0)).toBeNull();
    expect(extractQuantityFromStatEntry(-5)).toBeNull();
    expect(extractQuantityFromStatEntry({ quantity: 0, unit: 'count' })).toBeNull();
    expect(extractQuantityFromStatEntry(null)).toBeNull();
    expect(extractQuantityFromStatEntry(undefined)).toBeNull();
  });
});

describe('extractCumulativeFromStatResult', () => {
  it('prefers sumQuantity (the react-native-healthkit v14 shape)', () => {
    const result = {
      sumQuantity: { quantity: 8421, unit: 'count' },
      cumulativeSum: { quantity: 11_000_000, unit: 'count' }, // bogus lifetime — must NOT win
    };
    expect(extractCumulativeFromStatResult(result)).toBe(8421);
  });

  it('falls back through cumulativeSum / value / sum in order', () => {
    expect(extractCumulativeFromStatResult({ cumulativeSum: { quantity: 500 } })).toBe(500);
    expect(extractCumulativeFromStatResult({ value: 300 })).toBe(300);
    expect(extractCumulativeFromStatResult({ sum: 200 })).toBe(200);
  });

  it('rounds the result', () => {
    expect(extractCumulativeFromStatResult({ sumQuantity: { quantity: 1234.6 } })).toBe(1235);
  });

  it('returns 0 for empty/garbage so a genuine no-steps day stays 0', () => {
    expect(extractCumulativeFromStatResult(null)).toBe(0);
    expect(extractCumulativeFromStatResult({})).toBe(0);
    expect(extractCumulativeFromStatResult({ sumQuantity: { quantity: 0 } })).toBe(0);
    expect(extractCumulativeFromStatResult('nope')).toBe(0);
  });
});

describe('normaliseDistanceQuantity', () => {
  it('converts meters to km (2-dp)', () => {
    expect(normaliseDistanceQuantity(5234, 'm')).toEqual({ value: 5.23, unit: 'km' });
    expect(normaliseDistanceQuantity(5234, 'meters')).toEqual({ value: 5.23, unit: 'km' });
  });

  it('keeps miles and km as-is (rounded)', () => {
    expect(normaliseDistanceQuantity(3.14159, 'mi')).toEqual({ value: 3.14, unit: 'mi' });
    expect(normaliseDistanceQuantity(10.005, 'km')).toEqual({ value: 10.01, unit: 'km' });
  });

  it('converts imperial units to miles', () => {
    expect(normaliseDistanceQuantity(5280, 'ft')).toEqual({ value: 1, unit: 'mi' });
    expect(normaliseDistanceQuantity(1760, 'yd')).toEqual({ value: 1, unit: 'mi' });
    expect(normaliseDistanceQuantity(63360, 'in')).toEqual({ value: 1, unit: 'mi' });
  });

  it('always assumes meters when the unit is omitted (HK SI default)', () => {
    expect(normaliseDistanceQuantity(3000, '')).toEqual({ value: 3, unit: 'km' });
    // Small unitless values are meters too — a 50 m sample must become
    // 0.05 km, NOT 50 km (magnitude guessing caused exactly that bug).
    expect(normaliseDistanceQuantity(50, '')).toEqual({ value: 0.05, unit: 'km' });
    expect(normaliseDistanceQuantity(5, '')).toEqual({ value: 0.01, unit: 'km' });
  });

  it('treats unrecognised units as "no value" instead of mislabeling them as km', () => {
    expect(normaliseDistanceQuantity(42, 'furlongs')).toEqual({ value: 0, unit: 'km' });
    expect(normaliseDistanceQuantity(180, 'cm')).toEqual({ value: 0, unit: 'km' });
  });
});

describe('parseSumQuantityFromStatistics', () => {
  it('prefers sumQuantity, then falls back, then the raw result', () => {
    expect(parseSumQuantityFromStatistics({ sumQuantity: { quantity: 5, unit: 'km' } })).toEqual({ qty: 5, unit: 'km' });
    expect(parseSumQuantityFromStatistics({ cumulativeSum: { quantity: 4, unit: 'mi' } })).toEqual({ qty: 4, unit: 'mi' });
    // Final fallback: an object with a bare quantity/value/count and no stat keys.
    expect(parseSumQuantityFromStatistics({ quantity: 9, unit: 'km' })).toEqual({ qty: 9, unit: 'km' });
    expect(parseSumQuantityFromStatistics({})).toBeNull();
    expect(parseSumQuantityFromStatistics(7)).toBeNull(); // primitives are rejected
    expect(parseSumQuantityFromStatistics(null)).toBeNull();
  });
});
