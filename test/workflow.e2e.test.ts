/**
 * FULL-SYSTEM END-TO-END TEST — Sponsorship application workflow.
 *
 * Unlike the other *.test.ts files (which mock Prisma via __mocks__/@prisma/client.js),
 * this suite runs against the REAL local MySQL database configured in .env (faa-db).
 * `jest.unmock` below restores the real PrismaClient so both the Express app and this
 * test open genuine DB connections. Nothing is mocked — this is a true E2E.
 *
 * It drives one applicant through the entire workflow, exercising multiple modules and
 * two actors (coordinator + student):
 *
 *   1. Coordinator creates a Sponsorship            POST /sponsorships/coordinator
 *   2. A Student self-registers (user + student)    POST /auth/student/register
 *   3. Student applies to the sponsorship           POST /sponsorships/student
 *      -> application starts at POOLING / PENDING_POOLING
 *   4. Coordinator advances POOLING -> APPLICATION_LIST      (COMPLETE)
 *   5. Coordinator advances APPLICATION_LIST -> RANKING_SELECTION (APPROVED)
 *   6. Coordinator advances RANKING_SELECTION -> FINAS_PROPER      (RANKED -> AWARDED)
 *      -> an award number is assigned
 *   7. Coordinator attempts AHP/TOPSIS ranking       GET /sponsorships/rank-student/:id
 *      (soft: passes whether or not pairwise criteria are configured)
 *
 * DATA LIFECYCLE: per the chosen setup, the test LEAVES ITS DATA BEHIND so you can
 * inspect the created sponsorship / student / application rows in faa-db afterwards.
 * Every run uses a unique, timestamped name/email/batch so re-runs never collide.
 *
 * RUN:  npx jest test/workflow.e2e.test.ts --runInBand --forceExit
 *       (--forceExit because the app's per-module PrismaClients are never torn down.)
 */

// Restore the real @prisma/client (the repo ships an auto-applied manual mock).
// ts-jest hoists this above the imports below, so the app loads the real client.
jest.unmock('@prisma/client');

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// require (not import) so app.ts's dotenv.config() has populated process.env
// (SECRET_KEY, DATABASE_URL) before we read it. Prisma also auto-loads .env.
const app = require('../app').default;
import {
  binaryToUuid,
  APPLICATION_STAGE,
  APPLICATION_STATUS,
} from '../utils';

const prisma = new PrismaClient();
const SECRET_KEY = process.env.SECRET_KEY as string;

const STAMP = Date.now();

// Minted after we resolve the real user IDs from the DB in beforeAll.
let coordinatorToken: string;
let studentToken: string;

// Shared state threaded through the ordered steps below.
const ctx: {
  coordinatorUserId?: string;
  sponsorUserId?: string;
  academicYearId?: string;
  fileTypeIds?: string[];
  sponsorshipId?: string;
  studentUserId?: string;
  studentId?: string;
} = {};

const signToken = (email: string, userId: string) =>
  jwt.sign({ email, userId }, SECRET_KEY, { expiresIn: '1h' });

