import { validationResult } from 'express-validator';
import { validateChangeStudentStatus } from '../middleware/validation';

// Runs the real validateChangeStudentStatus chain against a request body and
// reports whether the `remarks` field produced a validation error. Only the
// remarks rule is under test, so unrelated chains (sponsorshipId, appStage —
// which hit the DB) are allowed to fail with their own, different errors.
const remarksHasError = async (body: Record<string, unknown>) => {
  const req: any = { body, params: { studentId: 'any' }, query: {}, headers: {}, cookies: {} };
  for (const chain of validateChangeStudentStatus as any[]) {
    if (typeof chain.run === 'function') {
      await chain.run(req);
    }
  }
  return validationResult(req)
    .array()
    .some((e: any) => e.path === 'remarks');
};

describe('change-student-status: remarks requirement by status', () => {
  it.each(['REJECTED', 'FOLLOW_UP', 'NOT_QUALIFIED'])(
    'requires remarks when status is %s',
    async (appStatus) => {
      expect(await remarksHasError({ appStatus, remarks: '' })).toBe(true);
    },
  );

  it.each(['COMPLETE', 'APPROVED', 'RANKED', 'AWARDED', 'PENDING_POOLING'])(
    'does NOT require remarks when status is %s',
    async (appStatus) => {
      expect(await remarksHasError({ appStatus, remarks: '' })).toBe(false);
    },
  );

  it('still accepts remarks when provided for a rejected status', async () => {
    expect(await remarksHasError({ appStatus: 'REJECTED', remarks: 'Incomplete requirements' })).toBe(false);
  });
});
