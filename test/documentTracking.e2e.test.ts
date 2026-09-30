/**
 * END-TO-END TEST — Document Tracking System (DTS), against the REAL database.
 *
 * Like the other *.e2e.test.ts suites this restores the real PrismaClient
 * (`jest.unmock`), so requests run route -> validation -> service -> MySQL with
 * real transactions, row locks, unique indexes and foreign keys. Nothing is mocked.
 *
 * Prerequisites: the DTS migration is applied and `npm run prisma-dts` has seeded the
 * setup values (offices, process types, purposes, "DTS Officer" role). The only other
 * seed data used is admin@gmail.com and any one active sponsorship.
 *
 * Actors (created fresh per run, timestamped so re-runs never collide):
 *   coordinator  Financial Assistance Coordinator, assigned to Scholarship Office
 *   accounting   DTS Officer, Accounting Office      (+ accounting2, same office)
 *   treasury     DTS Officer, Treasury Office
 *   budget       DTS Officer, Budget Office          (never handles the track)
 *
 * Journey:
 *   admin assigns offices -> coordinator drafts, edits, submits to Accounting ->
 *   wrong office is refused -> Accounting accepts, forwards to Treasury ->
 *   Treasury accepts, returns (goes back to Accounting) -> Accounting re-accepts,
 *   returns to origin -> coordinator edits and resubmits -> Accounting accepts and
 *   marks Done -> movement is locked -> history, PDF, notifications, list/inbox,
 *   and a real concurrent double-accept race.
 *
 * DATA LIFECYCLE: unlike workflow.e2e, this suite CLEANS UP everything it created.
 * Its users are attached to real offices and would otherwise receive real DTS
 * notifications and show up in office user lists. The per-year track-number counter
 * (dts_sequences) is intentionally left advanced: numbers are never reused.
 *
 * RUN:  npx jest test/documentTracking.e2e.test.ts --runInBand --forceExit
 */

jest.unmock('@prisma/client');

import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const app = require('../app').default;
import { binaryToUuid, uuidToBinary } from '../utils';

const prisma = new PrismaClient();
const SECRET_KEY = process.env.SECRET_KEY as string;
const STAMP = Date.now();
const BASE = '/api/v1/document-tracks';

type Actor = { id: string; email: string; token: string };
const actors: Record<string, Actor> = {};
const offices: Record<string, string> = {};
const ctx: {
  adminToken?: string;
  processTypeId?: string;
  purposeId?: string;
  sponsorshipId?: string;
  trackId?: string;
  trackNumber?: string;
  submittedAt?: string;
  raceTrackId?: string;
  setupId?: string;
} = {};
const createdTrackIds: string[] = [];

const sign = (email: string, userId: string) => jwt.sign({ email, userId }, SECRET_KEY, { expiresIn: '1h' });
const as = (who: string) => (r: request.Test) =>
  r.set('Authorization', `Bearer ${who === 'admin' ? ctx.adminToken : actors[who].token}`);
const act = (who: string, action: string, body: Record<string, any> = {}, trackId = ctx.trackId) =>
  as(who)(request(app).post(`${BASE}/${trackId}/${action}`)).send(body);
const errorText = (res: request.Response) => JSON.stringify(res.body);
const lastEntry = (res: request.Response) => res.body.data.history[res.body.data.history.length - 1];

const trackBody = (overrides: Record<string, any> = {}) => ({
  title: `E2E Batch ${STAMP} Scholarship Voucher Processing`,
  particulars: 'Scholarship vouchers and supporting documents for Batch 1 grantees',
  processTypeId: ctx.processTypeId,
  purposeId: ctx.purposeId,
  sponsorshipId: ctx.sponsorshipId,
  destinationId: offices.accounting,
  ...overrides,
});

const createUser = async (key: string, roleName: string) => {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw new Error(`Role "${roleName}" not found — run npm run prisma-seed / prisma-dts.`);
  const email = `e2e.dts.${key}.${STAMP}@example.com`;
  const user = await prisma.user.create({
    data: {
      role_id: role.id,
      first_name: `E2E ${key}`,
      last_name: `DTS${STAMP}`,
      username: `e2e_dts_${key}_${STAMP}`,
      mobile_number: '09000000000',
      email,
      password: await bcrypt.hash('e2e-password', 4),
    },
  });
  const id = binaryToUuid(user.id);
  actors[key] = { id, email, token: sign(email, id) };
};

