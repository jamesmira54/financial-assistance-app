import { validationResult } from 'express-validator';
import { validateSponsorship } from '../middleware/validation';

// Runs the real validateSponsorship chains against a body and reports whether the
// `allowancePerStudent` field produced a validation error. Only that field is under
// test; unrelated chains (name, sponsorId, academicYear, fundAllocation) may fail with
// their own errors and are ignored. Mirrors the helper in allSchools.test.ts.
const allowancePerStudentHasError = async (body: Record<string, unknown>) => {
  const req: any = { body, params: {}, query: {}, headers: {}, cookies: {} };
  for (const chain of validateSponsorship as any[]) {
    if (typeof chain.run === 'function') {
      await chain.run(req);
    }
  }
  return validationResult(req)
    .array()
    .some((e: any) => e.path === 'allowancePerStudent');
};

describe('allowancePerStudent validation on sponsorship create', () => {
  it('rejects a zero allowance (must be greater than 0)', async () => {
    expect(await allowancePerStudentHasError({ allowancePerStudent: 0 })).toBe(true);
  });

  it('accepts a valid positive allowance', async () => {
    expect(await allowancePerStudentHasError({ allowancePerStudent: 1500 })).toBe(false);
  });

  it('rejects an omitted allowance (required)', async () => {
    expect(await allowancePerStudentHasError({})).toBe(true);
  });
});
