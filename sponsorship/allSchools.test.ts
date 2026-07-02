import { validationResult } from 'express-validator';
import { validateSponsorship } from '../middleware/validation';
import { getAllAvailableSponsorship } from './service';
import { uuidToBinary } from '../utils';

const { __mockPrisma } = require('@prisma/client');

const STUDENT_ID = '11111111-1111-1111-1111-111111111111';
const SCHOOL_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  jest.clearAllMocks();
  __mockPrisma.sponsorship.findMany.mockResolvedValue([]);
});

// Runs the real validateSponsorship chains against a body and reports whether the
// `sponsorshipSchool` field produced a validation error. Only that field is under
// test; unrelated chains (name, sponsorId, academicYear) may fail with their own
// errors and are ignored.
const sponsorshipSchoolHasError = async (body: Record<string, unknown>) => {
  const req: any = { body, params: {}, query: {}, headers: {}, cookies: {} };
  for (const chain of validateSponsorship as any[]) {
    if (typeof chain.run === 'function') {
      await chain.run(req);
    }
  }
  return validationResult(req)
    .array()
    .some((e: any) => e.path === 'sponsorshipSchool');
};

describe('sponsorshipSchool validation: empty/omitted means "all schools"', () => {
  it('accepts an empty array (all schools)', async () => {
    expect(await sponsorshipSchoolHasError({ sponsorshipSchool: [] })).toBe(false);
  });

  it('accepts an omitted field (all schools)', async () => {
    expect(await sponsorshipSchoolHasError({})).toBe(false);
  });

  it('still rejects a non-empty list containing an invalid (empty-string) id', async () => {
    expect(await sponsorshipSchoolHasError({ sponsorshipSchool: [''] })).toBe(true);
  });

  it('rejects a non-array value', async () => {
    expect(await sponsorshipSchoolHasError({ sponsorshipSchool: 'not-an-array' })).toBe(true);
  });
});

describe('getAllAvailableSponsorship: all-schools visibility', () => {
  const whereOf = () => __mockPrisma.sponsorship.findMany.mock.calls[0][0].where;

  it('shows all-schools sponsorships to a student with NO college school', async () => {
    __mockPrisma.student.findFirst.mockResolvedValue({ college_school_id: null });

    await getAllAvailableSponsorship(STUDENT_ID, {} as any);

    const where = whereOf();
    expect(where.OR).toContainEqual({ schools: { none: {} } });
    // no school => only the all-schools branch
    expect(where.OR).toHaveLength(1);
  });

  it('shows all-schools PLUS the student\'s own school when a school is set', async () => {
    __mockPrisma.student.findFirst.mockResolvedValue({ college_school_id: uuidToBinary(SCHOOL_ID) });

    await getAllAvailableSponsorship(STUDENT_ID, {} as any);

    const where = whereOf();
    expect(where.OR).toContainEqual({ schools: { none: {} } });
    expect(where.OR).toHaveLength(2);
    const matchBranch = where.OR.find((c: any) => c.schools?.some);
    expect(matchBranch.schools.some.school_id.equals).toEqual(uuidToBinary(SCHOOL_ID));
  });
});
