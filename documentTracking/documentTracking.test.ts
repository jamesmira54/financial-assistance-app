// Ensure a deterministic JWT secret BEFORE the app is required (require, not
// import, so this runs before app.ts calls dotenv.config()).
process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { uuidToBinary } from '../utils';
const app = require('../app').default;

// Shared Prisma mock instance (see __mocks__/@prisma/client.js).
const { __mockPrisma } = require('@prisma/client');

// ---------------------------------------------------------------------------
// In-memory store behind the DTS Prisma stubs, so tests exercise the real
// route -> validation -> service -> repository workflow end to end. It
// supports only the query shapes the DTS repository uses.
// ---------------------------------------------------------------------------

type Row = Record<string, any>;
let db: Record<string, Row[]>;

const isBin = (v: any) => v instanceof Uint8Array;
const binEq = (a: any, b: any) => isBin(a) && isBin(b) && Buffer.from(a).equals(Buffer.from(b));

const matchValue = (actual: any, cond: any): boolean => {
  if (cond === undefined) return true;
  if (isBin(cond)) return binEq(actual, cond);
  if (cond === null) return actual === null || actual === undefined;
  if (typeof cond === 'object' && !(cond instanceof Date)) {
    if ('in' in cond) return cond.in.some((v: any) => (isBin(v) ? binEq(actual, v) : v === actual));
    if ('notIn' in cond) return !cond.notIn.includes(actual);
    if ('not' in cond) return actual !== cond.not;
    if ('contains' in cond) return String(actual ?? '').includes(cond.contains);
    // Nested relation filter, e.g. { student: { user_id } }.
    if (actual && typeof actual === 'object' && !isBin(actual)) return matches(actual, cond);
  }
  return actual === cond;
};

const matches = (row: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([k, cond]) => {
    if (k === 'OR') return (cond as Row[]).some((w) => matches(row, w));
    if (k === 'AND') return (cond as Row[]).every((w) => matches(row, w));
    return matchValue(row[k], cond);
  });

const byId = (table: string, id: any) => db[table].find((r) => binEq(r.id, id)) ?? null;

const withTrackRelations = (t: Row, include: Row = {}) => {
  const out: Row = {
    ...t,
    processType: byId('dtsProcessType', t.process_type_id),
    purpose: byId('dtsPurpose', t.purpose_id),
    sponsorship: byId('sponsorship', t.sponsorship_id),
    originOffice: t.origin_office_id ? byId('dtsOffice', t.origin_office_id) : null,
    currentOffice: t.current_office_id ? byId('dtsOffice', t.current_office_id) : null,
    intendedDestination: t.intended_destination_id ? byId('dtsOffice', t.intended_destination_id) : null,
    creator: byId('user', t.created_by),
  };
  if (include.history) {
    out.history = db.dtsTrackHistory
      .filter((h) => binEq(h.track_id, t.id))
      .sort((a, b) => a.sequence - b.sequence);
  }
  return out;
};

const withUserRelations = (u: Row | null) =>
  u && { ...u, role: byId('role', u.role_id), dtsOffice: u.dts_office_id ? byId('dtsOffice', u.dts_office_id) : null };

const setupStub = (table: string) => ({
  findFirst: async ({ where }: Row) => db[table].find((r) => matches(r, where)) ?? null,
  findMany: async ({ where }: Row) => db[table].filter((r) => matches(r, where)),
  count: async ({ where }: Row) => db[table].filter((r) => matches(r, where)).length,
  create: async ({ data }: Row) => {
    const row = { id: uuidToBinary(randomUUID()), sort_order: 0, is_active: true, record_status: true, created_at: new Date(), updated_at: new Date(), ...data };
    db[table].push(row);
    return row;
  },
  update: async ({ where, data }: Row) => {
    const row = byId(table, where.id);
    Object.assign(row, data);
    return row;
  },
});

