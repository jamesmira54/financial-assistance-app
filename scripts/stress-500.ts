/**
 * 500 STRESS / FUZZ HARNESS — throws adversarial inputs at every API endpoint and reports
 * any that return an unhandled server error (HTTP >= 500). A 500 means an exception escaped
 * the handler instead of being turned into a 4xx — i.e. a robustness bug.
 *
 * Runs in-process (supertest) against the real faa-db. Batteries:
 *   - AUTH:   no token / malformed / expired / missing-userId / bad-userId / nonexistent user
 *   - IDS:    non-uuid, SQLi, nulls, path traversal, huge, valid-format-nonexistent
 *   - QUERY:  bad pagination, type confusion, SQLi in search
 *   - BODY:   empty, wrong-types, arrays-as-object, huge strings, SQLi, deeply nested
 *
 * SAFETY: mutating endpoints (PUT) are pointed at THROWAWAY fixtures created by this script;
 * DELETE endpoints only ever receive non-existent ids. Real rows are not corrupted/removed.
 *
 * RUN:  TS_NODE_TRANSPILE_ONLY=1 npx ts-node scripts/stress-500.ts
 */

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

type Method = 'get' | 'post' | 'put' | 'delete';
type Hit = { method: Method; url: string; label: string; status: number; snippet: string };
const results: Hit[] = [];
let total = 0;

const NONE = Symbol('no-body');

async function hit(method: Method, url: string, label: string, opts: { token?: string | null; body?: any } = {}) {
  total++;
  let req = (request(app) as any)[method](url);
  if (opts.token) req = req.set('Authorization', `Bearer ${opts.token}`);
  else if (opts.token === undefined) req = req.set('Authorization', `Bearer ${adminToken}`); // default admin
  // opts.token === null => send NO auth header
  if (opts.body !== undefined && opts.body !== NONE) req = req.send(opts.body);
  try {
    const res = await req;
    results.push({ method, url, label, status: res.status, snippet: (res.text || '').slice(0, 160) });
    return res.status;
  } catch (e: any) {
    results.push({ method, url, label, status: -1, snippet: `THREW: ${e.message}` });
    return -1;
  }
}

// ---- fuzz batteries -------------------------------------------------------
const HUGE = 'A'.repeat(50000);
const BAD_IDS: Array<[string, string]> = [
  ['non-uuid', 'not-a-uuid'],
  ['numeric', '12345'],
  ['sqli', "' OR '1'='1"],
  ['traversal', '../../etc/passwd'],
  ['null-word', 'null'],
  ['undefined-word', 'undefined'],
  ['empty-ish', '%20'],
  ['valid-format-missing', '00000000-0000-0000-0000-000000000000'],
  ['huge', HUGE.slice(0, 2000)],
];
const BAD_INT_IDS: Array<[string, string]> = [
  ['non-int', 'abc'],
  ['sqli', "1 OR 1=1"],
  ['float', '1.5'],
  ['negative', '-1'],
  ['huge', '999999999999999999'],
];
const BAD_BODIES: Array<[string, any]> = [
  ['no-body', NONE],
  ['empty-obj', {}],
  ['null-body', null],
  ['array-body', [1, 2, 3]],
  ['junk-fields', { foo: 'bar', x: 1 }],
  ['type-confusion', { name: 12345, email: {}, batchNumber: 'nope', limit: [], slot: null, fundAllocation: 'x' }],
  ['nested-object', { name: { deep: { a: [1, 2, 3] } }, email: { $ne: null } }],
  ['huge-string', { name: HUGE, email: HUGE, question: HUGE, answer: HUGE, content: HUGE }],
  ['sqli', { name: "'; DROP TABLE users;--", email: "a@b.com'--", username: "' OR 1=1--" }],
  ['bool-confusion', { batchNumber: true, limit: false, slot: 'true' }],
];
const BAD_QUERIES: Array<[string, string]> = [
  ['neg-page', '?page=-1&limit=-999'],
  ['huge-limit', '?page=1&limit=99999999999'],
  ['type-confusion', '?page=abc&limit=xyz&sort[]=1'],
  ['sqli-search', "?search=' OR '1'='1&filter=1;DROP TABLE students"],
  ['array-params', '?status[]=a&status[]=b&appStage[]=x'],
  ['huge-search', `?search=${'x'.repeat(5000)}`],
];

