import { Prisma, PrismaClient } from "@prisma/client";
import { RecordStatus, TRACK_HISTORY_ACTION, uuidToBinary } from "../utils";

// Raw Prisma access for the Document Tracking System. Every function takes the
// client explicitly so the service can pass an interactive-transaction client
// (`tx`) for state-changing operations. `where` clauses for list queries are
// assembled in the service.

type Db = PrismaClient | Prisma.TransactionClient;
export type Bin = Uint8Array<ArrayBuffer>;

// Setup Manager lookups share one shape, so they share one set of queries.
export type SetupModel = "dtsProcessType" | "dtsPurpose" | "dtsOffice";

const setupDelegate = (db: Db, model: SetupModel): any => (db as any)[model];

// ---------------------------------------------------------------- setup

export const listSetupRepo = async (
  db: Db,
  model: SetupModel,
  where: any,
  offset: number,
  limit: number,
) => {
  const delegate = setupDelegate(db, model);
  const [data, total] = await Promise.all([
    delegate.findMany({
      where,
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      skip: offset,
      take: limit,
    }),
    delegate.count({ where }),
  ]);
  return { data, total };
};

export const findSetupByIdRepo = (db: Db, model: SetupModel, id: string) =>
  setupDelegate(db, model).findFirst({
    where: { id: uuidToBinary(id), record_status: RecordStatus.ACTIVE },
  });

// Includes soft-deleted rows: `name` is globally unique in the table.
export const findSetupByNameRepo = (db: Db, model: SetupModel, name: string) =>
  setupDelegate(db, model).findFirst({ where: { name } });

export const findActiveSetupRepo = (db: Db, model: SetupModel, id: string) =>
  setupDelegate(db, model).findFirst({
    where: { id: uuidToBinary(id), record_status: RecordStatus.ACTIVE, is_active: true },
  });

export const createSetupRepo = (db: Db, model: SetupModel, data: any) =>
  setupDelegate(db, model).create({ data });

export const updateSetupRepo = (db: Db, model: SetupModel, id: Bin, data: any) =>
  setupDelegate(db, model).update({ where: { id }, data });

// Tracks an office is still holding. Used to block deleting such an office.
export const countOpenTracksAtOfficeRepo = (db: Db, officeId: string) =>
  db.dtsTrack.count({
    where: {
      current_office_id: uuidToBinary(officeId),
      record_status: RecordStatus.ACTIVE,
      status: { notIn: ["DRAFT", "DONE"] },
    },
  });

// ---------------------------------------------------------------- users

export const findActorRepo = (db: Db, userId: string) =>
  db.user.findUnique({
    where: { id: uuidToBinary(userId) },
    include: { role: true, dtsOffice: true },
  });

export const findUserRepo = (db: Db, userId: string) =>
  db.user.findFirst({
    where: { id: uuidToBinary(userId), record_status: RecordStatus.ACTIVE },
  });