beforeAll(async () => {
  if (!SECRET_KEY) throw new Error('SECRET_KEY not loaded from .env.');

  const admin = await prisma.user.findFirst({ where: { email: 'admin@gmail.com' } });
  if (!admin) throw new Error('admin@gmail.com not found.');
  ctx.adminToken = sign(admin.email, binaryToUuid(admin.id));

  const officeRows = await prisma.dtsOffice.findMany({
    where: { name: { in: ['Scholarship Office', 'Accounting Office', 'Treasury Office', 'Budget Office'] }, record_status: true },
  });
  const byName = (n: string) => {
    const o = officeRows.find((r) => r.name === n);
    if (!o) throw new Error(`DTS office "${n}" missing — run npm run prisma-dts.`);
    return binaryToUuid(o.id);
  };
  offices.scholarship = byName('Scholarship Office');
  offices.accounting = byName('Accounting Office');
  offices.treasury = byName('Treasury Office');
  offices.budget = byName('Budget Office');

  const processType = await prisma.dtsProcessType.findFirst({ where: { name: 'For Processing', is_active: true, record_status: true } });
  const purpose = await prisma.dtsPurpose.findFirst({ where: { name: 'Scholarship/Assistance Voucher', is_active: true, record_status: true } });
  const sponsorship = await prisma.sponsorship.findFirst({ where: { record_status: true }, orderBy: { created_at: 'desc' } });
  if (!processType || !purpose) throw new Error('DTS process types/purposes missing — run npm run prisma-dts.');
  if (!sponsorship) throw new Error('No active sponsorship in the database.');
  ctx.processTypeId = binaryToUuid(processType.id);
  ctx.purposeId = binaryToUuid(purpose.id);
  ctx.sponsorshipId = binaryToUuid(sponsorship.id);

  await createUser('coordinator', 'Financial Assistance Coordinator');
  for (const key of ['accounting', 'accounting2', 'treasury', 'budget']) await createUser(key, 'DTS Officer');
});

afterAll(async () => {
  try {
    const userIds = Object.values(actors).map((a) => uuidToBinary(a.id));
    const trackIds = createdTrackIds.map(uuidToBinary);
    // Test-data teardown only: the application itself never deletes history.
    await prisma.dtsTrackHistory.deleteMany({ where: { track_id: { in: trackIds } } });
    await prisma.dtsTrack.deleteMany({ where: { id: { in: trackIds } } });
    await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (ctx.setupId) await prisma.dtsPurpose.deleteMany({ where: { id: uuidToBinary(ctx.setupId) } });
  } finally {
    await prisma.$disconnect();
  }
});

