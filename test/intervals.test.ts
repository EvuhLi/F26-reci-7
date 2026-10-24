import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mergeIntervals, type Interval } from '../src/intervals';

// Recitation Part 2 (groups) and problem set Task 2.
// Read the spec in src/intervals/mergeIntervals.ts, then check your progress
// with `npm run mutants:intervals`.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The output is sorted.
// (invariant, algebraic, metamorphic, differential, or conditional)


const intervalIn = (min: number, max: number, maxLen: number): fc.Arbitrary<Interval> =>
  fc.tuple(fc.integer({ min, max }), fc.nat(maxLen)).map(([s, len]) => [s, s + len]);
const interval = fc.oneof(
  
  { weight: 1, arbitrary: intervalIn(-1_000_000, 1_000_000, 1_000_000) },
);
const intervalList = fc.array(interval, { maxLength: 12 });

// Already sorted, non-overlapping, non-touching intervals, built from a start
// point and alternating (gap >= 1, length >= 0) steps.
const disjointSorted = fc
  .tuple(
    fc.integer({ min: -50, max: 50 }),
    fc.array(fc.tuple(fc.integer({ min: 1, max: 4 }), fc.nat(4)), { maxLength: 8 }),
  )
  .map(([start, steps]) => {
    const out: Interval[] = [];
    let pos = start;
    for (const [gap, len] of steps) {
      out.push([pos, pos + len]);
      pos += len + gap;
    }
    return out;
  });

const shuffled = <T>(xs: T[]) =>
  fc.shuffledSubarray(xs, { minLength: xs.length, maxLength: xs.length });

const covers = (xs: readonly Interval[], p: number) => xs.some(([s, e]) => s <= p && p <= e);

// Every integer and half-integer from just below the smallest endpoint to just
// above the largest. Between consecutive integers coverage is all or nothing,
// so these points decide coverage of the whole line.
const probePoints = (xs: readonly Interval[]) => {
  if (xs.length === 0) return [0];
  const ends = xs.flat();
  const lo = Math.min(...ends) - 1;
  const hi = Math.max(...ends) + 1;
  const pts = new Set<number>();
  for (const [s, e] of xs) for (const x of [s, e]) for (const d of [-0.5, 0, 0.5]) pts.add(x + d);
  if (hi - lo <= 200) for (let x = lo; x <= hi; x += 0.5) pts.add(x);
  pts.add(lo);
  pts.add(hi);
  return [...pts];
};

describe('mergeIntervals', () => {
  // Pattern: invariant. Every input interval lies inside some output interval.
  it('every input interval lies inside some output interval', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        const uncovered = xs.filter(([s, e]) => !out.some(([a, b]) => a <= s && e <= b));
        expect(uncovered).toEqual([]);
      }),
    );
  });

  // Pattern: invariant. The output is sorted by start, each interval is valid, and consecutive intervals neither overlap nor touch.
  it('returns sorted, valid, disjoint, non-touching intervals', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (const [s, e] of out) {
          expect(Number.isInteger(s) && Number.isInteger(e)).toBe(true);
          expect(s).toBeLessThanOrEqual(e);
        }
        for (let i = 0; i + 1 < out.length; i++) expect(out[i][1]).toBeLessThan(out[i + 1][0]);
      }),
    );
  });

  // Pattern: differential. For every point (including non-integers), "is it covered?" agrees between input and output.
  it('covers exactly the same points as the input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (const p of probePoints([...xs, ...out])) expect([p, covers(out, p)]).toEqual([p, covers(xs, p)]);
      }),
    );
  });

  // Pattern: algebraic. Merging is idempotent: merging an already merged list gives it back unchanged.
  it('merging twice is the same as merging once', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const once = mergeIntervals(xs);
        expect(mergeIntervals(once)).toEqual(once);
      }),
    );
  });

  // Pattern: algebraic. Merging a concatenation is the same as merging the merged halves: merge(a ++ b) = merge(merge(a) ++ merge(b)).
  it('merging can be done piecewise', () => {
    fc.assert(
      fc.property(intervalList, intervalList, (a, b) => {
        expect(mergeIntervals([...mergeIntervals(a), ...mergeIntervals(b)])).toEqual(
          mergeIntervals([...a, ...b]),
        );
      }),
    );
  });

  // Pattern: metamorphic. Reordering the input or duplicating some of its intervals does not change the output.
  it('ignores input order and duplicates', () => {
    const variant = intervalList.chain(xs =>
      fc.tuple(
        fc.constant(xs),
        fc.subarray(xs).chain(dups => shuffled([...xs, ...dups])),
      ),
    );
    fc.assert(
      fc.property(variant, ([xs, ys]) => {
        expect(mergeIntervals(ys)).toEqual(mergeIntervals(xs));
      }),
    );
  });

  // Pattern: metamorphic. Shifting every input interval by k shifts every output interval by k.
  it('commutes with shifting along the number line', () => {
    fc.assert(
      fc.property(intervalList, fc.integer({ min: -1000, max: 1000 }), (xs, k) => {
        const shift = (ys: Interval[]) => ys.map(([s, e]): Interval => [s + k, e + k]);
        expect(mergeIntervals(shift(xs))).toEqual(shift(mergeIntervals(xs)));
      }),
    );
  });

  // Pattern: conditional. If the input intervals already neither overlap nor touch, the output is the same intervals, sorted.
  // Targeted generator: disjointSorted builds such lists directly, then they are shuffled.
  it('leaves already-disjoint intervals alone apart from sorting', () => {
    fc.assert(
      fc.property(disjointSorted.chain(xs => fc.tuple(fc.constant(xs), shuffled(xs))), ([sorted, xs]) => {
        expect(mergeIntervals(xs)).toEqual(sorted);
      }),
    );
  });

  // Pattern: invariant. The input array and the intervals in it are not modified.
  it('does not modify its input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const copy = xs.map(([s, e]): Interval => [s, e]);
        const out = mergeIntervals(xs);
        expect(xs).toEqual(copy);
        // Mutating the output must not reach back into the input either.
        for (const iv of out) iv[1] += 1000;
        expect(xs).toEqual(copy);
      }),
    );
  });

  // Pattern: conditional. If some interval has start > end or a non-integer endpoint, a RangeError is thrown.
  it('rejects invalid intervals', () => {
    const badInterval = fc.oneof(
      fc.tuple(fc.integer({ min: -100, max: 100 }), fc.integer({ min: 1, max: 100 })).map(
        ([s, d]): Interval => [s, s - d],
      ),
      fc.integer({ min: -100, max: 100 }).map((s): Interval => [s + 0.5, s + 200]),
      fc.integer({ min: -100, max: 100 }).map((s): Interval => [s, s + 0.5]),
      fc.constantFrom<Interval>([0, Number.NaN], [Number.NaN, 0], [0, Infinity], [-Infinity, 0]),
    );
    const withBad = fc
      .tuple(intervalList, badInterval, intervalList)
      .map(([a, bad, b]) => [...a, bad, ...b]);
    fc.assert(
      fc.property(withBad, xs => {
        expect(() => mergeIntervals(xs)).toThrow(RangeError);
      }),
    );
  });

  it('handles the spec examples', () => {
    expect(mergeIntervals([])).toEqual([]);
    expect(mergeIntervals([[3, 5], [1, 3]])).toEqual([[1, 5]]);
    expect(mergeIntervals([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]]);
  });
});
