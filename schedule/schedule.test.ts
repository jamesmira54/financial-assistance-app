process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret';

import { validationResult } from 'express-validator';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { validateSchedulePayload } from '../middleware/validation';
import { uuidToBinary } from '../utils';

const app = require('../app').default;
const { __mockPrisma } = require('@prisma/client');

const token = jwt.sign(
  { email: 'coord@example.com', userId: 'test-user-id' },
  process.env.SECRET_KEY as string,
  { expiresIn: '1h' },
);
const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

// Runs the real validateSchedulePayload chains against a body and reports whether a
// given field produced a validation error. Only the target field is under test; unrelated
// chains (sponsorshipId, batchNo, etc.) may fail with their own errors and are ignored.
// Mirrors the helper in sponsorship/allowancePerStudent.test.ts.
const fieldHasError = async (field: string, body: Record<string, unknown>) => {
  const req: any = { body, params: {}, query: {}, headers: {}, cookies: {} };
  for (const chain of validateSchedulePayload as any[]) {
    if (typeof chain.run === 'function') {
      await chain.run(req);
    }
  }
  return validationResult(req)
    .array()
    .some((e: any) => e.path === field);
};

describe('examinationType validation on schedule create', () => {
  it('rejects an omitted examinationType (required)', async () => {
    expect(await fieldHasError('examinationType', {})).toBe(true);
  });

  it('rejects an examinationType outside ONSITE/ONLINE', async () => {
    expect(await fieldHasError('examinationType', { examinationType: 'HYBRID' })).toBe(true);
  });

  it.each(['ONSITE', 'ONLINE'])('accepts a valid examinationType %s', async (value) => {
    expect(await fieldHasError('examinationType', { examinationType: value })).toBe(false);
  });
});

describe('batchCode validation on schedule create', () => {
  it('rejects an omitted batchCode (required)', async () => {
    expect(await fieldHasError('batchCode', {})).toBe(true);
  });

  it('accepts a non-empty string batchCode', async () => {
    expect(await fieldHasError('batchCode', { batchCode: 'BATCH-2026-A' })).toBe(false);
  });
});

describe('proctorInterviewer validation on schedule create', () => {
  it('rejects an omitted proctorInterviewer (required)', async () => {
    expect(await fieldHasError('proctorInterviewer', {})).toBe(true);
  });

  it('accepts a non-empty string proctorInterviewer', async () => {
    expect(await fieldHasError('proctorInterviewer', { proctorInterviewer: 'Prof. Reyes' })).toBe(false);
  });
});

describe('endDate validation on schedule create', () => {
  it('accepts a valid endDate that is after startDate', async () => {
    expect(await fieldHasError('endDate', {
      startDate: '2026-08-01T09:00:00.000Z',
      endDate: '2026-08-01T11:00:00.000Z',
    })).toBe(false);
  });

  it('rejects an endDate that is before startDate', async () => {
    expect(await fieldHasError('endDate', {
      startDate: '2026-08-01T11:00:00.000Z',
      endDate: '2026-08-01T09:00:00.000Z',
    })).toBe(true);
  });
});

describe('GET /api/v1/schedules/:scheduleId passes the URL id through to the service', () => {
  const SCHED_ID = '33333333-3333-3333-3333-333333333333';
  const SPONS_ID = '44444444-4444-4444-4444-444444444444';

  beforeEach(() => {
    jest.clearAllMocks();
    // validateScheduleId -> findIfExists -> findFirst: schedule exists
    __mockPrisma.schedule.findFirst.mockResolvedValue({ id: uuidToBinary(SCHED_ID) });
    // get -> findUnique: the selected schedule row
    __mockPrisma.schedule.findUnique.mockResolvedValue({
      id: uuidToBinary(SCHED_ID),
      sponsorship_id: uuidToBinary(SPONS_ID),
      batch_no: 1,
      schedule_type: 'TEST',
      location: 'Room 101',
      start_date: new Date('2026-08-01T09:00:00.000Z'),
      end_date: new Date('2026-08-01T11:00:00.000Z'),
      schedule_quota: 30,
      batch_code: 'BATCH-2026-A',
      examination_type: 'ONSITE',
      proctor_interviewer: 'Prof. Reyes',
      sponsorship: { name: 'Test Sponsorship' },
    });
  });

  it('returns 200 with the requested schedule (id flows correctly)', async () => {
    const res = await auth(request(app).get(`/api/v1/schedules/${SCHED_ID}`));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(SCHED_ID);
  });
});
