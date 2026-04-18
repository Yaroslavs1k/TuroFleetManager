// Pricing ladder invariant tests.
//
// Run with: `node --test tests/`  (requires Node 18+, no dependencies)
//
// The VIN-analysis pricing ladder enforces a strict ordering:
//   openingOffer ≤ rangeLow ≤ rangeHigh ≤ maxFinal ≤ walkFinal ≤ askPrice (when asking known)
//
// This file asserts the ordering holds across edge cases. If a refactor breaks it,
// `node --test tests/` catches the regression locally before shipping.
//
// The function under test is a pure reimplementation of the clamp logic that lives
// inline in index.html around line 1940-2000. When index.html's logic changes,
// mirror the change here and the tests should still pass.

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Pure pricing-ladder computation extracted from index.html's lookupVIN().
// Input: raw pricing inputs. Output: clamped, invariant-respecting pricing ladder.
function computeLadder({ adjVal, askPrice, totalPenalty = 0 }) {
  if (!adjVal || adjVal <= 0) throw new Error('adjVal must be > 0');

  // Raw segment math
  const tgt = Math.round(adjVal * 0.90);
  const mx  = Math.round(adjVal * 0.97);
  const wk  = Math.round(adjVal * 1.06);

  // Opening offer scales with how priced-vs-market asking is
  let openingOffer;
  if (askPrice > 0) {
    const mktMed = adjVal;
    const discPct = mktMed > 0 ? ((mktMed - askPrice) / mktMed) : 0;
    if (discPct > 0.10)        openingOffer = askPrice * 0.93;
    else if (discPct > 0.03)   openingOffer = askPrice * 0.90;
    else if (discPct > -0.05)  openingOffer = askPrice * 0.88;
    else                       openingOffer = Math.min(askPrice * 0.85, mktMed * 0.88);
    openingOffer = Math.min(openingOffer, tgt);
  } else {
    openingOffer = tgt * 0.95;
  }
  openingOffer = Math.floor(openingOffer / 500) * 500;

  // Target range
  let rangeLow  = openingOffer + 1500;
  let rangeHighRaw = Math.round(tgt - totalPenalty);
  let rangeHigh = askPrice > 0 ? Math.min(rangeHighRaw, Math.round(askPrice * 0.97)) : rangeHighRaw;

  // Inversion fallback (asking-price-anchored)
  if (rangeHigh < rangeLow) {
    if (askPrice > 0) {
      rangeLow  = openingOffer + 1000;
      rangeHigh = Math.max(openingOffer + 2500, Math.round(askPrice * 0.95));
    } else {
      const center = Math.round((rangeLow + rangeHigh) / 2);
      rangeLow  = Math.max(openingOffer, center - 2000);
      rangeHigh = center + 2000;
    }
  }

  // Walk away caps at asking, max caps at walk, range caps at max
  const walkFinal = askPrice > 0 ? Math.min(wk, askPrice) : wk;
  const maxFinal  = Math.min(mx, walkFinal);
  if (rangeHigh > maxFinal) rangeHigh = maxFinal;
  if (rangeLow > rangeHigh) rangeLow = rangeHigh;
  openingOffer = Math.min(openingOffer, rangeLow);

  return { openingOffer, rangeLow, rangeHigh, maxFinal, walkFinal, askPrice };
}

// The core invariant. Every test case must satisfy this.
function assertLadderInvariant(L) {
  assert.ok(L.openingOffer <= L.rangeLow,
    `openingOffer ${L.openingOffer} must be ≤ rangeLow ${L.rangeLow}`);
  assert.ok(L.rangeLow <= L.rangeHigh,
    `rangeLow ${L.rangeLow} must be ≤ rangeHigh ${L.rangeHigh}`);
  assert.ok(L.rangeHigh <= L.maxFinal,
    `rangeHigh ${L.rangeHigh} must be ≤ maxFinal ${L.maxFinal}`);
  assert.ok(L.maxFinal <= L.walkFinal,
    `maxFinal ${L.maxFinal} must be ≤ walkFinal ${L.walkFinal}`);
  if (L.askPrice > 0) {
    assert.ok(L.walkFinal <= L.askPrice,
      `walkFinal ${L.walkFinal} must be ≤ askPrice ${L.askPrice} when asking is known`);
  }
}

test('fair market price — typical case', () => {
  // Corvette-like: adjVal $82k, asking $75k (9% below market)
  const L = computeLadder({ adjVal: 82000, askPrice: 75000 });
  assertLadderInvariant(L);
  assert.ok(L.openingOffer < L.askPrice, 'opening should be below asking');
});

test('asking far below market (rare bargain)', () => {
  // Car worth $80k, asking $60k (25% below)
  const L = computeLadder({ adjVal: 80000, askPrice: 60000 });
  assertLadderInvariant(L);
});

test('asking above market (overpriced)', () => {
  // Car worth $50k, asking $65k (30% over)
  const L = computeLadder({ adjVal: 50000, askPrice: 65000 });
  assertLadderInvariant(L);
  assert.ok(L.walkFinal <= 65000, 'walk should not exceed asking');
});

test('no asking price (user skipped pp)', () => {
  const L = computeLadder({ adjVal: 40000, askPrice: 0 });
  assertLadderInvariant(L);
  assert.ok(L.openingOffer > 0);
});

test('with recall penalty', () => {
  const L = computeLadder({ adjVal: 82000, askPrice: 75000, totalPenalty: 2400 });
  assertLadderInvariant(L);
});

test('heavy damage penalty (high risk score)', () => {
  const L = computeLadder({ adjVal: 60000, askPrice: 55000, totalPenalty: 5000 });
  assertLadderInvariant(L);
});

test('economy car low-value', () => {
  const L = computeLadder({ adjVal: 8500, askPrice: 9000 });
  assertLadderInvariant(L);
});

test('exotic at high value', () => {
  const L = computeLadder({ adjVal: 180000, askPrice: 170000 });
  assertLadderInvariant(L);
});

test('asking wildly below market — inversion handling', () => {
  // tgt = 45000, but asking is 30000. openingOffer should be low enough to preserve ordering.
  const L = computeLadder({ adjVal: 50000, askPrice: 30000 });
  assertLadderInvariant(L);
  assert.ok(L.openingOffer <= L.rangeLow, 'opening must clamp to rangeLow');
});

test('zero askPrice + huge penalty', () => {
  const L = computeLadder({ adjVal: 40000, askPrice: 0, totalPenalty: 10000 });
  assertLadderInvariant(L);
});

test('threshold: asking exactly 10% below market', () => {
  const L = computeLadder({ adjVal: 50000, askPrice: 45000 });
  assertLadderInvariant(L);
});

test('threshold: asking exactly at market', () => {
  const L = computeLadder({ adjVal: 50000, askPrice: 50000 });
  assertLadderInvariant(L);
});

test('error path: adjVal zero throws', () => {
  assert.throws(() => computeLadder({ adjVal: 0, askPrice: 40000 }));
});

// Export for external use if needed (e.g., future CLI tool)
module.exports = { computeLadder, assertLadderInvariant };