// ---- fixtures -------------------------------------------------------------
let adminToken: string;
const ctx: any = {};

async function setup() {
  const admin = await prisma.user.findFirst({ where: { email: 'admin@gmail.com' } });
  adminToken = jwt.sign({ email: admin!.email, userId: binaryToUuid(admin!.id) }, SECRET, { expiresIn: '6h' });

  const sponsor = await prisma.user.findFirst({ where: { email: 'sponsor1@gmail.com' } });
  const academicYear = await prisma.academicYear.findFirst();
  const brg = await prisma.barangay.findFirst();
  const citymun = await prisma.citymun.findFirst({ where: { citymun_code: brg!.citymun_code } });
  const province = await prisma.province.findFirst({ where: { prov_code: brg!.prov_code } });
  const region = await prisma.region.findFirst({ where: { reg_code: brg!.reg_code } });
  const fileType = await prisma.fileType.findFirst();
  ctx.sponsorId = binaryToUuid(sponsor!.id);
  ctx.academicYearId = binaryToUuid(academicYear!.id);
  ctx.fileTypeId = binaryToUuid(fileType!.id);
  ctx.brgId = brg!.id; ctx.citymunId = citymun!.id; ctx.provinceId = province!.id; ctx.regionId = region!.id;

  // Throwaway student (register).
  const email = `stress.student.${STAMP}@example.com`;
  await request(app).post('/api/v1/auth/student/register').send({
    username: `stress_student_${STAMP}`, email, password: 'secret123', repassword: 'secret123',
    firstName: 'Stress', lastName: `T-${STAMP}`, mobileNumber: '09171234567',
  });
  const stUser = await prisma.user.findFirst({ where: { email } });
  const stRow = await prisma.student.findFirst({ where: { user_id: stUser!.id } });
  ctx.studentId = binaryToUuid(stRow!.id);
  ctx.studentUserId = binaryToUuid(stUser!.id);

  // Throwaway coordinator (for PUT /users/:id fuzz).
  const cEmail = `stress.coord.${STAMP}@example.com`;
  await request(app).post('/api/v1/auth/register').set('Authorization', `Bearer ${adminToken}`).send({
    username: `stress_coord_${STAMP}`, email: cEmail, password: 'secret123', repassword: 'secret123',
    firstName: 'Stress', lastName: `C-${STAMP}`, mobileNumber: '09170000009',
    roleId: '49ce0be7-47b6-11f1-be6c-f4b520508eb0',
  });
  ctx.coordUserId = binaryToUuid((await prisma.user.findFirst({ where: { email: cEmail } }))!.id);

  // Throwaway sponsorship + application (for status/PUT fuzz).
  const sp = await request(app).post('/api/v1/sponsorships/coordinator').set('Authorization', `Bearer ${adminToken}`).send({
    name: `Stress Sponsorship ${STAMP}`, sponsorId: ctx.sponsorId, academicYearId: ctx.academicYearId,
    durationFrom: new Date().toISOString(), durationTo: new Date(Date.now() + 3e10).toISOString(),
    batchNumber: (STAMP % 9000) + 1, limit: 100, slot: 100, fundAllocation: 1e6, allowancePerStudent: 20000,
    sponsorshipSchool: [], sponsorshipRequirements: [ctx.fileTypeId],
  });
  ctx.sponsorshipId = sp.body?.data?.id;
  await request(app).post('/api/v1/sponsorships/student').set('Authorization', `Bearer ${adminToken}`)
    .send({ studentId: ctx.studentId, sponsorshipId: ctx.sponsorshipId });

  // Throwaway school / academic year / faq (for PUT fuzz on valid ids).
  const sc = await request(app).post('/api/v1/schools').set('Authorization', `Bearer ${adminToken}`).send({
    name: `Stress School ${STAMP}`, schoolType: 'public', street: 'x', brgyId: ctx.brgId,
    cityMunId: ctx.citymunId, provinceId: ctx.provinceId, regionId: ctx.regionId, zipCode: 9200,
  });
  ctx.schoolId = sc.body?.data?.id;
  const ay = await request(app).post('/api/v1/academic-years').set('Authorization', `Bearer ${adminToken}`).send({
    academicYearStart: 4000 + (STAMP % 4000), academicYearEnd: 4001 + (STAMP % 4000), schoolTerm: 1,
    dateFrom: new Date('4000-06-01').toISOString(), dateTo: new Date('4001-03-31').toISOString(),
  });
  ctx.academicYearIdThrow = ay.body?.data?.id;
  const faq = await request(app).post('/api/v1/faqs').set('Authorization', `Bearer ${adminToken}`).send({
    question: `Stress ${STAMP}?`, answer: 'a', category: 'GENERAL', sortOrder: 1,
  });
  ctx.faqId = faq.body?.data?.id;
}