const bearer = (r: request.Test, token: string) =>
  r.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  if (!SECRET_KEY) {
    throw new Error('SECRET_KEY not loaded from .env — cannot mint JWTs.');
  }

  // Coordinator = the seeded System Admin (allowRoles lowercases the role name,
  // so "System Admin" satisfies allowRoles('system admin', ...)).
  const coordinator = await prisma.user.findFirst({
    where: { email: 'admin@gmail.com' },
  });
  const sponsor = await prisma.user.findFirst({
    where: { email: 'sponsor1@gmail.com' },
  });
  const academicYear = await prisma.academicYear.findFirst();
  const fileTypes = await prisma.fileType.findMany({ take: 2 });

  if (!coordinator) throw new Error('Seed user admin@gmail.com not found in faa-db.');
  if (!sponsor) throw new Error('Seed user sponsor1@gmail.com (Sponsor) not found.');
  if (!academicYear) throw new Error('No academicYear rows — run npm run prisma-seed.');
  if (!fileTypes.length) throw new Error('No fileType rows — run the seeders.');

  ctx.coordinatorUserId = binaryToUuid(coordinator.id);
  ctx.sponsorUserId = binaryToUuid(sponsor.id);
  ctx.academicYearId = binaryToUuid(academicYear.id);
  ctx.fileTypeIds = fileTypes.map((f) => binaryToUuid(f.id));

  coordinatorToken = signToken(coordinator.email, ctx.coordinatorUserId);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('E2E: full sponsorship application workflow (real faa-db)', () => {
  it('1) coordinator creates a sponsorship', async () => {
    const from = new Date();
    const to = new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000);

    const res = await bearer(
      request(app).post('/api/v1/sponsorships/coordinator'),
      coordinatorToken,
    ).send({
      name: `E2E Sponsorship ${STAMP}`,
      sponsorId: ctx.sponsorUserId,
      academicYearId: ctx.academicYearId,
      durationFrom: from.toISOString(),
      durationTo: to.toISOString(),
      batchNumber: STAMP % 100000,
      limit: 50,
      slot: 50,
      fundAllocation: 1_000_000,
      allowancePerStudent: 20_000,
      sponsorshipSchool: [], // empty = applies to all schools
      sponsorshipRequirements: ctx.fileTypeIds, // ≥1 required
    });

    expect(res.status).toBe(201);
    expect(res.body.data?.id).toBeDefined();
    ctx.sponsorshipId = res.body.data.id;

    // eslint-disable-next-line no-console
    console.log('  [E2E] sponsorshipId =', ctx.sponsorshipId);
  });

  it('2) a student self-registers (creates user + student record)', async () => {
    const email = `e2e.student.${STAMP}@example.com`;
    const username = `e2e_student_${STAMP}`;

    const res = await request(app).post('/api/v1/auth/student/register').send({
      username,
      email,
      password: 'secret123',
      repassword: 'secret123',
      firstName: 'Juan',
      lastName: `E2E-${STAMP}`,
      mobileNumber: '09171234567',
    });

    expect(res.status).toBe(201);

    // Resolve the real IDs the app created, straight from the DB.
    const user = await prisma.user.findFirst({ where: { email } });
    expect(user).not.toBeNull();
    ctx.studentUserId = binaryToUuid(user!.id);

    const student = await prisma.student.findFirst({ where: { user_id: user!.id } });
    expect(student).not.toBeNull();
    ctx.studentId = binaryToUuid(student!.id);

    studentToken = signToken(email, ctx.studentUserId);

    // eslint-disable-next-line no-console
    console.log('  [E2E] studentId =', ctx.studentId, ' userId =', ctx.studentUserId);
  });

  it('3) student applies to the sponsorship (starts at POOLING/PENDING_POOLING)', async () => {
    const res = await bearer(
      request(app).post('/api/v1/sponsorships/student'),
      studentToken,
    ).send({
      studentId: ctx.studentId,
      sponsorshipId: ctx.sponsorshipId,
    });

    expect(res.status).toBe(200);

    const appRow = await prisma.sponsorshipApplication.findFirst({
      where: {
        student_id: (await import('../utils')).uuidToBinary(ctx.studentId!),
      },
    });
    expect(appRow).not.toBeNull();
    expect(appRow!.application_stage).toBe(APPLICATION_STAGE.POOLING);
    expect(appRow!.application_status).toBe(APPLICATION_STATUS.PENDING_POOLING);
  });

  it('4) coordinator advances POOLING -> APPLICATION_LIST (COMPLETE)', async () => {
    const res = await bearer(
      request(app).put(
        `/api/v1/sponsorships/coordinator/students/${ctx.studentId}/status`,
      ),
      coordinatorToken,
    ).send({
      sponsorshipId: ctx.sponsorshipId,
      appStage: APPLICATION_STAGE.POOLING,
      appStatus: APPLICATION_STATUS.COMPLETE,
    });

    expect(res.status).toBe(200);
    await expectStage(
      APPLICATION_STAGE.APPLICATION_LIST,
      APPLICATION_STATUS.PENDING_APPLICATION_LIST,
    );
  });

  it('5) coordinator advances APPLICATION_LIST -> RANKING_SELECTION (APPROVED)', async () => {
    const res = await bearer(
      request(app).put(
        `/api/v1/sponsorships/coordinator/students/${ctx.studentId}/status`,
      ),
      coordinatorToken,
    ).send({
      sponsorshipId: ctx.sponsorshipId,
      appStage: APPLICATION_STAGE.APPLICATION_LIST,
      appStatus: APPLICATION_STATUS.APPROVED,
    });

    expect(res.status).toBe(200);
    await expectStage(
      APPLICATION_STAGE.RANKING_SELECTION,
      APPLICATION_STATUS.PENDING_RANKING_SELECTION,
    );
  });

  it('6) coordinator advances RANKING_SELECTION -> FINAS_PROPER (RANKED -> AWARDED, award number assigned)', async () => {
    const res = await bearer(
      request(app).put(
        `/api/v1/sponsorships/coordinator/students/${ctx.studentId}/status`,
      ),
      coordinatorToken,
    ).send({
      sponsorshipId: ctx.sponsorshipId,
      appStage: APPLICATION_STAGE.RANKING_SELECTION,
      appStatus: APPLICATION_STATUS.RANKED,
    });

    expect(res.status).toBe(200);
    const row = await expectStage(
      APPLICATION_STAGE.FINAS_PROPER,
      APPLICATION_STATUS.AWARDED,
    );
    // AWD-<batchNumber(min 3 digits)>-<grantee(4 digits)>, e.g. AWD-005-0001.
    expect(row.award_number).toMatch(/^AWD-\d{3,}-\d{4}$/);

    // eslint-disable-next-line no-console
    console.log('  [E2E] award_number =', row.award_number);
  });

  it('7) coordinator ranking endpoint responds (AHP/TOPSIS; soft on unconfigured criteria)', async () => {
    const res = await bearer(
      request(app).get(
        `/api/v1/sponsorships/rank-student/${ctx.sponsorshipId}`,
      ),
      coordinatorToken,
    );

    // With pairwise criteria configured this returns 200 + scores. Without them,
    // the service reports an invalid-request error. Either is an acceptable E2E
    // outcome — we only assert the route is wired and reachable, not a 5xx.
    expect([200, 400]).toContain(res.status);
    // eslint-disable-next-line no-console
    console.log('  [E2E] rank-student status =', res.status);
  });
});

/** Reads the application row for the test student and asserts its stage/status. */
async function expectStage(
  stage: APPLICATION_STAGE,
  status: APPLICATION_STATUS,
) {
  const { uuidToBinary } = await import('../utils');
  const row = await prisma.sponsorshipApplication.findFirst({
    where: { student_id: uuidToBinary(ctx.studentId!) },
  });
  expect(row).not.toBeNull();
  expect(row!.application_stage).toBe(stage);
  expect(row!.application_status).toBe(status);
  return row!;
}
