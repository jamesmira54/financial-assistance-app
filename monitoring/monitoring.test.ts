// Ensure a deterministic JWT secret BEFORE the app is required (require, not
// import, so this runs before app.ts calls dotenv.config()).
process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { binaryToUuid } from '../utils';
const app = require('../app').default;

// Shared Prisma mock instance (see __mocks__/@prisma/client.js).
const { __mockPrisma } = require('@prisma/client');

const token = jwt.sign(
  { email: 'coordinator@example.com', userId: 'test-user-id' },
  process.env.SECRET_KEY as string,
  { expiresIn: '1h' },
);
const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

// A 16-byte binary id, as Prisma returns for Binary(16) columns.
const bin = (n: number) => Buffer.alloc(16, n);

// One grantee row as returned by sponsorshipApplication.findMany with the
// student + sponsorship (and their nested relations) included.
const granteeRecord = () => ({
  id: bin(1),
  award_number: 'AWD-001-0001',
  application_status: 'AWARDED',
  student: {
    id: bin(2),
    first_name: 'Juan',
    middle_name: 'Santos',
    last_name: 'Dela Cruz',
    extension_name: null,
    sex: 'Male',
    college_year_level: 3,
    college_program_name: 'BS Computer Science',
    gwa: 1.75,
    college_school: { name: 'ABC University' },
  },
  sponsorship: {
    name: 'TDP Scholarship',
    batch_number: 1,
    academicYear: { school_term: 1 },
  },
});

const asRole = (role: string) =>
  __mockPrisma.user.findUnique.mockResolvedValue({ role: { name: role } });

beforeEach(() => {
  jest.clearAllMocks();
  asRole('System Admin');
  __mockPrisma.sponsorshipApplication.findMany.mockResolvedValue([]);
  __mockPrisma.sponsorshipApplication.count.mockResolvedValue(0);
});

describe('GET /api/v1/monitoring/grantees', () => {
  it('returns awarded grantees mapped to the monitoring row shape', async () => {
    __mockPrisma.sponsorshipApplication.findMany.mockResolvedValue([granteeRecord()]);
    __mockPrisma.sponsorshipApplication.count.mockResolvedValue(1);

    const res = await auth(request(app).get('/api/v1/monitoring/grantees'));

    expect(res.status).toBe(200);
    expect(res.body.data.totalCount).toBe(1);
    const row = res.body.data.grantees[0];
    expect(row).toMatchObject({
      seq: 1,
      awardNumber: 'AWD-001-0001',
      grantName: 'TDP Scholarship',
      batch: 1,
      semester: 1,
      completeName: 'Dela Cruz, Juan Santos',
      gender: 'Male',
      yearLevel: 3,
      course: 'BS Computer Science',
      school: 'ABC University',
      gwa: 1.75,
      status: 'ACTIVE',
    });
  });

  const whereArg = () =>
    __mockPrisma.sponsorshipApplication.findMany.mock.calls[0][0].where;

  it('defaults to the full grantee base set when no type is given', async () => {
    await auth(request(app).get('/api/v1/monitoring/grantees'));

    expect(whereArg().application_status).toEqual({
      in: ['AWARDED', 'DELISTED', 'GRADUATED'],
    });
  });

  it.each([
    ['active', 'AWARDED'],
    ['delisted', 'DELISTED'],
    ['graduated', 'GRADUATED'],
  ])('narrows to a single stored status when type=%s', async (type, status) => {
    await auth(request(app).get('/api/v1/monitoring/grantees').query({ type }));

    expect(whereArg().application_status).toBe(status);
  });

  it('filters by scholarship name when search is provided', async () => {
    await auth(
      request(app).get('/api/v1/monitoring/grantees').query({ search: 'TDP' }),
    );

    expect(whereArg().sponsorship.name).toEqual({ contains: 'TDP' });
  });

  it('filters by academic year when academic_year_id is provided', async () => {
    const yearId = '11111111-1111-1111-1111-111111111111';
    await auth(
      request(app)
        .get('/api/v1/monitoring/grantees')
        .query({ academic_year_id: yearId }),
    );

    expect(binaryToUuid(whereArg().sponsorship.academic_year_id)).toBe(yearId);
  });
});