// ---- fuzz runs ------------------------------------------------------------
async function run() {
  // 1) AUTH battery against a role-checked route and an auth-only route.
  const badTokens: Array<[string, string | null]> = [
    ['no-token', null],
    ['garbage', 'garbage.token.value'],
    ['expired', jwt.sign({ email: 'x', userId: ctx.coordUserId }, SECRET, { expiresIn: '-1h' })],
    ['no-userId', jwt.sign({ email: 'x' }, SECRET, { expiresIn: '1h' })],
    ['bad-userId', jwt.sign({ email: 'x', userId: 'not-a-uuid' }, SECRET, { expiresIn: '1h' })],
    ['nonexistent-user', jwt.sign({ email: 'x', userId: '00000000-0000-0000-0000-000000000000' }, SECRET, { expiresIn: '1h' })],
    ['wrong-secret', jwt.sign({ email: 'x', userId: ctx.coordUserId }, 'wrong-secret', { expiresIn: '1h' })],
  ];
  for (const [label, tok] of badTokens) {
    await hit('get', '/api/v1/sponsorships/coordinator', `auth[allowRoles]:${label}`, { token: tok });
    await hit('get', '/api/v1/students', `auth[authOnly]:${label}`, { token: tok });
    await hit('get', '/api/v1/monitoring/grantees', `auth[monitoring]:${label}`, { token: tok });
  }

  // 2) ID battery on GET/:id (binary-uuid) endpoints.
  const idGetRoutes = (id: string) => [
    `/api/v1/schools/${id}`, `/api/v1/academic-years/${id}`, `/api/v1/students/${id}`,
    `/api/v1/students/files/${id}`, `/api/v1/users/${id}`, `/api/v1/faqs/${id}`,
    `/api/v1/resources/${id}`, `/api/v1/notifications/${id}`, `/api/v1/schedules/${id}`,
    `/api/v1/announcements/${id}`, `/api/v1/sponsorships/coordinator/${id}`,
    `/api/v1/sponsorships/student/${id}`, `/api/v1/sponsorships/rank-student/${id}`,
  ];
  for (const [label, id] of BAD_IDS) {
    for (const url of idGetRoutes(encodeURIComponent(id))) {
      await hit('get', url, `id:${label}`);
    }
  }

  // 3) INT-ID battery (address lookups use int/string codes).
  for (const [label, v] of BAD_INT_IDS) {
    await hit('get', `/api/v1/address/citymuns?provinceCode=${encodeURIComponent(v)}`, `intid:${label}`);
    await hit('get', `/api/v1/address/barangays?citymunCode=${encodeURIComponent(v)}`, `intid:${label}`);
  }

  // 4) QUERY battery on list endpoints.
  const listRoutes = [
    '/api/v1/students', '/api/v1/users', '/api/v1/schools', '/api/v1/academic-years',
    '/api/v1/sponsorships/coordinator', '/api/v1/notifications', '/api/v1/monitoring/grantees',
    '/api/v1/resources', '/api/v1/faqs', '/api/v1/public/sponsorships', '/api/v1/public/announcements',
    `/api/v1/sponsorships/student/available/${ctx.studentId}`,
    `/api/v1/sponsorships/student/my-sponsorships/${ctx.studentId}`,
  ];
  for (const [label, q] of BAD_QUERIES) {
    for (const base of listRoutes) await hit('get', base + q, `query:${label}`);
  }
  // applicants/by-stage with bad appStage
  for (const [label, q] of BAD_QUERIES) {
    await hit('get', '/api/v1/sponsorships/applicants/by-stage' + q, `query:${label}`);
  }

  // 5) BODY battery on POST endpoints (valid admin auth).
  const postRoutes = [
    '/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/student/register',
    '/api/v1/auth/forgot-password', '/api/v1/auth/reset-password', '/api/v1/auth/change-password',
    '/api/v1/schools', '/api/v1/academic-years', '/api/v1/faqs', '/api/v1/schedules',
    '/api/v1/sponsorships/coordinator', '/api/v1/sponsorships/student',
    '/api/v1/sponsorships/bulk-upsert-custom-input',
  ];
  for (const [label, body] of BAD_BODIES) {
    for (const url of postRoutes) await hit('post', url, `body:${label}`, { body });
  }

  // 6) BODY battery on PUT endpoints (throwaway/valid ids so the service is actually reached).
  const putTargets: Array<[string, string]> = [
    [`/api/v1/students/${ctx.studentId}`, 'PUT student'],
    [`/api/v1/users/${ctx.coordUserId}`, 'PUT user'],
    [`/api/v1/schools/${ctx.schoolId}`, 'PUT school'],
    [`/api/v1/academic-years/${ctx.academicYearIdThrow}`, 'PUT academicYear'],
    [`/api/v1/faqs/${ctx.faqId}`, 'PUT faq'],
    [`/api/v1/sponsorships/coordinator/${ctx.sponsorshipId}`, 'PUT sponsorship'],
    [`/api/v1/sponsorships/coordinator/students/${ctx.studentId}/status`, 'PUT status'],
    [`/api/v1/sponsorships/update-criterion/${ctx.sponsorshipId}`, 'PUT criterion'],
    [`/api/v1/static-content/ABOUT_US`, 'PUT staticContent'],
  ];
  for (const [label, body] of BAD_BODIES) {
    for (const [url, name] of putTargets) await hit('put', url, `${name} body:${label}`, { body });
  }

  // 7) DELETE against NON-existent ids only (never real rows).
  for (const [label, id] of BAD_IDS) {
    const eid = encodeURIComponent(id);
    await hit('delete', `/api/v1/schools/${eid}`, `del school id:${label}`);
    await hit('delete', `/api/v1/academic-years/${eid}`, `del ay id:${label}`);
    await hit('delete', `/api/v1/faqs/${eid}`, `del faq id:${label}`);
    await hit('delete', `/api/v1/users/${eid}`, `del user id:${label}`);
    await hit('delete', `/api/v1/notifications/${eid}`, `del notif id:${label}`);
    await hit('delete', `/api/v1/schedules/${eid}`, `del schedule id:${label}`);
    await hit('delete', `/api/v1/announcements/${eid}`, `del announcement id:${label}`);
  }
}

