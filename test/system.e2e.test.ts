/**
 * FULL-SYSTEM E2E / REGRESSION SUITE — every module, real faa-db, no mocks.
 *
 * Complements test/workflow.e2e.test.ts (which owns the deep sponsorship lifecycle).
 * This file exercises the READ + CRUD surface of every module mounted in routes.ts so a
 * single run tells you whether any endpoint of the system regressed.
 *
 * Assertion policy:
 *   - JSON read/CRUD endpoints  -> strict status assertions (200 / 201 / expected).
 *   - Multipart uploads & AHP ranking (need heavy fixtures) -> "route reachable, no 5xx".
 *     These assert status < 500 so a broken route/middleware still fails the suite, while
 *     not requiring us to reproduce every multipart validator.
 *
 * Data is left behind (consistent with the project's chosen lifecycle). Every run uses a
 * unique stamp so re-runs never collide; throwaway CRUD entities are deleted within the run.
 *
 * RUN:  npx jest test/system.e2e.test.ts --runInBand --forceExit
 */

jest.unmock('@prisma/client');

import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
const app = require('../app').default;
import { binaryToUuid } from '../utils';

const prisma = new PrismaClient();
const SECRET = process.env.SECRET_KEY as string;
const STAMP = Date.now();

const auth = (r: request.Test, tok: string) => r.set('Authorization', `Bearer ${tok}`);
const sign = (email: string, userId: string) =>
  jwt.sign({ email, userId }, SECRET, { expiresIn: '6h' });

// Shared fixtures resolved in beforeAll.
const ctx: any = {};
let adminToken: string;
let studentToken: string;
let tmpImage: string;
let tmpDoc: string;