describe('GET /api/v1/monitoring/grantees - role scoping', () => {
  const sponsorId = '22222222-2222-2222-2222-222222222222';
  const sponsorToken = jwt.sign(
    { email: 'sponsor@example.com', userId: sponsorId },
    process.env.SECRET_KEY as string,
    { expiresIn: '1h' },
  );

  const whereArg = () =>
    __mockPrisma.sponsorshipApplication.findMany.mock.calls[0][0].where;

  it('scopes a sponsor to grantees under their own sponsorships', async () => {
    asRole('Sponsor');

    await request(app)
      .get('/api/v1/monitoring/grantees')
      .set('Authorization', `Bearer ${sponsorToken}`);

    expect(binaryToUuid(whereArg().sponsorship.sponsor_id)).toBe(sponsorId);
  });

  it('does NOT scope an admin/coordinator by sponsor', async () => {
    asRole('Financial Assistance Coordinator');

    await auth(request(app).get('/api/v1/monitoring/grantees'));

    expect(whereArg().sponsorship?.sponsor_id).toBeUndefined();
  });

  it('forbids a student from the monitoring list', async () => {
    asRole('Student');

    const res = await auth(request(app).get('/api/v1/monitoring/grantees'));

    expect(res.status).toBe(400);
    expect(__mockPrisma.sponsorshipApplication.findMany).not.toHaveBeenCalled();
  });
});

describe('PUT /api/v1/monitoring/grantees/:id/status', () => {
  const appId = '33333333-3333-3333-3333-333333333333';
  const url = `/api/v1/monitoring/grantees/${appId}/status`;

  beforeEach(() => {
    __mockPrisma.sponsorshipApplication.findFirst.mockResolvedValue({
      id: bin(1),
      application_status: 'AWARDED',
    });
    __mockPrisma.sponsorshipApplication.update.mockResolvedValue({ id: bin(1) });
  });

  const updateData = () =>
    __mockPrisma.sponsorshipApplication.update.mock.calls[0][0].data;

  it('graduates an active grantee', async () => {
    const res = await auth(request(app).put(url)).send({ status: 'GRADUATED' });

    expect(res.status).toBe(200);
    expect(updateData().application_status).toBe('GRADUATED');
  });

  it('delists an active grantee when remarks are provided', async () => {
    const res = await auth(request(app).put(url)).send({
      status: 'DELISTED',
      remarks: 'Dropped below required GWA',
    });

    expect(res.status).toBe(200);
    expect(updateData().application_status).toBe('DELISTED');
    expect(updateData().remarks).toBe('Dropped below required GWA');
  });

  it('rejects delisting without remarks', async () => {
    const res = await auth(request(app).put(url)).send({ status: 'DELISTED' });

    expect(res.status).toBe(400);
    expect(__mockPrisma.sponsorshipApplication.update).not.toHaveBeenCalled();
  });

  it('rejects a target status that is not DELISTED or GRADUATED', async () => {
    const res = await auth(request(app).put(url)).send({ status: 'ACTIVE' });

    expect(res.status).toBe(400);
    expect(__mockPrisma.sponsorshipApplication.update).not.toHaveBeenCalled();
  });

  it('rejects transitioning a grantee that is not currently active', async () => {
    __mockPrisma.sponsorshipApplication.findFirst.mockResolvedValue({
      id: bin(1),
      application_status: 'GRADUATED',
    });

    const res = await auth(request(app).put(url)).send({ status: 'DELISTED', remarks: 'x' });

    expect(res.status).toBe(400);
    expect(__mockPrisma.sponsorshipApplication.update).not.toHaveBeenCalled();
  });

  it('returns not-found when the grantee application does not exist', async () => {
    __mockPrisma.sponsorshipApplication.findFirst.mockResolvedValue(null);

    const res = await auth(request(app).put(url)).send({ status: 'GRADUATED' });

    expect(res.status).toBe(400);
    expect(__mockPrisma.sponsorshipApplication.update).not.toHaveBeenCalled();
  });
});