async function main() {
  if (!SECRET) throw new Error('SECRET_KEY not loaded.');
  console.log(`\n=== 500 STRESS (stamp ${STAMP}) ===`);
  await setup();
  console.log('Fixtures ready. Fuzzing...');
  await run();

  const errors = results.filter((r) => r.status >= 500 || r.status === -1);
  const byStatus = results.reduce((m: any, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});

  console.log(`\n=== RESULTS: ${total} requests ===`);
  console.log('Status distribution:', JSON.stringify(byStatus));
  console.log(`\n>>> ${errors.length} requests returned >= 500 (or threw) <<<`);

  // Group the offenders by endpoint+input for a compact report.
  const grouped = new Map<string, Hit>();
  for (const e of errors) grouped.set(`${e.method.toUpperCase()} ${strip(e.url)} | ${e.label}`, e);
  for (const [k, e] of grouped) {
    console.log(`\n[${e.status}] ${k}`);
    console.log(`     ${e.snippet.replace(/\s+/g, ' ')}`);
  }

  const reportDir = path.join(__dirname, '..', 'docs', 'sessions', 'be');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `stress-500-${STAMP}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ total, byStatus, errors }, null, 2));
  console.log(`\nFull report: ${reportPath}`);
}

function strip(url: string) {
  return url.split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id').replace(/\/[^/]{20,}/g, '/:garbage');
}

main()
  .catch((e) => { console.error('\nFATAL:', e.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); setTimeout(() => process.exit(process.exitCode ?? 0), 500); });
