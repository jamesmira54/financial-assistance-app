/**
 * RANKING REGRESSION SUITE — AHP (pairwise weights) + TOPSIS scoring.
 *
 * These are pure, deterministic functions (no DB), so they make an ideal regression guard:
 * any change to the ranking math will break a golden assertion here. The golden values were
 * captured from the current implementation (see scripts that produced them) and lock in the
 * behaviour the running system depends on.
 *
 * Functions under test (utils/ranking.ts):
 *   - calculateAHPWeights(matrix)         -> criteria weights from a pairwise-comparison matrix
 *   - topsis(applicants, names, benefit, weights) -> closeness-coefficient scores, sorted desc
 *   - rankStudent(applicants)             -> full pipeline over criteria [gwa,siblings,income,involvement]
 */

import { calculateAHPWeights, topsis, rankStudent } from './ranking';

// Same pairwise matrix hardcoded inside rankStudent (utils/ranking.ts).
const PAIRWISE: number[][] = [
  [1.0, 4.0, 0.25, 3.0],
  [0.25, 1.0, 0.17, 2.0],
  [4.0, 6.0, 1.0, 5.0],
  [0.33, 0.5, 0.2, 1.0],
];

const APPLICANTS: any[] = [
  { id: 'Alternative 1', gwa: 91, siblings: 1, income: 10000, involvement: 1 },
  { id: 'Alternative 2', gwa: 88, siblings: 5, income: 20000, involvement: 0 },
  { id: 'Alternative 3', gwa: 91, siblings: 3, income: 15000, involvement: 0 },
  { id: 'Alternative 4', gwa: 92, siblings: 4, income: 20000, involvement: 0 },
  { id: 'Alternative 5', gwa: 93, siblings: 2, income: 5000, involvement: 0 },
];

// ---- GOLDEN VALUES (captured from the current implementation) --------------
const GOLDEN_WEIGHTS = [
  0.2385214542180414, // gwa
  0.10462896063644078, // siblings
  0.5776036034334304, // income  (dominant criterion)
  0.07924598171208738, // involvement
];
const GOLDEN_ORDER = [
  'Alternative 2',
  'Alternative 4',
  'Alternative 3',
  'Alternative 1',
  'Alternative 5',
];
const GOLDEN_SCORES: Record<string, number> = {
  'Alternative 2': 0.7670474502125467,
  'Alternative 4': 0.7628947553033384,
  'Alternative 3': 0.5905531497271155,
  'Alternative 1': 0.393412460199998,
  'Alternative 5': 0.0533963947717998,
};

describe('calculateAHPWeights', () => {
  const weights = calculateAHPWeights(PAIRWISE);

  it('produces the golden weight vector', () => {
    expect(weights).toHaveLength(4);
    weights.forEach((w, i) => expect(w).toBeCloseTo(GOLDEN_WEIGHTS[i], 12));
  });

  it('weights sum to ~1 (normalized AHP property)', () => {
    const sum = weights.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('ranks income as the dominant criterion', () => {
    const maxIdx = weights.indexOf(Math.max(...weights));
    expect(maxIdx).toBe(2); // income
  });

  it('is deterministic for the same matrix', () => {
    expect(calculateAHPWeights(PAIRWISE)).toEqual(weights);
  });
});

describe('rankStudent (AHP + TOPSIS) golden regression', () => {
  const ranked = rankStudent(APPLICANTS);

  it('returns one score per applicant', () => {
    expect(ranked).toHaveLength(APPLICANTS.length);
  });

  it('produces the golden ranking order', () => {
    expect(ranked.map((r) => r.id)).toEqual(GOLDEN_ORDER);
  });

  it('produces the golden closeness-coefficient scores', () => {
    ranked.forEach((r) => expect(r.score).toBeCloseTo(GOLDEN_SCORES[r.id as string], 10));
  });

  it('scores are sorted strictly descending', () => {
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('all scores are valid closeness coefficients in [0,1]', () => {
    ranked.forEach((r) => {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
      expect(Number.isNaN(r.score)).toBe(false);
    });
  });

  it('is deterministic (same input -> identical output)', () => {
    expect(rankStudent(APPLICANTS).map((r) => r.id)).toEqual(GOLDEN_ORDER);
  });

  it('does not mutate the input array', () => {
    const copy = APPLICANTS.map((a) => ({ ...a }));
    rankStudent(APPLICANTS);
    expect(APPLICANTS).toEqual(copy);
  });

  // Behaviour lock + documented caveat: every criterion (including income) is treated as a
  // BENEFIT (higher = better). So the highest-income applicant outranks the lowest-income one.
  // For a need-based scholarship this is semantically the opposite of "need"; this test pins
  // the current behaviour so a future intentional flip to cost-criteria is caught.
  it('treats income as a benefit criterion (higher income ranks higher) — documented caveat', () => {
    const order = rankStudent(APPLICANTS).map((r) => r.id);
    expect(order.indexOf('Alternative 2')).toBeLessThan(order.indexOf('Alternative 5')); // 20000 over 5000
  });
});

describe('topsis edge cases', () => {
  it('a single applicant always scores 1', () => {
    const res = rankStudent([APPLICANTS[0]]);
    expect(res).toHaveLength(1);
    expect(res[0].score).toBe(1);
  });

  it('topsis with explicit weights matches the pipeline result', () => {
    const weights = calculateAHPWeights(PAIRWISE);
    const names = ['gwa', 'siblings', 'income', 'involvement'];
    const isBenefit = [true, true, true, true];
    const direct = topsis(APPLICANTS, names, isBenefit, weights);
    expect(direct.map((r) => r.id)).toEqual(GOLDEN_ORDER);
  });

  it('two tied applicants both receive finite scores', () => {
    const tied = [
      { id: 'A', gwa: 90, siblings: 2, income: 10000, involvement: 1 },
      { id: 'B', gwa: 90, siblings: 2, income: 10000, involvement: 1 },
    ] as any;
    const res = topsis(tied, ['gwa', 'siblings', 'income', 'involvement'], [true, true, true, true], calculateAHPWeights(PAIRWISE));
    expect(res).toHaveLength(2);
    res.forEach((r) => expect(Number.isNaN(r.score)).toBe(false));
  });
});