describe('E2E: Document Tracking System (real DB)', () => {
  // ------------------------------------------------------------ setup & users

  it('1) admin assigns DTS offices to users', async () => {
    const assignments: [string, string][] = [
      ['coordinator', offices.scholarship],
      ['accounting', offices.accounting],
      ['accounting2', offices.accounting],
      ['treasury', offices.treasury],
      ['budget', offices.budget],
    ];
    for (const [who, officeId] of assignments) {
      const res = await as('admin')(request(app).put(`${BASE}/setup/user-offices/${actors[who].id}`)).send({ officeId });
      expect(res.status).toBe(200);
      expect(res.body.data.officeId).toBe(officeId);
    }

    // Non-admins cannot assign offices.
    const denied = await as('coordinator')(request(app).put(`${BASE}/setup/user-offices/${actors.budget.id}`)).send({ officeId: null });
    expect(denied.status).toBe(400);

    const officeUsers = await as('admin')(request(app).get(`${BASE}/setup/offices/${offices.accounting}/users`));
    expect(officeUsers.body.data.map((u: any) => u.userId)).toEqual(
      expect.arrayContaining([actors.accounting.id, actors.accounting2.id]),
    );
  });

  it('2) /me reflects the office assignment', async () => {
    const res = await as('accounting')(request(app).get(`${BASE}/me`));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ userId: actors.accounting.id, officeName: 'Accounting Office', canCreate: false });

    const coord = await as('coordinator')(request(app).get(`${BASE}/me`));
    expect(coord.body.data).toMatchObject({ officeName: 'Scholarship Office', canCreate: true });
  });

  it('3) setup dropdowns list the seeded values', async () => {
    for (const [kind, expected] of [
      ['offices', 'Accounting Office'],
      ['process-types', 'For Processing'],
      ['purposes', 'Scholarship/Assistance Voucher'],
    ]) {
      const res = await as('accounting')(request(app).get(`${BASE}/setup/${kind}`).query({ active: 'true', limit: 100 }));
      expect(res.status).toBe(200);
      expect(res.body.data.data.map((r: any) => r.name)).toContain(expected);
    }
  });

  it('4) setup CRUD: create, reject duplicate, update, soft delete', async () => {
    const name = `E2E Purpose ${STAMP}`;
    const created = await as('admin')(request(app).post(`${BASE}/setup/purposes`)).send({ name, sortOrder: 99 });
    expect(created.status).toBe(201);
    ctx.setupId = created.body.data.id;

    expect((await as('admin')(request(app).post(`${BASE}/setup/purposes`)).send({ name })).status).toBe(400);

    const updated = await as('admin')(request(app).put(`${BASE}/setup/purposes/${ctx.setupId}`)).send({ isActive: false });
    expect(updated.body.data.isActive).toBe(false);

    expect((await as('admin')(request(app).delete(`${BASE}/setup/purposes/${ctx.setupId}`))).status).toBe(200);
    const row = await prisma.dtsPurpose.findUnique({ where: { id: uuidToBinary(ctx.setupId!) } });
    expect(row!.record_status).toBe(false);

    // Office users cannot change configuration.
    expect((await as('accounting')(request(app).post(`${BASE}/setup/purposes`)).send({ name: `${name} x` })).status).toBe(400);
  });

  // ------------------------------------------------------------ create & submit

  it('5) coordinator creates a draft with a server-generated track number', async () => {
    const res = await as('coordinator')(request(app).post(BASE)).send(trackBody());
    expect(res.status).toBe(201);
    const t = res.body.data;
    ctx.trackId = t.id;
    ctx.trackNumber = t.trackNumber;
    createdTrackIds.push(t.id);

    expect(t.trackNumber).toMatch(/^DTS-\d{4}-\d{6}$/);
    expect(t).toMatchObject({ status: 'DRAFT', currentOfficeId: null, originOffice: 'Scholarship Office', intendedDestination: 'Accounting Office' });
    expect(t.allowedActions).toEqual(['EDIT', 'SUBMIT']);

    const row = await prisma.dtsTrack.findUnique({ where: { id: uuidToBinary(t.id) } });
    expect(row!.track_number).toBe(t.trackNumber);
    console.log('  [E2E] trackId =', t.id, t.trackNumber);
  });

  it('6) drafts are private: other offices cannot see or act on them', async () => {
    expect((await as('accounting')(request(app).get(`${BASE}/${ctx.trackId}`))).status).toBe(400);
    expect((await act('accounting', 'accept')).status).toBe(400);
    expect((await as('coordinator')(request(app).get(`${BASE}/${ctx.trackId}/pdf`))).status).toBe(400);
  });

  it('7) creator edits the draft, then submits it to its intended destination', async () => {
    const edited = await as('coordinator')(request(app).put(`${BASE}/${ctx.trackId}`)).send(trackBody({ particulars: 'Vouchers + validation sheets' }));
    expect(edited.status).toBe(200);
    expect(edited.body.data.particulars).toBe('Vouchers + validation sheets');

    const res = await act('coordinator', 'submit');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'SUBMITTED', currentHolder: 'Accounting Office' });
    expect(res.body.data.submittedAt).not.toBeNull();
    ctx.submittedAt = res.body.data.submittedAt;
    expect(lastEntry(res)).toMatchObject({ action: 'SUBMITTED', fromOffice: 'Scholarship Office', toOffice: 'Accounting Office' });

    // Submitting twice is refused.
    expect((await act('coordinator', 'submit')).status).toBe(400);
  });

  it('8) submitted tracks are locked for editing, and their office cannot be deleted', async () => {
    const edit = await as('coordinator')(request(app).put(`${BASE}/${ctx.trackId}`)).send(trackBody({ title: 'Changed after submit' }));
    expect(edit.status).toBe(400);

    const del = await as('admin')(request(app).delete(`${BASE}/setup/offices/${offices.accounting}`));
    expect(del.status).toBe(400);
    expect(errorText(del)).toContain('still holding open document tracks');
  });

  it('9) the destination office users were notified', async () => {
    const rows = await prisma.notification.findMany({
      where: { user_id: { in: [uuidToBinary(actors.accounting.id), uuidToBinary(actors.accounting2.id)] }, type: 'document' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].message).toContain(ctx.trackNumber);
  });

  // ------------------------------------------------------------ office-based access

  it('10) a user from another office cannot accept, and cannot even view it', async () => {
    const res = await act('treasury', 'accept');
    expect(res.status).toBe(400);
    expect(errorText(res)).toContain('You do not have access to this document track');
    expect((await as('budget')(request(app).get(`${BASE}/${ctx.trackId}`))).status).toBe(400);
  });

  it('11) inbox shows the track to Accounting only', async () => {
    const acc = await as('accounting')(request(app).get(BASE).query({ inbox: 'true', search: ctx.trackNumber }));
    expect(acc.status).toBe(200);
    expect(acc.body.data.data.map((t: any) => t.id)).toContain(ctx.trackId);

    const bud = await as('budget')(request(app).get(BASE).query({ search: ctx.trackNumber }));
    expect(bud.body.data.data.map((t: any) => t.id)).not.toContain(ctx.trackId);
  });

  // ------------------------------------------------------------ receiver workflow

  it('12) Accounting accepts (IN_PROCESSED)', async () => {
    const res = await act('accounting', 'accept', { remarks: 'Received complete' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROCESSED');
    expect(lastEntry(res)).toMatchObject({ action: 'ACCEPTED', fromOffice: 'Scholarship Office', toOffice: 'Accounting Office' });
    expect(lastEntry(res).actor).toMatchObject({ userId: actors.accounting.id, office: 'Accounting Office' });
    expect(res.body.data.allowedActions).toEqual(['FORWARD', 'RETURN', 'DONE']);
  });

  it('13) forward validation: destination + remarks required, no self-forward', async () => {
    expect((await act('accounting', 'forward', { remarks: 'x' })).status).toBe(400);
    expect((await act('accounting', 'forward', { destinationId: offices.treasury })).status).toBe(400);
    expect((await act('accounting', 'forward', { destinationId: offices.accounting, remarks: 'loop' })).status).toBe(400);
  });

  it('14) Accounting forwards to Treasury', async () => {
    const res = await act('accounting', 'forward', { destinationId: offices.treasury, remarks: 'For release of funds' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'FORWARDED', currentHolder: 'Treasury Office' });
    expect(lastEntry(res)).toMatchObject({ action: 'FORWARDED', fromOffice: 'Accounting Office', toOffice: 'Treasury Office', remarks: 'For release of funds' });

    // Accounting no longer holds it but keeps read access (it handled the track).
    const stale = await act('accounting', 'accept');
    expect(stale.status).toBe(400);
    expect(errorText(stale)).toContain('office currently holding');
    expect((await as('accounting')(request(app).get(`${BASE}/${ctx.trackId}`))).status).toBe(200);
  });

  it('15) Treasury accepts, then returns it — it goes back to Accounting', async () => {
    expect((await act('treasury', 'return', { remarks: 'x' })).status).toBe(400); // must accept first
    expect((await act('treasury', 'accept')).body.data.status).toBe('IN_PROCESSED');
    expect((await act('treasury', 'return', {})).status).toBe(400); // reason required

    const res = await act('treasury', 'return', { remarks: 'Missing signatures on 3 vouchers' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'RETURNED', currentHolder: 'Accounting Office' });
    expect(lastEntry(res)).toMatchObject({ action: 'RETURNED', fromOffice: 'Treasury Office', toOffice: 'Accounting Office' });
  });

  it('16) Accounting re-accepts and returns it to the origin', async () => {
    expect((await act('accounting', 'accept')).body.data.status).toBe('IN_PROCESSED');
    const res = await act('accounting', 'return', { remarks: 'Needs corrected grantee list' });
    expect(res.body.data).toMatchObject({ status: 'RETURNED', currentHolder: 'Scholarship Office' });
    expect(lastEntry(res)).toMatchObject({ fromOffice: 'Accounting Office', toOffice: 'Scholarship Office' });

    const creatorView = await as('coordinator')(request(app).get(`${BASE}/${ctx.trackId}`));
    expect(creatorView.body.data.allowedActions).toEqual(['EDIT', 'SUBMIT']);
  });

  it('17) coordinator corrects and resubmits; the first submission date is kept', async () => {
    expect((await as('coordinator')(request(app).put(`${BASE}/${ctx.trackId}`)).send(trackBody({ particulars: 'Corrected grantee list attached' }))).status).toBe(200);
    const res = await act('coordinator', 'submit', { remarks: 'Corrections done' });
    expect(res.body.data).toMatchObject({ status: 'SUBMITTED', currentHolder: 'Accounting Office', particulars: 'Corrected grantee list attached' });
    expect(res.body.data.submittedAt).toBe(ctx.submittedAt);
  });

  it('18) Accounting accepts and marks it Done (final remarks required)', async () => {
    await act('accounting', 'accept');
    expect((await act('accounting', 'done', { remarks: '  ' })).status).toBe(400);

    const res = await act('accounting', 'done', { remarks: 'Scholarship voucher processed and released to Treasury Office.' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DONE');
    expect(res.body.data.completedAt).not.toBeNull();
    expect(res.body.data.allowedActions).toEqual([]);

    const row = await prisma.dtsTrack.findUnique({ where: { id: uuidToBinary(ctx.trackId!) } });
    expect(binaryToUuid(row!.completed_by!)).toBe(actors.accounting.id);
  });

  it('19) a Done track cannot move or be edited', async () => {
    for (const [action, body] of [
      ['forward', { destinationId: offices.treasury, remarks: 'x' }],
      ['return', { remarks: 'x' }],
      ['accept', {}],
      ['done', { remarks: 'again' }],
      ['submit', {}],
    ] as const) {
      expect((await act('accounting', action, body)).status).toBe(400);
    }
    expect((await as('coordinator')(request(app).put(`${BASE}/${ctx.trackId}`)).send(trackBody())).status).toBe(400);
    expect((await as('coordinator')(request(app).delete(`${BASE}/${ctx.trackId}`))).status).toBe(400);
  });

  // ------------------------------------------------------------ audit trail & PDF

  it('20) the persisted history is complete, ordered and attributed', async () => {
    const res = await as('coordinator')(request(app).get(`${BASE}/${ctx.trackId}/history`));
    expect(res.status).toBe(200);
    const h = res.body.data;
    expect(h.map((e: any) => e.action)).toEqual([
      'CREATED', 'SUBMITTED', 'ACCEPTED', 'FORWARDED', 'ACCEPTED', 'RETURNED',
      'ACCEPTED', 'RETURNED', 'SUBMITTED', 'ACCEPTED', 'DONE',
    ]);
    expect(h.map((e: any) => e.sequence)).toEqual(h.map((_: any, i: number) => i + 1));
    expect(h[3].actor.userId).toBe(actors.accounting.id);
    expect(h[5].actor.userId).toBe(actors.treasury.id);

    // Same rows in the database, sequence unique per track.
    const count = await prisma.dtsTrackHistory.count({ where: { track_id: uuidToBinary(ctx.trackId!) } });
    expect(count).toBe(11);
  });

  it('21) the PDF renders from the persisted track', async () => {
    const res = await as('treasury')(request(app).get(`${BASE}/${ctx.trackId}/pdf`))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain(`${ctx.trackNumber}.pdf`);
    const pdf: Buffer = res.body;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain(ctx.trackNumber);
    expect(pdf.length).toBeGreaterThan(2000);

    // An office that never handled it cannot print it.
    expect((await as('budget')(request(app).get(`${BASE}/${ctx.trackId}/pdf`))).status).toBe(400);
  });

  it('22) the creator was notified of the return and completion', async () => {
    const rows = await prisma.notification.findMany({
      where: { user_id: uuidToBinary(actors.coordinator.id), type: 'document' },
      orderBy: { created_at: 'asc' },
    });
    expect(rows.map((r) => r.title)).toEqual(expect.arrayContaining(['Document returned', 'Document completed']));
  });

  // ------------------------------------------------------------ concurrency (real row locks)

  it('23) two simultaneous accepts: exactly one wins, one history row', async () => {
    const created = await as('coordinator')(request(app).post(BASE)).send(trackBody({ submit: true, title: `E2E race ${STAMP}` }));
    expect(created.status).toBe(201);
    ctx.raceTrackId = created.body.data.id;
    createdTrackIds.push(ctx.raceTrackId!);

    const results = await Promise.all([
      act('accounting', 'accept', {}, ctx.raceTrackId),
      act('accounting2', 'accept', {}, ctx.raceTrackId),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);

    const accepted = await prisma.dtsTrackHistory.count({
      where: { track_id: uuidToBinary(ctx.raceTrackId!), action: 'ACCEPTED' },
    });
    expect(accepted).toBe(1);
    const row = await prisma.dtsTrack.findUnique({ where: { id: uuidToBinary(ctx.raceTrackId!) } });
    expect(row!.status).toBe('IN_PROCESSED');
    expect(row!.version).toBe(3);
  });

  it('24) track numbers are unique and sequential across tracks', async () => {
    const rows = await prisma.dtsTrack.findMany({ where: { id: { in: createdTrackIds.map(uuidToBinary) } } });
    const nums = rows.map((r) => Number(r.track_number.slice(-6))).sort((a, b) => a - b);
    expect(new Set(rows.map((r) => r.track_number)).size).toBe(rows.length);
    expect(nums[1]).toBeGreaterThan(nums[0]);
  });
});