beforeAll(async () => {
  if (!SECRET) throw new Error('SECRET_KEY not loaded from .env.');

  const admin = await prisma.user.findFirst({ where: { email: 'admin@gmail.com' } });
  if (!admin) throw new Error('admin@gmail.com not found.');
  ctx.adminId = binaryToUuid(admin.id);
  adminToken = sign(admin.email, ctx.adminId);

  // Reference data
  const sponsor = await prisma.user.findFirst({ where: { email: 'sponsor1@gmail.com' } });
  const academicYear = await prisma.academicYear.findFirst();
  const sponsorship = await prisma.sponsorship.findFirst({ orderBy: { created_at: 'desc' } });
  const brg = await prisma.barangay.findFirst();
  const citymun = await prisma.citymun.findFirst({ where: { citymun_code: brg!.citymun_code } });
  const province = await prisma.province.findFirst({ where: { prov_code: brg!.prov_code } });
  const region = await prisma.region.findFirst({ where: { reg_code: brg!.reg_code } });
  const school = await prisma.school.findFirst();
  const fileType = await prisma.fileType.findFirst();

  ctx.sponsorId = binaryToUuid(sponsor!.id);
  ctx.academicYearId = binaryToUuid(academicYear!.id);
  ctx.sponsorshipId = binaryToUuid(sponsorship!.id);
  ctx.brg = brg!;
  ctx.citymun = citymun!;
  ctx.province = province!;
  ctx.region = region!;
  ctx.schoolId = binaryToUuid(school!.id);
  ctx.fileTypeId = binaryToUuid(fileType!.id);

  // Register a fresh student (used as the "student" actor + a target row for reads).
  ctx.studentUsername = `sys_e2e_student_${STAMP}`;
  ctx.studentEmail = `sys.e2e.student.${STAMP}@example.com`;
  ctx.studentPassword = 'secret123';
  const reg = await request(app).post('/api/v1/auth/student/register').send({
    username: ctx.studentUsername,
    email: ctx.studentEmail,
    password: ctx.studentPassword,
    repassword: ctx.studentPassword,
    firstName: 'Sys',
    lastName: `E2E-${STAMP}`,
    mobileNumber: '09171234567',
  });
  if (reg.status !== 201) throw new Error(`student register failed: ${reg.status} ${reg.text}`);
  const stUser = await prisma.user.findFirst({ where: { email: ctx.studentEmail } });
  const stRow = await prisma.student.findFirst({ where: { user_id: stUser!.id } });
  ctx.studentUserId = binaryToUuid(stUser!.id);
  ctx.studentId = binaryToUuid(stRow!.id);
  studentToken = sign(ctx.studentEmail, ctx.studentUserId);

  // Register a throwaway coordinator (used by the Users CRUD block, deleted there).
  ctx.coordEmail = `sys.e2e.coord.${STAMP}@example.com`;
  const coordReg = await auth(request(app).post('/api/v1/auth/register'), adminToken).send({
    username: `sys_e2e_coord_${STAMP}`,
    email: ctx.coordEmail,
    password: 'secret123',
    repassword: 'secret123',
    firstName: 'Coord',
    lastName: `E2E-${STAMP}`,
    mobileNumber: '09170000009',
    roleId: '49ce0be7-47b6-11f1-be6c-f4b520508eb0', // Financial Assistance Coordinator
  });
  if (coordReg.status !== 201) throw new Error(`coord register failed: ${coordReg.status} ${coordReg.text}`);
  const coordUser = await prisma.user.findFirst({ where: { email: ctx.coordEmail } });
  ctx.coordUserId = binaryToUuid(coordUser!.id);

  // Temp files for upload endpoints.
  const dir = path.join(__dirname, '..', 'uploads', 'e2e-tmp');
  fs.mkdirSync(dir, { recursive: true });
  tmpImage = path.join(dir, `img-${STAMP}.png`);
  tmpDoc = path.join(dir, `doc-${STAMP}.pdf`);
  // 1x1 PNG
  fs.writeFileSync(tmpImage, Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f5f0000000049454e44ae426082', 'hex'));
  fs.writeFileSync(tmpDoc, '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
describe('Auth module', () => {
  it('POST /auth/login returns a token', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      username: ctx.studentUsername,
      password: ctx.studentPassword,
    });
    expect(res.status).toBe(200);
    expect(res.body.data?.token).toBeDefined();
  });

  it('GET /auth/me returns the authenticated user', async () => {
    const res = await auth(request(app).get('/api/v1/auth/me'), studentToken);
    expect(res.status).toBe(200);
  });

  it('POST /auth/forgot-password is reachable (no 5xx; 400 when SMTP unconfigured)', async () => {
    // The happy path sends an email; without SMTP configured in the test env the
    // service returns 400. We assert the route/validation path works (no server error).
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: ctx.studentEmail });
    expect(res.status).toBeLessThan(500);
  });

  it('GET /auth/validate-reset-token/:token handles an invalid token (no 5xx)', async () => {
    const res = await request(app).get('/api/v1/auth/validate-reset-token/not-a-real-token');
    expect(res.status).toBeLessThan(500);
  });

  it('PUT /auth/change-password updates the password', async () => {
    const res = await auth(request(app).put('/api/v1/auth/change-password'), studentToken).send({
      password: 'secret123',
      repassword: 'secret123',
    });
    expect(res.status).toBe(200);
  });

  it('GET /verify confirms a valid token', async () => {
    const res = await auth(request(app).get('/api/v1/verify'), adminToken);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('a validly-signed token missing userId is rejected (400), not a 500 (allowRoles hardening)', async () => {
    // Regression for the stress-500 finding: allowRoles must not crash on a token whose
    // payload omits the userId claim. This app's ResponseHandler.forbidden maps to 400
    // (BAD_REQUEST), which is how every other allowRoles rejection already behaves.
    const noUserIdToken = jwt.sign({ email: 'x@example.com' }, SECRET, { expiresIn: '1h' });
    const res = await auth(request(app).get('/api/v1/sponsorships/coordinator'), noUserIdToken);
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });
});

// ---------------------------------------------------------------------------
describe('Reference & read endpoints', () => {
  // NOTE: reference adminToken *inside* the returned fn so it is read at run time
  // (after beforeAll), not at test-collection time when it is still undefined.
  const okGet = (url: string) => async () => {
    const res = await auth(request(app).get(url), adminToken);
    expect(res.status).toBe(200);
  };

  it('GET /roles', okGet('/api/v1/roles'));
  it('GET /address/regions', okGet('/api/v1/address/regions'));
  it('GET /address/provinces', okGet('/api/v1/address/provinces'));
  it('GET /address/citymuns?provinceCode', async () => {
    const res = await auth(request(app).get(`/api/v1/address/citymuns?provinceCode=${ctx.province.prov_code}`), adminToken);
    expect(res.status).toBe(200);
  });
  it('GET /address/barangays?citymunCode', async () => {
    const res = await auth(request(app).get(`/api/v1/address/barangays?citymunCode=${ctx.citymun.citymun_code}`), adminToken);
    expect(res.status).toBe(200);
  });
  it('GET /schools', okGet('/api/v1/schools'));
  it('GET /schools/:id', async () => { await okGet(`/api/v1/schools/${ctx.schoolId}`)(); });
  it('GET /academic-years', okGet('/api/v1/academic-years'));
  it('GET /academic-years/:id', async () => { await okGet(`/api/v1/academic-years/${ctx.academicYearId}`)(); });
  it('GET /students', okGet('/api/v1/students'));
  it('GET /students/:id', async () => { await okGet(`/api/v1/students/${ctx.studentId}`)(); });
  it('GET /students/academic-strands', okGet('/api/v1/students/academic-strands'));
  it('GET /students/award-honors', okGet('/api/v1/students/award-honors'));
  it('GET /students/files/:id', async () => { await okGet(`/api/v1/students/files/${ctx.studentId}`)(); });
  it('GET /users', okGet('/api/v1/users'));
  it('GET /users/:id', async () => { await okGet(`/api/v1/users/${ctx.adminId}`)(); });
  it('GET /file-uploads/file-type', okGet('/api/v1/file-uploads/file-type'));
  it('GET /faqs', okGet('/api/v1/faqs'));
  it('GET /faqs/meta/categories', okGet('/api/v1/faqs/meta/categories'));
  it('GET /static-content', okGet('/api/v1/static-content'));
  it('GET /static-content/meta/types', okGet('/api/v1/static-content/meta/types'));
  it('GET /resources', okGet('/api/v1/resources'));
  it('GET /notifications', okGet('/api/v1/notifications'));
  it('GET /notifications/unread-count', okGet('/api/v1/notifications/unread-count'));
  it('GET /dashboard', okGet('/api/v1/dashboard'));
  it('GET /dashboard/enhanced', okGet('/api/v1/dashboard/enhanced'));
  it('GET /monitoring/grantees', okGet('/api/v1/monitoring/grantees'));
  it('GET /announcements', okGet('/api/v1/announcements'));
  it('GET /schedules', okGet('/api/v1/schedules'));
  it('GET /public/sponsorships (no auth)', async () => {
    const res = await request(app).get('/api/v1/public/sponsorships');
    expect(res.status).toBe(200);
  });
  it('GET /public/announcements (no auth)', async () => {
    const res = await request(app).get('/api/v1/public/announcements');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
describe('Sponsorship read endpoints', () => {
  it('GET /sponsorships/coordinator (list)', async () => {
    const res = await auth(request(app).get('/api/v1/sponsorships/coordinator'), adminToken);
    expect(res.status).toBe(200);
  });
  it('GET /sponsorships/coordinator/:id', async () => {
    const res = await auth(request(app).get(`/api/v1/sponsorships/coordinator/${ctx.sponsorshipId}`), adminToken);
    expect(res.status).toBe(200);
  });
  it('GET /sponsorships/criterion-category', async () => {
    const res = await auth(request(app).get('/api/v1/sponsorships/criterion-category'), adminToken);
    expect(res.status).toBe(200);
  });
  it('GET /sponsorships/criterion-category/data-sources', async () => {
    const res = await auth(request(app).get('/api/v1/sponsorships/criterion-category/data-sources'), adminToken);
    expect(res.status).toBe(200);
  });
  it('GET /sponsorships/student/available/:studentId', async () => {
    const res = await auth(request(app).get(`/api/v1/sponsorships/student/available/${ctx.studentId}`), studentToken);
    expect(res.status).toBe(200);
  });
  it('GET /sponsorships/student/my-sponsorships/:studentId', async () => {
    const res = await auth(request(app).get(`/api/v1/sponsorships/student/my-sponsorships/${ctx.studentId}`), studentToken);
    expect(res.status).toBe(200);
  });
  it('GET /sponsorships/applicants/by-stage (route reachable)', async () => {
    const res = await auth(request(app).get('/api/v1/sponsorships/applicants/by-stage?appStage=POOLING'), adminToken);
    expect(res.status).toBeLessThan(500);
  });
  it('GET /sponsorships/rank-student/:id (reachable; needs pairwise criteria)', async () => {
    const res = await auth(request(app).get(`/api/v1/sponsorships/rank-student/${ctx.sponsorshipId}`), adminToken);
    expect(res.status).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------------------
describe('Schools CRUD', () => {
  it('create -> read -> update -> delete', async () => {
    const create = await auth(request(app).post('/api/v1/schools'), adminToken).send({
      name: `E2E School ${STAMP}`,
      schoolType: 'public',
      street: 'Test Street',
      brgyId: ctx.brg.id,
      cityMunId: ctx.citymun.id,
      provinceId: ctx.province.id,
      regionId: ctx.region.id,
      zipCode: 9200,
    });
    // School create responds via ResponseHandler.ok (200) with the created row in data.
    expect(create.status).toBe(200);
    const id = create.body.data?.id;
    expect(id).toBeDefined();

    const read = await auth(request(app).get(`/api/v1/schools/${id}`), adminToken);
    expect(read.status).toBe(200);

    const upd = await auth(request(app).put(`/api/v1/schools/${id}`), adminToken).send({
      name: `E2E School ${STAMP} (edited)`,
      schoolType: 'private',
      street: 'Edited Street',
      brgyId: ctx.brg.id,
      cityMunId: ctx.citymun.id,
      provinceId: ctx.province.id,
      regionId: ctx.region.id,
      zipCode: 9201,
    });
    expect(upd.status).toBe(200);

    const del = await auth(request(app).delete(`/api/v1/schools/${id}`), adminToken);
    expect(del.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
describe('Academic Years CRUD', () => {
  it('create -> read -> update -> delete', async () => {
    // Unique year per run so a prior partial run's leftover row can't cause an
    // "already exists" 400.
    const startYear = 4000 + (STAMP % 5000);
    const endYear = startYear + 1;
    const create = await auth(request(app).post('/api/v1/academic-years'), adminToken).send({
      academicYearStart: startYear,
      academicYearEnd: endYear,
      schoolTerm: 1,
      dateFrom: new Date(`${startYear}-06-01`).toISOString(),
      dateTo: new Date(`${endYear}-03-31`).toISOString(),
    });
    expect(create.status).toBe(201);
    const id = create.body.data?.id;
    expect(id).toBeDefined();

    const read = await auth(request(app).get(`/api/v1/academic-years/${id}`), adminToken);
    expect(read.status).toBe(200);

    const upd = await auth(request(app).put(`/api/v1/academic-years/${id}`), adminToken).send({
      academicYearStart: startYear,
      academicYearEnd: endYear,
      schoolTerm: 2,
      dateFrom: new Date(`${startYear}-06-01`).toISOString(),
      dateTo: new Date(`${endYear}-03-31`).toISOString(),
    });
    expect(upd.status).toBe(200);

    const del = await auth(request(app).delete(`/api/v1/academic-years/${id}`), adminToken);
    expect(del.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
describe('FAQ CRUD', () => {
  it('create -> read -> update -> delete', async () => {
    const create = await auth(request(app).post('/api/v1/faqs'), adminToken).send({
      question: `E2E question ${STAMP}?`,
      answer: 'E2E answer.',
      category: 'GENERAL',
      sortOrder: 1,
    });
    expect(create.status).toBe(201);
    const id = create.body.data?.id;
    expect(id).toBeDefined();

    const read = await auth(request(app).get(`/api/v1/faqs/${id}`), adminToken);
    expect(read.status).toBe(200);

    const upd = await auth(request(app).put(`/api/v1/faqs/${id}`), adminToken).send({
      question: `E2E question ${STAMP} (edited)?`,
      answer: 'E2E answer edited.',
      category: 'GENERAL',
      sortOrder: 2,
    });
    expect(upd.status).toBe(200);

    const del = await auth(request(app).delete(`/api/v1/faqs/${id}`), adminToken);
    expect(del.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
describe('Static Content upsert + read', () => {
  // Only ABOUT_US / CONTACT_US are valid content types. We upsert CONTACT_US and read it
  // back (covers create/update + read). DELETE is intentionally omitted so we do not remove
  // real content from the dev DB.
  const type = 'CONTACT_US';
  it('PUT (upsert) -> GET', async () => {
    const put = await auth(request(app).put(`/api/v1/static-content/${type}`), adminToken).send({
      title: 'E2E Contact',
      content: `E2E body content ${STAMP}.`,
    });
    expect(put.status).toBe(200);

    const get = await request(app).get(`/api/v1/static-content/${type}`);
    expect(get.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
describe('Users CRUD (throwaway coordinator)', () => {
  it('read -> update -> delete', async () => {
    const read = await auth(request(app).get(`/api/v1/users/${ctx.coordUserId}`), adminToken);
    expect(read.status).toBe(200);

    const upd = await auth(request(app).put(`/api/v1/users/${ctx.coordUserId}`), adminToken).send({
      firstName: 'CoordEdited',
      lastName: `E2E-${STAMP}`,
      mobileNumber: '09170000010',
    });
    expect(upd.status).toBeLessThan(500);

    const del = await auth(request(app).delete(`/api/v1/users/${ctx.coordUserId}`), adminToken);
    expect(del.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
describe('Notifications', () => {
  it('GET list, unread-count, mark all read', async () => {
    expect((await auth(request(app).get('/api/v1/notifications'), studentToken)).status).toBe(200);
    expect((await auth(request(app).get('/api/v1/notifications/unread-count'), studentToken)).status).toBe(200);
    const readAll = await auth(request(app).put('/api/v1/notifications/read-all'), studentToken);
    expect(readAll.status).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------------------
describe('Multipart uploads (route reachable, no 5xx)', () => {
  it('POST /resources with a file', async () => {
    const res = await auth(request(app).post('/api/v1/resources'), adminToken)
      .field('title', `E2E Resource ${STAMP}`)
      .field('description', 'desc')
      .field('category', 'GENERAL')
      .attach('file', tmpDoc);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /file-uploads/:studentId (applicationForm + fileTypeId)', async () => {
    const res = await auth(request(app).post(`/api/v1/file-uploads/${ctx.studentId}`), adminToken)
      .field('fileTypeId', ctx.fileTypeId)
      .attach('applicationForm', tmpDoc);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /announcements with files', async () => {
    const res = await auth(request(app).post('/api/v1/announcements'), adminToken)
      .field('title', `E2E Announcement ${STAMP}`)
      .field('content', 'E2E announcement body')
      .field('caption', 'E2E caption')
      .field('targetMunicipalitys', JSON.stringify([ctx.citymun.id]))
      .attach('files', tmpImage);
    expect(res.status).toBeLessThan(500);
  });
});