export const listOfficeUsersRepo = (db: Db, officeId: string) =>
  db.user.findMany({
    where: { dts_office_id: uuidToBinary(officeId), record_status: RecordStatus.ACTIVE },
    include: { role: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });

export const setUserOfficeRepo = (db: Db, userId: string, officeId: string | null) =>
  db.user.update({
    where: { id: uuidToBinary(userId) },
    data: { dts_office_id: officeId ? uuidToBinary(officeId) : null },
    include: { role: true, dtsOffice: true },
  });

// ---------------------------------------------------------------- tracks

// Atomically claims the next number for `year`. Inside an interactive
// transaction the UPDATE holds the row lock until commit, so concurrent
// creators serialize on it.
export const nextTrackSequenceRepo = async (db: Db, year: number): Promise<number> => {
  const row = await db.dtsSequence.upsert({
    where: { year },
    create: { year, last_value: 1 },
    update: { last_value: { increment: 1 } },
  });
  return row.last_value;
};

export const trackInclude = {
  processType: true,
  purpose: true,
  sponsorship: { select: { id: true, name: true, batch_number: true } },
  originOffice: true,
  currentOffice: true,
  intendedDestination: true,
  creator: { select: { id: true, first_name: true, last_name: true } },
} satisfies Prisma.dtsTrackInclude;

export const createTrackRepo = (db: Db, data: Prisma.dtsTrackUncheckedCreateInput) =>
  db.dtsTrack.create({ data });

export const findTrackRepo = (db: Db, trackId: string, withHistory = false) =>
  db.dtsTrack.findFirst({
    where: { id: uuidToBinary(trackId), record_status: RecordStatus.ACTIVE },
    include: {
      ...trackInclude,
      ...(withHistory ? { history: { orderBy: { sequence: "asc" as const } } } : {}),
    },
  });

export const listTracksRepo = async (
  db: Db,
  where: Prisma.dtsTrackWhereInput,
  offset: number,
  limit: number,
  sort: "asc" | "desc",
) => {
  const [data, total] = await Promise.all([
    db.dtsTrack.findMany({
      where,
      include: trackInclude,
      orderBy: { created_at: sort },
      skip: offset,
      take: limit,
    }),
    db.dtsTrack.count({ where }),
  ]);
  return { data, total };
};

// Compare-and-set update: only applies if the track is still in the status and
// version the caller read. Returns the number of rows changed (0 = someone else
// moved the track first).
export const updateTrackGuardedRepo = async (
  db: Db,
  id: Bin,
  expected: { status: any; version: number },
  data: Prisma.dtsTrackUncheckedUpdateManyInput,
): Promise<number> => {
  const result = await db.dtsTrack.updateMany({
    where: { id, status: expected.status, version: expected.version, record_status: RecordStatus.ACTIVE },
    data,
  });
  return result.count;
};

export const createHistoryRepo = (db: Db, data: Prisma.dtsTrackHistoryUncheckedCreateInput) =>
  db.dtsTrackHistory.create({ data });

export const listHistoryRepo = (db: Db, trackId: Bin) =>
  db.dtsTrackHistory.findMany({
    where: { track_id: trackId },
    orderBy: { sequence: "asc" },
  });

// The most recent movement INTO `officeId` (a submit or forward). Its sender is
// where a RETURN from that office goes back to.
export const findLatestInboundRepo = (db: Db, trackId: Bin, officeId: Bin) =>
  db.dtsTrackHistory.findFirst({
    where: {
      track_id: trackId,
      to_office_id: officeId,
      action: { in: [TRACK_HISTORY_ACTION.SUBMITTED, TRACK_HISTORY_ACTION.FORWARDED] },
    },
    orderBy: { sequence: "desc" },
  });

// ---------------------------------------------------------------- students

// Sponsorships in which this user's student record is a grantee. A student may
// view (read-only) the tracks of these sponsorships.
export const findGranteeSponsorshipIdsRepo = async (db: Db, userId: string, statuses: string[]): Promise<Bin[]> => {
  const rows = await db.sponsorshipApplication.findMany({
    where: {
      record_status: RecordStatus.ACTIVE,
      application_status: { in: statuses as any },
      student: { user_id: uuidToBinary(userId), record_status: RecordStatus.ACTIVE },
    },
    select: { sponsorship_id: true },
  });
  return rows.map((r) => r.sponsorship_id as Bin);
};

// User ids of every grantee of a sponsorship, for completion notifications.
export const listGranteeUserIdsRepo = async (db: Db, sponsorshipId: Bin, statuses: string[]): Promise<Bin[]> => {
  const rows = await db.sponsorshipApplication.findMany({
    where: {
      sponsorship_id: sponsorshipId,
      record_status: RecordStatus.ACTIVE,
      application_status: { in: statuses as any },
      student: { record_status: RecordStatus.ACTIVE },
    },
    select: { student: { select: { user_id: true } } },
  });
  return rows.map((r) => r.student.user_id as Bin);
};

export const findActiveSponsorshipRepo = (db: Db, sponsorshipId: string) =>
  db.sponsorship.findFirst({
    where: { id: uuidToBinary(sponsorshipId), record_status: RecordStatus.ACTIVE },
    select: { id: true, name: true },
  });