const installStore = () => {
  for (const table of ['dtsProcessType', 'dtsPurpose', 'dtsOffice']) {
    const stub = setupStub(table);
    for (const [fn, impl] of Object.entries(stub)) __mockPrisma[table][fn].mockImplementation(impl);
  }

  __mockPrisma.user.findUnique.mockImplementation(async ({ where }: Row) => withUserRelations(byId('user', where.id)));
  __mockPrisma.user.findFirst.mockImplementation(async ({ where }: Row) => db.user.find((u) => matches(u, where)) ?? null);
  __mockPrisma.user.findMany.mockImplementation(async ({ where }: Row) => db.user.filter((u) => matches(u, where)).map(withUserRelations));
  __mockPrisma.user.update.mockImplementation(async ({ where, data }: Row) => {
    const u = byId('user', where.id);
    Object.assign(u, data);
    return withUserRelations(u);
  });
  // Applications embed their student, so both repo selects (sponsorship_id, and
  // student.user_id) are satisfied by returning whole rows.
  __mockPrisma.sponsorshipApplication.findMany.mockImplementation(async ({ where }: Row) =>
    db.sponsorshipApplication.filter((a) => matches(a, where)));
  __mockPrisma.sponsorship.findFirst.mockImplementation(async ({ where }: Row) => db.sponsorship.find((s) => matches(s, where)) ?? null);
  __mockPrisma.notification.createMany.mockImplementation(async ({ data }: Row) => {
    db.notification.push(...data);
    return { count: data.length };
  });

  __mockPrisma.dtsSequence.upsert.mockImplementation(async ({ where, create }: Row) => {
    let row = db.dtsSequence.find((s) => s.year === where.year);
    if (row) row.last_value += 1;
    else db.dtsSequence.push((row = { ...create }));
    return row;
  });

  __mockPrisma.dtsTrack.create.mockImplementation(async ({ data }: Row) => {
    if (db.dtsTrack.some((t) => t.track_number === data.track_number)) throw new Error('duplicate track_number');
    const row = { id: uuidToBinary(randomUUID()), record_status: true, created_at: new Date(), updated_at: new Date(), submitted_at: null, completed_at: null, ...data };
    db.dtsTrack.push(row);
    return row;
  });
  __mockPrisma.dtsTrack.findFirst.mockImplementation(async ({ where, include }: Row) => {
    const t = db.dtsTrack.find((r) => matches(r, where));
    return t ? withTrackRelations(t, include) : null;
  });
  __mockPrisma.dtsTrack.findMany.mockImplementation(async ({ include }: Row) => db.dtsTrack.map((t) => withTrackRelations(t, include)));
  __mockPrisma.dtsTrack.count.mockImplementation(async ({ where }: Row) =>
    // Only the office-deletion guard counts with a flat where.
    where.AND ? db.dtsTrack.length : db.dtsTrack.filter((t) => matches(t, where)).length);
  __mockPrisma.dtsTrack.updateMany.mockImplementation(async ({ where, data }: Row) => {
    const rows = db.dtsTrack.filter((t) => matches(t, where));
    rows.forEach((t) => Object.assign(t, data, { updated_at: new Date() }));
    return { count: rows.length };
  });

  __mockPrisma.dtsTrackHistory.create.mockImplementation(async ({ data }: Row) => {
    if (db.dtsTrackHistory.some((h) => binEq(h.track_id, data.track_id) && h.sequence === data.sequence)) {
      throw new Error('duplicate history sequence');
    }
    const row = { id: uuidToBinary(randomUUID()), ...data };
    db.dtsTrackHistory.push(row);
    return row;
  });
  __mockPrisma.dtsTrackHistory.findMany.mockImplementation(async ({ where }: Row) =>
    db.dtsTrackHistory.filter((h) => matches(h, where)).sort((a, b) => a.sequence - b.sequence));
  __mockPrisma.dtsTrackHistory.findFirst.mockImplementation(async ({ where }: Row) =>
    db.dtsTrackHistory.filter((h) => matches(h, where)).sort((a, b) => b.sequence - a.sequence)[0] ?? null);
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ids = {
  processType: randomUUID(),
  purpose: randomUUID(),
  sponsorship: randomUUID(),
  scholarship: randomUUID(),
  accounting: randomUUID(),
  treasury: randomUUID(),
  budget: randomUUID(),
  inactive: randomUUID(),
};

const users: Record<string, { id: string; token: string }> = {};

const office = (id: string, name: string, is_active = true) => ({
  id: uuidToBinary(id), name, sort_order: 0, is_active, record_status: true, created_at: new Date(), updated_at: new Date(),
});

const addUser = (key: string, roleName: string, officeId: string | null) => {
  const id = randomUUID();
  let role = db.role.find((r) => r.name === roleName);
  if (!role) db.role.push((role = { id: uuidToBinary(randomUUID()), name: roleName }));
  db.user.push({
    id: uuidToBinary(id), role_id: role.id, first_name: key, last_name: 'User', email: `${key}@example.com`,
    record_status: true, dts_office_id: officeId ? uuidToBinary(officeId) : null,
  });
  users[key] = { id, token: jwt.sign({ email: `${key}@example.com`, userId: id }, process.env.SECRET_KEY as string, { expiresIn: '1h' }) };
};

const addApplication = (key: string, sponsorshipId: string, status: string) => {
  db.sponsorshipApplication.push({
    sponsorship_id: uuidToBinary(sponsorshipId), application_status: status, record_status: true,
    student: { user_id: uuidToBinary(users[key].id), record_status: true },
  });
};

const as = (key: string) => (req: request.Test) => req.set('Authorization', `Bearer ${users[key].token}`);

beforeEach(() => {
  jest.clearAllMocks();
  db = {
    role: [], user: [], sponsorship: [], sponsorshipApplication: [], notification: [], dtsSequence: [], dtsTrack: [], dtsTrackHistory: [],
    dtsProcessType: [{ ...office(ids.processType, 'For Processing') }],
    dtsPurpose: [{ ...office(ids.purpose, 'Scholarship/Assistance Voucher') }],
    dtsOffice: [
      office(ids.scholarship, 'Scholarship Office'),
      office(ids.accounting, 'Accounting Office'),
      office(ids.treasury, 'Treasury Office'),
      office(ids.budget, 'Budget Office'),
      office(ids.inactive, 'Closed Office', false),
    ],
  };
  db.sponsorship.push({ id: uuidToBinary(ids.sponsorship), name: 'Batch 1 Scholarship', record_status: true, batch_number: 1 });
  addUser('coordinator', 'Financial Assistance Coordinator', ids.scholarship);
  addUser('admin', 'System Admin', null);
  addUser('accounting', 'DTS Officer', ids.accounting);
  addUser('treasury', 'DTS Officer', ids.treasury);
  addUser('budget', 'DTS Officer', ids.budget);
  addUser('student', 'Student', null);
  // Grantee students of the sponsorship, plus a rejected applicant.
  addUser('grantee', 'Student', null);
  addUser('rejected', 'Student', null);
  addApplication('grantee', ids.sponsorship, 'AWARDED');
  addApplication('rejected', ids.sponsorship, 'REJECTED');
  installStore();
});

const payload = (overrides: Record<string, any> = {}) => ({
  title: 'Batch 1 Scholarship Voucher Processing',
  particulars: 'Scholarship vouchers and supporting documents for Batch 1 grantees',
  processTypeId: ids.processType,
  purposeId: ids.purpose,
  sponsorshipId: ids.sponsorship,
  destinationId: ids.accounting,
  ...overrides,
});

const BASE = '/api/v1/document-tracks';

const createSubmitted = async () => {
  const res = await as('coordinator')(request(app).post(BASE)).send(payload({ submit: true }));
  expect(res.status).toBe(201);
  return res.body.data;
};

const act = (user: string, trackId: string, action: string, body: Record<string, any> = {}) =>
  as(user)(request(app).post(`${BASE}/${trackId}/${action}`)).send(body);

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

describe('POST /document-tracks (create)', () => {
  it('creates a draft with a server-generated track number and a CREATED entry', async () => {
    const res = await as('coordinator')(request(app).post(BASE)).send(payload());

    expect(res.status).toBe(201);
    const t = res.body.data;
    expect(t.trackNumber).toMatch(new RegExp(`^DTS-${new Date().getFullYear()}-000001$`));
    expect(t.status).toBe('DRAFT');
    expect(t.currentOfficeId).toBeNull();
    expect(t.intendedDestination).toBe('Accounting Office');
    expect(t.submittedAt).toBeNull();
    expect(t.allowedActions).toEqual(['EDIT', 'SUBMIT']);
    expect(t.history.map((h: any) => h.action)).toEqual(['CREATED']);
    expect(t.history[0].actor).toMatchObject({ userId: users.coordinator.id, office: 'Scholarship Office' });
  });

  it('creates and submits in one step', async () => {
    const t = await createSubmitted();

    expect(t.status).toBe('SUBMITTED');
    expect(t.currentHolder).toBe('Accounting Office');
    expect(t.submittedAt).not.toBeNull();
    expect(t.history.map((h: any) => [h.action, h.fromOffice, h.toOffice])).toEqual([
      ['CREATED', 'Scholarship Office', null],
      ['SUBMITTED', 'Scholarship Office', 'Accounting Office'],
    ]);
    // Destination office users are notified.
    expect(db.notification.map((n) => Buffer.from(n.user_id).equals(Buffer.from(uuidToBinary(users.accounting.id))))).toEqual([true]);
  });

  it('generates unique, sequential track numbers', async () => {
    const a = await createSubmitted();
    const b = await createSubmitted();
    expect(a.trackNumber).not.toBe(b.trackNumber);
    expect(b.trackNumber.endsWith('000002')).toBe(true);
  });

  it('ignores client-supplied status, office and actor fields', async () => {
    const res = await as('coordinator')(request(app).post(BASE)).send({
      ...payload(), status: 'DONE', currentOfficeId: ids.treasury, created_by: users.admin.id, trackNumber: 'DTS-HACK',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'DRAFT', currentOfficeId: null });
    expect(res.body.data.createdBy.userId).toBe(users.coordinator.id);
    expect(res.body.data.trackNumber).not.toBe('DTS-HACK');
  });

  it.each([
    ['title', { title: '' }],
    ['particulars', { particulars: '   ' }],
    ['processTypeId', { processTypeId: 'nope' }],
    ['purposeId', { purposeId: undefined }],
    ['sponsorshipId', { sponsorshipId: undefined }],
  ])('rejects a missing/invalid %s', async (_field, overrides) => {
    const res = await as('coordinator')(request(app).post(BASE)).send(payload(overrides));
    expect(res.status).toBe(400);
    expect(db.dtsTrack).toHaveLength(0);
  });

  it('requires a destination when submitting', async () => {
    const res = await as('coordinator')(request(app).post(BASE)).send(payload({ submit: true, destinationId: undefined }));
    expect(res.status).toBe(400);
  });

  it('rejects an inactive destination office', async () => {
    const res = await as('coordinator')(request(app).post(BASE)).send(payload({ submit: true, destinationId: ids.inactive }));
    expect(res.status).toBe(400);
    expect(res.body.message ?? JSON.stringify(res.body)).toContain('destinationId');
  });

  it('only lets coordinators/admins create tracks', async () => {
    const res = await as('accounting')(request(app).post(BASE)).send(payload());
    expect(res.status).toBe(400);
    expect(db.dtsTrack).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Draft editing & submission
// ---------------------------------------------------------------------------

describe('drafts', () => {
  it('lets the creator edit and then submit a draft to its intended destination', async () => {
    const draft = (await as('coordinator')(request(app).post(BASE)).send(payload())).body.data;

    const edited = await as('coordinator')(request(app).put(`${BASE}/${draft.id}`)).send(payload({ title: 'Edited title' }));
    expect(edited.status).toBe(200);
    expect(edited.body.data.title).toBe('Edited title');

    const submitted = await act('coordinator', draft.id, 'submit');
    expect(submitted.status).toBe(200);
    expect(submitted.body.data).toMatchObject({ status: 'SUBMITTED', currentHolder: 'Accounting Office' });
  });

  it('cannot submit a track twice', async () => {
    const t = await createSubmitted();
    const res = await act('coordinator', t.id, 'submit');
    expect(res.status).toBe(400);
  });

  it('keeps drafts private and non-actionable for receiving offices', async () => {
    const draft = (await as('coordinator')(request(app).post(BASE)).send(payload())).body.data;
    expect((await as('accounting')(request(app).get(`${BASE}/${draft.id}`))).status).toBe(400);
    expect((await act('accounting', draft.id, 'accept')).status).toBe(400);
  });

  it('does not let another user edit someone else\'s draft', async () => {
    const draft = (await as('coordinator')(request(app).post(BASE)).send(payload())).body.data;
    const res = await as('admin')(request(app).put(`${BASE}/${draft.id}`)).send(payload({ title: 'Hijack' }));
    expect(res.status).toBe(400);
    expect(db.dtsTrack[0].title).toBe(payload().title);
  });
});

// ---------------------------------------------------------------------------
// Receiver actions
// ---------------------------------------------------------------------------

describe('accept', () => {
  it('lets the destination office accept, moving it to IN_PROCESSED', async () => {
    const t = await createSubmitted();
    const res = await act('accounting', t.id, 'accept');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROCESSED');
    const last = res.body.data.history[res.body.data.history.length - 1];
    expect(last).toMatchObject({ action: 'ACCEPTED', fromOffice: 'Scholarship Office', toOffice: 'Accounting Office' });
    expect(last.actor.userId).toBe(users.accounting.id);
    expect(res.body.data.allowedActions).toEqual(['FORWARD', 'RETURN', 'DONE']);
  });

  it('rejects acceptance by a user of another office', async () => {
    const t = await createSubmitted();
    const res = await act('treasury', t.id, 'accept');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('You do not have access to this document track');
    expect(db.dtsTrack[0].status).toBe('SUBMITTED');
  });

  it('rejects acceptance by a user with no office (even a coordinator)', async () => {
    const t = await createSubmitted();
    expect((await act('admin', t.id, 'accept')).status).toBe(400);
  });
});

describe('forward', () => {
  it('requires a destination and remarks', async () => {
    const t = await createSubmitted();
    await act('accounting', t.id, 'accept');
    expect((await act('accounting', t.id, 'forward', { remarks: 'x' })).status).toBe(400);
    expect((await act('accounting', t.id, 'forward', { destinationId: ids.treasury })).status).toBe(400);
    expect((await act('accounting', t.id, 'forward', { destinationId: ids.treasury, remarks: '  ' })).status).toBe(400);
  });

  it('cannot forward to the office already holding the track', async () => {
    const t = await createSubmitted();
    await act('accounting', t.id, 'accept');
    expect((await act('accounting', t.id, 'forward', { destinationId: ids.accounting, remarks: 'loop' })).status).toBe(400);
  });

  it('moves the track to the destination office and records history', async () => {
    const t = await createSubmitted();
    await act('accounting', t.id, 'accept');
    const res = await act('accounting', t.id, 'forward', { destinationId: ids.treasury, remarks: 'For release' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'FORWARDED', currentHolder: 'Treasury Office' });
    const last = res.body.data.history[res.body.data.history.length - 1];
    expect(last).toMatchObject({ action: 'FORWARDED', fromOffice: 'Accounting Office', toOffice: 'Treasury Office', remarks: 'For release' });

    // Only the new holder may now act; the previous office can still view it.
    const stale = await act('accounting', t.id, 'accept');
    expect(stale.status).toBe(400);
    expect(JSON.stringify(stale.body)).toContain('office currently holding');
    expect((await as('accounting')(request(app).get(`${BASE}/${t.id}`))).status).toBe(200);
    expect((await act('treasury', t.id, 'accept')).body.data.status).toBe('IN_PROCESSED');
  });

  it('cannot forward before accepting', async () => {
    const t = await createSubmitted();
    expect((await act('accounting', t.id, 'forward', { destinationId: ids.treasury, remarks: 'x' })).status).toBe(400);
  });
});

describe('return', () => {
  it('requires a reason', async () => {
    const t = await createSubmitted();
    expect((await act('accounting', t.id, 'return', {})).status).toBe(400);
  });

  it('returns to the office that sent it, which then re-accepts', async () => {
    const t = await createSubmitted();
    await act('accounting', t.id, 'accept');
    await act('accounting', t.id, 'forward', { destinationId: ids.treasury, remarks: 'For release' });
    await act('treasury', t.id, 'accept');

    const res = await act('treasury', t.id, 'return', { remarks: 'Missing signatures' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'RETURNED', currentHolder: 'Accounting Office' });
    const last = res.body.data.history[res.body.data.history.length - 1];
    expect(last).toMatchObject({ action: 'RETURNED', fromOffice: 'Treasury Office', toOffice: 'Accounting Office', remarks: 'Missing signatures' });

    // Treasury no longer holds it; Accounting acknowledges and carries on.
    expect((await act('treasury', t.id, 'accept')).status).toBe(400);
    const reaccepted = await act('accounting', t.id, 'accept');
    expect(reaccepted.body.data.status).toBe('IN_PROCESSED');
  });

  it('returns all the way to the origin, where the creator edits and resubmits', async () => {
    const t = await createSubmitted();
    const res = await act('accounting', t.id, 'return', { remarks: 'Incomplete requirements' });

    expect(res.body.data).toMatchObject({ status: 'RETURNED', currentHolder: 'Scholarship Office' });
    expect(res.body.data.allowedActions).toEqual([]); // accounting's view

    const creatorView = (await as('coordinator')(request(app).get(`${BASE}/${t.id}`))).body.data;
    expect(creatorView.allowedActions).toEqual(['EDIT', 'SUBMIT']);

    expect((await as('coordinator')(request(app).put(`${BASE}/${t.id}`)).send(payload({ particulars: 'Now complete' }))).status).toBe(200);
    const resubmitted = await act('coordinator', t.id, 'submit');
    expect(resubmitted.body.data).toMatchObject({ status: 'SUBMITTED', currentHolder: 'Accounting Office', particulars: 'Now complete' });
    // First submission date is preserved.
    expect(resubmitted.body.data.submittedAt).toBe(t.submittedAt);
    expect(resubmitted.body.data.history.map((h: any) => h.action)).toEqual(['CREATED', 'SUBMITTED', 'RETURNED', 'SUBMITTED']);
  });

  it('is not allowed on a forwarded track that has not been accepted', async () => {
    const t = await createSubmitted();
    await act('accounting', t.id, 'accept');
    await act('accounting', t.id, 'forward', { destinationId: ids.treasury, remarks: 'x' });
    expect((await act('treasury', t.id, 'return', { remarks: 'x' })).status).toBe(400);
  });
});

describe('done', () => {
  it('requires final remarks', async () => {
    const t = await createSubmitted();
    await act('accounting', t.id, 'accept');
    expect((await act('accounting', t.id, 'done', {})).status).toBe(400);
  });

  it('completes the track and locks it against further movement', async () => {
    const t = await createSubmitted();
    await act('accounting', t.id, 'accept');
    const res = await act('accounting', t.id, 'done', { remarks: 'Processed and released to Treasury' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DONE');
    expect(res.body.data.completedAt).not.toBeNull();
    expect(res.body.data.allowedActions).toEqual([]);

    for (const [action, body] of [
      ['forward', { destinationId: ids.treasury, remarks: 'x' }],
      ['return', { remarks: 'x' }],
      ['accept', {}],
      ['done', { remarks: 'again' }],
      ['submit', {}],
    ] as const) {
      expect((await act('accounting', t.id, action, body)).status).toBe(400);
    }
    expect((await as('coordinator')(request(app).put(`${BASE}/${t.id}`)).send(payload())).status).toBe(400);
    expect(db.dtsTrack[0].status).toBe('DONE');
  });

  it('cannot be marked done straight from SUBMITTED', async () => {
    const t = await createSubmitted();
    expect((await act('accounting', t.id, 'done', { remarks: 'x' })).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Authorization & visibility
// ---------------------------------------------------------------------------

describe('authorization', () => {
  it('hides tracks from offices that never handled them', async () => {
    const t = await createSubmitted();
    expect((await as('budget')(request(app).get(`${BASE}/${t.id}`))).status).toBe(400);
    expect((await as('budget')(request(app).get(`${BASE}/${t.id}/history`))).status).toBe(400);
    expect((await as('budget')(request(app).get(`${BASE}/${t.id}/pdf`))).status).toBe(400);
  });

  it('gives an uninvolved office a plain access error on actions, without revealing status', async () => {
    const t = await createSubmitted();
    await act('accounting', t.id, 'accept');
    await act('accounting', t.id, 'forward', { destinationId: ids.treasury, remarks: 'x' });

    const res = await act('budget', t.id, 'done', { remarks: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.errorMessage).toBe('FORBIDDEN');
    expect(res.body.errorDetails).toBe('You do not have access to this document track');
  });

  it('rejects users with no office and no creator role', async () => {
    addUser('sponsor', 'Sponsor', null);
    expect((await as('sponsor')(request(app).get(BASE))).status).toBe(400);
  });

  it('requires authentication', async () => {
    expect((await request(app).get(BASE)).status).toBe(400);
  });

  it('never exposes a way to set status directly', async () => {
    const t = await createSubmitted();
    const res = await as('coordinator')(request(app).put(`${BASE}/${t.id}`)).send({ ...payload(), status: 'DONE' });
    // Submitted tracks aren't editable at all, and status isn't an editable field.
    expect(res.status).toBe(400);
    expect(db.dtsTrack[0].status).toBe('SUBMITTED');
  });
});

describe('students (grantees)', () => {
  const fullJourney = async () => {
    const t = await createSubmitted();
    await act('accounting', t.id, 'accept', { remarks: 'Internal: checked by Ana' });
    await act('accounting', t.id, 'forward', { destinationId: ids.treasury, remarks: 'Internal: for release' });
    return t;
  };

  it('lets a grantee follow a track of their sponsorship, without remarks or staff names', async () => {
    const t = await fullJourney();
    const res = await as('grantee')(request(app).get(`${BASE}/${t.id}`));

    expect(res.status).toBe(200);
    const v = res.body.data;
    expect(v).toMatchObject({ status: 'FORWARDED', currentHolder: 'Treasury Office', createdBy: null, allowedActions: [] });
    expect(v.history.map((h: any) => [h.action, h.fromOffice, h.toOffice])).toEqual([
      ['CREATED', 'Scholarship Office', null],
      ['SUBMITTED', 'Scholarship Office', 'Accounting Office'],
      ['ACCEPTED', 'Scholarship Office', 'Accounting Office'],
      ['FORWARDED', 'Accounting Office', 'Treasury Office'],
    ]);
    expect(v.history.every((h: any) => h.remarks === null && h.actor === null)).toBe(true);
    expect(JSON.stringify(v)).not.toContain('Internal:');
    expect(JSON.stringify(v)).not.toContain('coordinator User');

    const history = await as('grantee')(request(app).get(`${BASE}/${t.id}/history`));
    expect(history.body.data.every((h: any) => h.remarks === null && h.actor === null)).toBe(true);
  });

  it('staff still see remarks and names on the same track', async () => {
    const t = await fullJourney();
    const res = await as('coordinator')(request(app).get(`${BASE}/${t.id}`));
    expect(res.body.data.createdBy).not.toBeNull();
    expect(res.body.data.history[2].remarks).toBe('Internal: checked by Ana');
  });

  it('scopes a grantee list to their sponsorships and never includes drafts', async () => {
    await fullJourney();
    const res = await as('grantee')(request(app).get(BASE));
    expect(res.status).toBe(200);
    const calls = __mockPrisma.dtsTrack.findMany.mock.calls;
    const where = calls[calls.length - 1][0].where;
    const visibility = where.AND[0];
    expect(visibility.status).toEqual({ not: 'DRAFT' });
    expect(visibility.sponsorship_id.in.map((b: any) => Buffer.from(b).toString('hex')))
      .toEqual([Buffer.from(uuidToBinary(ids.sponsorship)).toString('hex')]);
  });

  it('gives a student with no grant an empty list, not an error', async () => {
    await fullJourney();
    const res = await as('student')(request(app).get(BASE));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ data: [], total: 0 });
  });

  it('blocks non-grantees and drafts', async () => {
    const t = await fullJourney();
    expect((await as('rejected')(request(app).get(`${BASE}/${t.id}`))).status).toBe(400);
    expect((await as('student')(request(app).get(`${BASE}/${t.id}`))).status).toBe(400);

    const draft = (await as('coordinator')(request(app).post(BASE)).send(payload())).body.data;
    expect((await as('grantee')(request(app).get(`${BASE}/${draft.id}`))).status).toBe(400);
  });

  it('is read-only for grantees', async () => {
    const t = await createSubmitted();
    for (const [action, body] of [
      ['accept', {}], ['return', { remarks: 'x' }], ['submit', {}],
    ] as const) {
      expect((await act('grantee', t.id, action, body)).status).toBe(400);
    }
    expect((await as('grantee')(request(app).post(BASE)).send(payload())).status).toBe(400);
    expect(db.dtsTrack[0].status).toBe('SUBMITTED');
  });

  it('prints a redacted PDF for a grantee', async () => {
    const t = await fullJourney();
    const res = await as('grantee')(request(app).get(`${BASE}/${t.id}/pdf`));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });

  it('notifies grantees only when the track is done', async () => {
    const t = await fullJourney();
    const granteeBin = Buffer.from(uuidToBinary(users.grantee.id));
    const forGrantee = () => db.notification.filter((n) => Buffer.from(n.user_id).equals(granteeBin));
    expect(forGrantee()).toHaveLength(0);

    await act('treasury', t.id, 'accept');
    await act('treasury', t.id, 'done', { remarks: 'Released' });

    expect(forGrantee()).toHaveLength(1);
    expect(forGrantee()[0]).toMatchObject({ title: 'Document processing completed', type: 'document' });
    expect(forGrantee()[0].message).not.toContain('Released');
    // The rejected applicant is not a grantee.
    const rejectedBin = Buffer.from(uuidToBinary(users.rejected.id));
    expect(db.notification.some((n) => Buffer.from(n.user_id).equals(rejectedBin))).toBe(false);
  });
});

describe('concurrency', () => {
  it('lets only one of two simultaneous accepts win', async () => {
    const t = await createSubmitted();
    addUser('accounting2', 'DTS Officer', ids.accounting);

    const [a, b] = await Promise.all([act('accounting', t.id, 'accept'), act('accounting2', t.id, 'accept')]);

    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect(db.dtsTrackHistory.filter((h) => h.action === 'ACCEPTED')).toHaveLength(1);
  });

  it('rejects a write whose read was overtaken by another transition', async () => {
    const t = await createSubmitted();
    // Another user's accept commits between this request's read and its write.
    const original = __mockPrisma.dtsTrack.updateMany.getMockImplementation();
    __mockPrisma.dtsTrack.updateMany.mockImplementationOnce(async (args: any) => {
      Object.assign(db.dtsTrack[0], { status: 'IN_PROCESSED', version: db.dtsTrack[0].version + 1 });
      return original(args);
    });

    const res = await act('accounting', t.id, 'accept');

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('updated by someone else');
    expect(db.dtsTrackHistory.filter((h) => h.action === 'ACCEPTED')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// List, history, PDF
// ---------------------------------------------------------------------------

describe('GET /document-tracks', () => {
  it('scopes office users to their office and validates filters', async () => {
    await createSubmitted();
    const res = await as('accounting')(request(app).get(BASE).query({ status: 'SUBMITTED', inbox: 'true' }));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);

    const where = __mockPrisma.dtsTrack.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('current_office_id');
    expect(where.AND).toEqual(expect.arrayContaining([{ status: 'SUBMITTED' }]));

    expect((await as('accounting')(request(app).get(BASE).query({ status: 'BOGUS' }))).status).toBe(400);
  });
});

describe('history and PDF', () => {
  it('returns the persisted, ordered history', async () => {
    const t = await createSubmitted();
    await act('accounting', t.id, 'accept');
    const res = await as('coordinator')(request(app).get(`${BASE}/${t.id}/history`));
    expect(res.status).toBe(200);
    expect(res.body.data.map((h: any) => h.sequence)).toEqual([1, 2, 3]);
  });

  it('renders a PDF for a submitted track', async () => {
    const t = await createSubmitted();
    await act('accounting', t.id, 'accept');

    const res = await as('coordinator')(request(app).get(`${BASE}/${t.id}/pdf`))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const pdf: Buffer = res.body;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain(t.trackNumber);
  });

  it('refuses to print a draft', async () => {
    const draft = (await as('coordinator')(request(app).post(BASE)).send(payload())).body.data;
    expect((await as('coordinator')(request(app).get(`${BASE}/${draft.id}/pdf`))).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Setup Manager
// ---------------------------------------------------------------------------

describe('setup manager', () => {
  it('lists active destination offices for dropdowns', async () => {
    const res = await as('accounting')(request(app).get(`${BASE}/setup/offices`).query({ active: 'true' }));
    expect(res.status).toBe(200);
    expect(res.body.data.data.map((o: any) => o.name)).not.toContain('Closed Office');
  });

  it('creates, renames and soft-deletes a process type', async () => {
    const created = await as('admin')(request(app).post(`${BASE}/setup/process-types`)).send({ name: 'For Liquidation' });
    expect(created.status).toBe(201);
    expect((await as('admin')(request(app).post(`${BASE}/setup/process-types`)).send({ name: 'For Liquidation' })).status).toBe(400);

    const id = created.body.data.id;
    const renamed = await as('admin')(request(app).put(`${BASE}/setup/process-types/${id}`)).send({ name: 'For Liquidation Review', isActive: false });
    expect(renamed.body.data).toMatchObject({ name: 'For Liquidation Review', isActive: false });

    expect((await as('admin')(request(app).delete(`${BASE}/setup/process-types/${id}`))).status).toBe(200);
    expect(db.dtsProcessType.find((r) => r.name === 'For Liquidation Review')!.record_status).toBe(false);
  });

  it('blocks deleting an office that still holds open tracks', async () => {
    await createSubmitted();
    const res = await as('admin')(request(app).delete(`${BASE}/setup/offices/${ids.accounting}`));
    expect(res.status).toBe(400);
    expect(db.dtsOffice.find((o) => o.name === 'Accounting Office')!.record_status).toBe(true);
  });

  it('only lets setup roles change configuration', async () => {
    expect((await as('accounting')(request(app).post(`${BASE}/setup/purposes`)).send({ name: 'X' })).status).toBe(400);
  });

  it('assigns a user to an office (admin only)', async () => {
    const res = await as('admin')(request(app).put(`${BASE}/setup/user-offices/${users.student.id}`)).send({ officeId: ids.budget });
    expect(res.status).toBe(200);
    expect(res.body.data.officeName).toBe('Budget Office');

    expect((await as('coordinator')(request(app).put(`${BASE}/setup/user-offices/${users.student.id}`)).send({ officeId: null })).status).toBe(400);
    expect((await as('admin')(request(app).put(`${BASE}/setup/user-offices/${users.student.id}`)).send({ officeId: ids.inactive })).status).toBe(400);
  });

  it('reports the current DTS user', async () => {
    const res = await as('accounting')(request(app).get(`${BASE}/me`));
    expect(res.body.data).toMatchObject({ userId: users.accounting.id, officeName: 'Accounting Office', canCreate: false });
  });
});
