import { Prisma, PrismaClient } from "@prisma/client";
import {
  binaryToUuid,
  DTS_CREATOR_ROLES,
  DTS_TRACK_NUMBER_PREFIX,
  extractUserFromToken,
  QueryParams,
  RecordStatus,
  TRACK_ACTION,
  TRACK_HISTORY_ACTION,
  TRACK_STATUS,
  TrackAction,
  TrackHistoryAction,
  TrackStatus,
  uuidToBinary,
  VALIDATION_MESSAGES,
} from "../utils";
import { createNotificationsForUsers } from "../notification/service";
import {
  countOpenTracksAtOfficeRepo,
  createHistoryRepo,
  createSetupRepo,
  createTrackRepo,
  findActiveSetupRepo,
  findActiveSponsorshipRepo,
  findActorRepo,
  findLatestInboundRepo,
  findSetupByIdRepo,
  findSetupByNameRepo,
  findTrackRepo,
  findUserRepo,
  listHistoryRepo,
  listOfficeUsersRepo,
  listSetupRepo,
  listTracksRepo,
  nextTrackSequenceRepo,
  setUserOfficeRepo,
  Bin,
  SetupModel,
  updateSetupRepo,
  updateTrackGuardedRepo,
} from "./repository";

const prisma = new PrismaClient();

// Thrown for authorization failures so the controller can answer with
// ResponseHandler.forbidden instead of invalidRequest.
export class DtsForbiddenError extends Error {}

// ============================================================ types

export interface TrackActor {
  userId: string;
  name: string;
  office: string;
  officeId: string | null;
}

export interface TrackHistoryEntry {
  sequence: number;
  action: TrackHistoryAction;
  status: TrackStatus;
  fromOffice: string;
  fromOfficeId: string | null;
  toOffice: string | null;
  toOfficeId: string | null;
  remarks: string | null;
  actor: TrackActor;
  at: string;
}

export interface DocumentTrackResponse {
  id: string;
  trackNumber: string;
  title: string;
  particulars: string;
  processTypeId: string;
  processType: string;
  purposeId: string;
  purpose: string;
  sponsorshipId: string;
  sponsorshipName: string;
  status: TrackStatus;
  currentOfficeId: string | null;
  currentHolder: string;
  originOfficeId: string | null;
  originOffice: string | null;
  intendedDestinationId: string | null;
  intendedDestination: string | null;
  createdBy: { userId: string; name: string };
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  allowedActions: TrackAction[];
  history?: TrackHistoryEntry[];
}

export interface DocumentTrackPayload {
  title: string;
  particulars: string;
  processTypeId: string;
  purposeId: string;
  sponsorshipId: string;
  destinationId?: string | null;
  submit?: boolean;
}

export interface ReceiverActionFields {
  destinationId?: string;
  remarks?: string;
}

export interface TrackListFilters {
  processTypeId?: string;
  purposeId?: string;
  currentOfficeId?: string;
  createdFrom?: string;
  createdTo?: string;
  submittedFrom?: string;
  submittedTo?: string;
  inbox?: boolean;
}

// Authenticated user, resolved server-side from the JWT. Never taken from the
// request body, so history actors cannot be forged.
interface Actor {
  userId: string;
  userIdBin: Bin;
  name: string;
  role: string;
  officeId: string | null;
  officeName: string | null;
  isCreatorRole: boolean;
}

// ============================================================ workflow rules

// Which actions each status permits. Who may perform them is checked
// separately in assertCanPerform.
const TRANSITIONS: Record<TrackStatus, TrackAction[]> = {
  DRAFT: [TRACK_ACTION.EDIT, TRACK_ACTION.SUBMIT],
  SUBMITTED: [TRACK_ACTION.ACCEPT, TRACK_ACTION.RETURN],
  IN_PROCESSED: [TRACK_ACTION.FORWARD, TRACK_ACTION.RETURN, TRACK_ACTION.DONE],
  FORWARDED: [TRACK_ACTION.ACCEPT],
  // Returned to the origin: the creator side edits/resubmits. Returned to an
  // intermediate office: that office acknowledges it and carries on.
  RETURNED: [TRACK_ACTION.EDIT, TRACK_ACTION.SUBMIT, TRACK_ACTION.ACCEPT],
  DONE: [],
};

const sameId = (a?: Bin | null, b?: Bin | null) => {
  if (!a || !b) return !a && !b;
  return Buffer.from(a).equals(Buffer.from(b));
};

// A returned track is "back at origin" once it sits with the office it was
// created from (or with the creator directly, if they had no office).
const isAtOrigin = (track: any) =>
  track.status === TRACK_STATUS.RETURNED && sameId(track.current_office_id, track.origin_office_id);

const isCreator = (track: any, actor: Actor) => sameId(track.created_by, actor.userIdBin);

const isHolder = (track: any, actor: Actor) =>
  !!track.current_office_id && !!actor.officeId && sameId(track.current_office_id, uuidToBinary(actor.officeId));

// Creator-side authority: the creator always; users of the origin office too
// once a track has been returned all the way back.
const isOriginSide = (track: any, actor: Actor) => {
  if (isCreator(track, actor)) return true;
  return track.status === TRACK_STATUS.RETURNED && !!track.origin_office_id && isHolder(track, actor);
};

const canPerform = (track: any, actor: Actor, action: TrackAction): boolean => {
  if (!TRANSITIONS[track.status as TrackStatus].includes(action)) return false;

  switch (action) {
    case TRACK_ACTION.EDIT:
    case TRACK_ACTION.SUBMIT:
      if (track.status === TRACK_STATUS.DRAFT) return isCreator(track, actor);
      return isAtOrigin(track) && isOriginSide(track, actor);
    case TRACK_ACTION.ACCEPT:
      if (track.status === TRACK_STATUS.RETURNED && isAtOrigin(track)) return false;
      return isHolder(track, actor);
    default:
      return isHolder(track, actor);
  }
};

const assertCanPerform = (track: any, actor: Actor, action: TrackAction) => {
  if (canPerform(track, actor, action)) return;
  if (!TRANSITIONS[track.status as TrackStatus].includes(action)
    || (action === TRACK_ACTION.ACCEPT && isAtOrigin(track))
    || ((action === TRACK_ACTION.EDIT || action === TRACK_ACTION.SUBMIT)
        && track.status === TRACK_STATUS.RETURNED && !isAtOrigin(track))) {
    throw new Error(VALIDATION_MESSAGES.DTS_ACTION_NOT_ALLOWED);
  }
  if (action === TRACK_ACTION.EDIT || action === TRACK_ACTION.SUBMIT) {
    throw new DtsForbiddenError(VALIDATION_MESSAGES.DTS_NOT_CREATOR);
  }
  throw new DtsForbiddenError(
    actor.officeId ? VALIDATION_MESSAGES.DTS_NOT_YOUR_OFFICE : VALIDATION_MESSAGES.DTS_NO_OFFICE,
  );
};

const allowedActionsFor = (track: any, actor: Actor): TrackAction[] =>
  TRANSITIONS[track.status as TrackStatus].filter((a) => canPerform(track, actor, a));

// ============================================================ helpers

const fullName = (u: { first_name?: string; last_name?: string } | null | undefined) =>
  u ? [u.first_name, u.last_name].filter(Boolean).join(" ") : "";

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

const idOrNull = (b: Bin | null | undefined) => (b ? binaryToUuid(b) : null);

const formatTrackNumber = (year: number, seq: number) =>
  `${DTS_TRACK_NUMBER_PREFIX}-${year}-${String(seq).padStart(6, "0")}`;

const loadActor = async (authHeader: string): Promise<Actor> => {
  const { userId } = extractUserFromToken(authHeader);
  const user: any = await findActorRepo(prisma, userId);
  if (!user || user.record_status === RecordStatus.DELETED) {
    throw new DtsForbiddenError(VALIDATION_MESSAGES.USER_NOT_FOUND);
  }
  const role = (user.role?.name ?? "").toLowerCase();
  const office = user.dtsOffice && user.dtsOffice.record_status !== RecordStatus.DELETED ? user.dtsOffice : null;
  return {
    userId,
    userIdBin: uuidToBinary(userId),
    name: fullName(user),
    role,
    officeId: office ? binaryToUuid(office.id) : null,
    officeName: office?.name ?? null,
    isCreatorRole: DTS_CREATOR_ROLES.includes(role),
  };
};

const assertCanView = async (track: any, actor: Actor, db: any = prisma) => {
  if (isCreator(track, actor)) return;
  if (track.status === TRACK_STATUS.DRAFT) {
    throw new DtsForbiddenError(VALIDATION_MESSAGES.DTS_VIEW_FORBIDDEN);
  }
  if (actor.isCreatorRole) return;
  if (!actor.officeId) throw new DtsForbiddenError(VALIDATION_MESSAGES.DTS_NO_OFFICE);
  if (isHolder(track, actor)) return;

  const office = uuidToBinary(actor.officeId);
  const history = track.history ?? (await listHistoryRepo(db, track.id));
  const involved = history.some(
    (h: any) => sameId(h.from_office_id, office) || sameId(h.to_office_id, office),
  );
  if (!involved) throw new DtsForbiddenError(VALIDATION_MESSAGES.DTS_VIEW_FORBIDDEN);
};

const toHistoryEntry = (h: any): TrackHistoryEntry => ({
  sequence: h.sequence,
  action: h.action,
  status: h.status,
  fromOffice: h.from_office_name ?? "",
  fromOfficeId: idOrNull(h.from_office_id),
  toOffice: h.to_office_name ?? null,
  toOfficeId: idOrNull(h.to_office_id),
  remarks: h.remarks ?? null,
  actor: {
    userId: binaryToUuid(h.actor_user_id),
    name: h.actor_name,
    office: h.actor_office_name ?? "",
    officeId: idOrNull(h.actor_office_id),
  },
  at: iso(h.created_at),
});

const toTrackResponse = (track: any, actor: Actor): DocumentTrackResponse => {
  const creatorName = fullName(track.creator);
  const response: DocumentTrackResponse = {
    id: binaryToUuid(track.id),
    trackNumber: track.track_number,
    title: track.title,
    particulars: track.particulars,
    processTypeId: binaryToUuid(track.process_type_id),
    processType: track.processType?.name ?? null,
    purposeId: binaryToUuid(track.purpose_id),
    purpose: track.purpose?.name ?? null,
    sponsorshipId: binaryToUuid(track.sponsorship_id),
    sponsorshipName: track.sponsorship?.name ?? null,
    status: track.status,
    currentOfficeId: idOrNull(track.current_office_id),
    // With no office (a draft, or returned to an office-less creator) the
    // document is physically with its creator.
    currentHolder: track.currentOffice?.name ?? creatorName,
    originOfficeId: idOrNull(track.origin_office_id),
    originOffice: track.originOffice?.name ?? null,
    intendedDestinationId: idOrNull(track.intended_destination_id),
    intendedDestination: track.intendedDestination?.name ?? null,
    createdBy: { userId: binaryToUuid(track.created_by), name: creatorName },
    createdAt: iso(track.created_at),
    submittedAt: iso(track.submitted_at),
    completedAt: iso(track.completed_at),
    allowedActions: allowedActionsFor(track, actor),
  };
  if (track.history) response.history = track.history.map(toHistoryEntry);
  return response;
};

const historyActorFields = (actor: Actor) => ({
  actor_user_id: actor.userIdBin,
  actor_name: actor.name,
  actor_office_id: actor.officeId ? uuidToBinary(actor.officeId) : null,
  actor_office_name: actor.officeName,
});

const loadActiveOffice = async (db: any, officeId: string) => {
  const office = await findActiveSetupRepo(db, "dtsOffice", officeId);
  if (!office) throw new Error(VALIDATION_MESSAGES.DTS_DESTINATION_INVALID);
  return office;
};

const assertLookups = async (db: any, payload: DocumentTrackPayload) => {
  const [processType, purpose, sponsorship] = await Promise.all([
    findActiveSetupRepo(db, "dtsProcessType", payload.processTypeId),
    findActiveSetupRepo(db, "dtsPurpose", payload.purposeId),
    findActiveSponsorshipRepo(db, payload.sponsorshipId),
  ]);
  if (!processType) throw new Error(VALIDATION_MESSAGES.DTS_PROCESS_TYPE_INVALID);
  if (!purpose) throw new Error(VALIDATION_MESSAGES.DTS_PURPOSE_INVALID);
  if (!sponsorship) throw new Error(VALIDATION_MESSAGES.SPONSORSHIP_ID_NOT_FOUND);
};

const isUniqueViolation = (err: any) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

// Runs `fn` in a transaction, retrying on unique-key races (e.g. two
// first-of-the-year track numbers or two history appends at the same
// sequence). Retries re-read state, so a lost race surfaces as a conflict.
const withTransaction = async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 3): Promise<T> => {
  for (let i = 1; ; i++) {
    try {
      return await prisma.$transaction(fn);
    } catch (err) {
      if (isUniqueViolation(err) && i < attempts) continue;
      if (isUniqueViolation(err)) throw new Error(VALIDATION_MESSAGES.DTS_CONFLICT);
      throw err;
    }
  }
};

// Office-scoped notifications. Best-effort: a notification failure must never
// roll back or fail a committed workflow action.
const notifyOffice = async (officeId: Bin | null, fallbackUserId: Bin, title: string, message: string, trackId: string) => {
  try {
    const recipients = officeId
      ? (await listOfficeUsersRepo(prisma, binaryToUuid(officeId))).map((u: any) => binaryToUuid(u.id))
      : [binaryToUuid(fallbackUserId)];
    if (recipients.length) {
      await createNotificationsForUsers(recipients, title, message, "document", trackId);
    }
  } catch (err) {
    console.error("DTS notification failed:", err);
  }
};

// ============================================================ current user

export const getCurrentDtsUser = async (authHeader: string) => {
  const actor = await loadActor(authHeader);
  return {
    userId: actor.userId,
    name: actor.name,
    userType: actor.role,
    officeId: actor.officeId,
    officeName: actor.officeName,
    canCreate: actor.isCreatorRole,
  };
};

// ============================================================ tracks: read

export const getTracks = async (authHeader: string, params: QueryParams, filters: TrackListFilters) => {
  const actor = await loadActor(authHeader);

  // Visibility: drafts are private to their creator. Creator roles see every
  // submitted track; office users see what their office holds or has handled.
  let visibility: Prisma.dtsTrackWhereInput;
  if (actor.isCreatorRole) {
    visibility = { OR: [{ status: { not: "DRAFT" } }, { created_by: actor.userIdBin }] };
  } else if (actor.officeId) {
    const office = uuidToBinary(actor.officeId);
    visibility = {
      OR: [
        { created_by: actor.userIdBin },
        { status: { not: "DRAFT" }, current_office_id: office },
        { history: { some: { OR: [{ from_office_id: office }, { to_office_id: office }] } } },
      ],
    };
  } else {
    throw new DtsForbiddenError(VALIDATION_MESSAGES.DTS_NO_OFFICE);
  }

  const and: Prisma.dtsTrackWhereInput[] = [visibility];
  if (params.search) {
    and.push({ OR: [{ track_number: { contains: params.search } }, { title: { contains: params.search } }] });
  }
  if (params.status) and.push({ status: params.status as any });
  if (params.sponsorshipId) and.push({ sponsorship_id: uuidToBinary(String(params.sponsorshipId)) });
  if (filters.processTypeId) and.push({ process_type_id: uuidToBinary(filters.processTypeId) });
  if (filters.purposeId) and.push({ purpose_id: uuidToBinary(filters.purposeId) });
  if (filters.currentOfficeId) and.push({ current_office_id: uuidToBinary(filters.currentOfficeId) });
  if (filters.createdFrom || filters.createdTo) {
    and.push({ created_at: { gte: filters.createdFrom ? new Date(filters.createdFrom) : undefined, lte: filters.createdTo ? new Date(filters.createdTo) : undefined } });
  }
  if (filters.submittedFrom || filters.submittedTo) {
    and.push({ submitted_at: { gte: filters.submittedFrom ? new Date(filters.submittedFrom) : undefined, lte: filters.submittedTo ? new Date(filters.submittedTo) : undefined } });
  }
  // Inbox: tracks waiting on the caller's office right now.
  if (filters.inbox) {
    if (!actor.officeId) throw new DtsForbiddenError(VALIDATION_MESSAGES.DTS_NO_OFFICE);
    and.push({
      current_office_id: uuidToBinary(actor.officeId),
      status: { in: ["SUBMITTED", "FORWARDED", "IN_PROCESSED", "RETURNED"] },
    });
  }

  const where: Prisma.dtsTrackWhereInput = { record_status: RecordStatus.ACTIVE, AND: and };
  const sort = params.sort === "asc" ? "asc" : "desc";
  const { data, total } = await listTracksRepo(prisma, where, params.offset, params.limit, sort);
  return { data: data.map((t: any) => toTrackResponse(t, actor)), total };
};

const loadVisibleTrack = async (trackId: string, actor: Actor) => {
  const track: any = await findTrackRepo(prisma, trackId, true);
  if (!track) throw new Error(VALIDATION_MESSAGES.DTS_TRACK_NOT_FOUND);
  await assertCanView(track, actor);
  return track;
};

export const getTrack = async (trackId: string, authHeader: string) => {
  const actor = await loadActor(authHeader);
  return toTrackResponse(await loadVisibleTrack(trackId, actor), actor);
};

export const getTrackHistory = async (trackId: string, authHeader: string) => {
  const actor = await loadActor(authHeader);
  const track = await loadVisibleTrack(trackId, actor);
  return track.history.map(toHistoryEntry);
};

// For the PDF: the persisted track + history, after the same view checks.
export const getTrackForPrint = async (trackId: string, authHeader: string) => {
  const actor = await loadActor(authHeader);
  const track = await loadVisibleTrack(trackId, actor);
  if (track.status === TRACK_STATUS.DRAFT) throw new Error(VALIDATION_MESSAGES.DTS_NOT_SUBMITTED);
  return toTrackResponse(track, actor);
};

// ============================================================ tracks: write

export const createTrack = async (payload: DocumentTrackPayload, authHeader: string) => {
  const actor = await loadActor(authHeader);
  if (!actor.isCreatorRole) throw new DtsForbiddenError(VALIDATION_MESSAGES.DTS_NOT_CREATOR);

  const submit = payload.submit === true;
  if (submit && !payload.destinationId) throw new Error(VALIDATION_MESSAGES.DTS_DESTINATION_REQUIRED);

  const trackId = await withTransaction(async (tx) => {
    await assertLookups(tx, payload);
    const destination = payload.destinationId ? await loadActiveOffice(tx, payload.destinationId) : null;
    const originOfficeId = actor.officeId ? uuidToBinary(actor.officeId) : null;
    if (submit && sameId(destination.id, originOfficeId)) {
      throw new Error(VALIDATION_MESSAGES.DTS_DESTINATION_SAME_OFFICE);
    }

    const now = new Date();
    const year = now.getFullYear();
    const seq = await nextTrackSequenceRepo(tx, year);

    const track = await createTrackRepo(tx, {
      track_number: formatTrackNumber(year, seq),
      title: payload.title.trim(),
      particulars: payload.particulars.trim(),
      process_type_id: uuidToBinary(payload.processTypeId),
      purpose_id: uuidToBinary(payload.purposeId),
      sponsorship_id: uuidToBinary(payload.sponsorshipId),
      status: submit ? "SUBMITTED" : "DRAFT",
      origin_office_id: originOfficeId,
      current_office_id: submit ? destination.id : null,
      intended_destination_id: destination?.id ?? null,
      version: submit ? 2 : 1,
      submitted_at: submit ? now : null,
      created_by: actor.userIdBin,
    });

    await createHistoryRepo(tx, {
      track_id: track.id,
      sequence: 1,
      action: TRACK_HISTORY_ACTION.CREATED,
      status: TRACK_STATUS.DRAFT,
      from_office_id: originOfficeId,
      from_office_name: actor.officeName,
      to_office_id: null,
      to_office_name: null,
      remarks: null,
      created_at: now,
      ...historyActorFields(actor),
    });
    if (submit) {
      await createHistoryRepo(tx, {
        track_id: track.id,
        sequence: 2,
        action: TRACK_HISTORY_ACTION.SUBMITTED,
        status: TRACK_STATUS.SUBMITTED,
        from_office_id: originOfficeId,
        from_office_name: actor.officeName,
        to_office_id: destination.id,
        to_office_name: destination.name,
        remarks: null,
        created_at: now,
        ...historyActorFields(actor),
      });
    }
    return track.id;
  });

  const created = await findTrackRepo(prisma, binaryToUuid(trackId), true);
  if (submit) {
    await notifyOffice(created.current_office_id, actor.userIdBin, "Document received",
      `${created.track_number} "${created.title}" was submitted to your office.`, binaryToUuid(trackId));
  }
  return toTrackResponse(created, actor);
};

// Edit the document fields of a draft, or of a track returned to its origin.
// Status, office and history are never editable here.
export const updateTrack = async (trackId: string, payload: DocumentTrackPayload, authHeader: string) => {
  const actor = await loadActor(authHeader);

  await withTransaction(async (tx) => {
    const track: any = await findTrackRepo(tx, trackId);
    if (!track) throw new Error(VALIDATION_MESSAGES.DTS_TRACK_NOT_FOUND);
    assertCanPerform(track, actor, TRACK_ACTION.EDIT);
    await assertLookups(tx, payload);
    const destination = payload.destinationId ? await loadActiveOffice(tx, payload.destinationId) : null;

    const count = await updateTrackGuardedRepo(tx, track.id, { status: track.status, version: track.version }, {
      title: payload.title.trim(),
      particulars: payload.particulars.trim(),
      process_type_id: uuidToBinary(payload.processTypeId),
      purpose_id: uuidToBinary(payload.purposeId),
      sponsorship_id: uuidToBinary(payload.sponsorshipId),
      intended_destination_id: destination?.id ?? null,
      updated_by: actor.userIdBin,
    });
    if (count !== 1) throw new Error(VALIDATION_MESSAGES.DTS_CONFLICT);
  });

  return getTrack(trackId, authHeader);
};

// Discard an unsubmitted draft (soft delete). Drafts carry only their CREATED
// entry, so no movement history is lost.
export const deleteDraft = async (trackId: string, authHeader: string) => {
  const actor = await loadActor(authHeader);
  await withTransaction(async (tx) => {
    const track: any = await findTrackRepo(tx, trackId);
    if (!track) throw new Error(VALIDATION_MESSAGES.DTS_TRACK_NOT_FOUND);
    if (track.status !== TRACK_STATUS.DRAFT) throw new Error(VALIDATION_MESSAGES.DTS_ACTION_NOT_ALLOWED);
    if (!isCreator(track, actor)) throw new DtsForbiddenError(VALIDATION_MESSAGES.DTS_NOT_CREATOR);
    const count = await updateTrackGuardedRepo(tx, track.id, { status: track.status, version: track.version }, {
      record_status: RecordStatus.DELETED,
      updated_by: actor.userIdBin,
    });
    if (count !== 1) throw new Error(VALIDATION_MESSAGES.DTS_CONFLICT);
  });
};

interface TransitionPlan {
  status: TrackStatus;
  historyAction: TrackHistoryAction;
  from: { id: Bin | null; name: string | null };
  to: { id: Bin | null; name: string | null };
  currentOfficeId: Bin | null;
  remarks: string | null;
  extra?: Prisma.dtsTrackUncheckedUpdateManyInput;
}

// The single path every receiver/submit action goes through: read, authorize,
// plan, compare-and-set the track, append history — all in one transaction.
const runTransition = async (
  trackId: string,
  authHeader: string,
  action: TrackAction,
  plan: (tx: Prisma.TransactionClient, track: any, actor: Actor, now: Date) => Promise<TransitionPlan>,
) => {
  const actor = await loadActor(authHeader);

  const result = await withTransaction(async (tx) => {
    const track: any = await findTrackRepo(tx, trackId);
    if (!track) throw new Error(VALIDATION_MESSAGES.DTS_TRACK_NOT_FOUND);
    // Users who cannot see the track get a plain access error, not details of
    // its status or holder.
    await assertCanView(track, actor, tx);
    assertCanPerform(track, actor, action);

    const now = new Date();
    const p = await plan(tx, track, actor, now);
    const nextVersion = track.version + 1;

    const count = await updateTrackGuardedRepo(tx, track.id, { status: track.status, version: track.version }, {
      status: p.status,
      current_office_id: p.currentOfficeId,
      version: nextVersion,
      updated_by: actor.userIdBin,
      ...p.extra,
    });
    if (count !== 1) throw new Error(VALIDATION_MESSAGES.DTS_CONFLICT);

    await createHistoryRepo(tx, {
      track_id: track.id,
      sequence: nextVersion,
      action: p.historyAction,
      status: p.status,
      from_office_id: p.from.id,
      from_office_name: p.from.name,
      to_office_id: p.to.id,
      to_office_name: p.to.name,
      remarks: p.remarks,
      created_at: now,
      ...historyActorFields(actor),
    });
    return { track, plan: p };
  });

  const updated = await findTrackRepo(prisma, trackId, true);
  return { actor, before: result.track, plan: result.plan, response: toTrackResponse(updated, actor), updated };
};

const trimOrNull = (s?: string | null) => (s && s.trim() ? s.trim() : null);

const requireRemarks = (remarks?: string) => {
  const r = trimOrNull(remarks);
  if (!r) throw new Error(VALIDATION_MESSAGES.DTS_REMARKS_REQUIRED);
  return r;
};

const holderOffice = (track: any) => ({ id: track.current_office_id ?? null, name: track.currentOffice?.name ?? null });

export const submitTrack = async (trackId: string, fields: ReceiverActionFields, authHeader: string) => {
  const { actor, response, updated } = await runTransition(trackId, authHeader, TRACK_ACTION.SUBMIT, async (tx, track, _actor, now) => {
    const destinationId = fields.destinationId ?? idOrNull(track.intended_destination_id);
    if (!destinationId) throw new Error(VALIDATION_MESSAGES.DTS_DESTINATION_REQUIRED);
    const destination = await loadActiveOffice(tx, destinationId);
    const from = track.status === TRACK_STATUS.DRAFT
      ? { id: track.origin_office_id ?? null, name: track.originOffice?.name ?? null }
      : holderOffice(track);
    if (sameId(destination.id, from.id)) throw new Error(VALIDATION_MESSAGES.DTS_DESTINATION_SAME_OFFICE);
    return {
      status: TRACK_STATUS.SUBMITTED,
      historyAction: TRACK_HISTORY_ACTION.SUBMITTED,
      from,
      to: { id: destination.id, name: destination.name },
      currentOfficeId: destination.id,
      remarks: trimOrNull(fields.remarks),
      extra: {
        intended_destination_id: destination.id,
        // Keep the first submission date on resubmission after a return.
        ...(track.submitted_at ? {} : { submitted_at: now }),
      },
    };
  });
  await notifyOffice(updated.current_office_id, actor.userIdBin, "Document received",
    `${updated.track_number} "${updated.title}" was submitted to your office.`, trackId);
  return response;
};

export const acceptTrack = async (trackId: string, fields: ReceiverActionFields, authHeader: string) => {
  const { response } = await runTransition(trackId, authHeader, TRACK_ACTION.ACCEPT, async (tx, track) => {
    // fromOffice = the office that sent it here; toOffice = the acknowledging office.
    const inbound: any = track.status === TRACK_STATUS.RETURNED
      ? null
      : await findLatestInboundRepo(tx, track.id, track.current_office_id);
    const holder = holderOffice(track);
    return {
      status: TRACK_STATUS.IN_PROCESSED,
      historyAction: TRACK_HISTORY_ACTION.ACCEPTED,
      from: inbound ? { id: inbound.from_office_id, name: inbound.from_office_name } : holder,
      to: holder,
      currentOfficeId: track.current_office_id,
      remarks: trimOrNull(fields.remarks),
    };
  });
  return response;
};

export const forwardTrack = async (trackId: string, fields: ReceiverActionFields, authHeader: string) => {
  const { actor, response, updated } = await runTransition(trackId, authHeader, TRACK_ACTION.FORWARD, async (tx, track) => {
    const remarks = requireRemarks(fields.remarks);
    if (!fields.destinationId) throw new Error(VALIDATION_MESSAGES.DTS_DESTINATION_REQUIRED);
    const destination = await loadActiveOffice(tx, fields.destinationId);
    if (sameId(destination.id, track.current_office_id)) throw new Error(VALIDATION_MESSAGES.DTS_DESTINATION_SAME_OFFICE);
    return {
      status: TRACK_STATUS.FORWARDED,
      historyAction: TRACK_HISTORY_ACTION.FORWARDED,
      from: holderOffice(track),
      to: { id: destination.id, name: destination.name },
      currentOfficeId: destination.id,
      remarks,
    };
  });
  await notifyOffice(updated.current_office_id, actor.userIdBin, "Document forwarded",
    `${updated.track_number} "${updated.title}" was forwarded to your office.`, trackId);
  return response;
};

// Returns go back to whoever last sent the track to the current office — never
// to an arbitrary office — so the return path is always derived from history.
export const returnTrack = async (trackId: string, fields: ReceiverActionFields, authHeader: string) => {
  const { response, updated, plan } = await runTransition(trackId, authHeader, TRACK_ACTION.RETURN, async (tx, track) => {
    const remarks = requireRemarks(fields.remarks);
    const inbound: any = await findLatestInboundRepo(tx, track.id, track.current_office_id);
    if (!inbound) throw new Error(VALIDATION_MESSAGES.DTS_RETURN_TARGET_NOT_FOUND);
    return {
      status: TRACK_STATUS.RETURNED,
      historyAction: TRACK_HISTORY_ACTION.RETURNED,
      from: holderOffice(track),
      to: { id: inbound.from_office_id ?? null, name: inbound.from_office_name ?? null },
      currentOfficeId: inbound.from_office_id ?? null,
      remarks,
    };
  });
  await notifyOffice(updated.current_office_id, updated.created_by, "Document returned",
    `${updated.track_number} "${updated.title}" was returned to you: ${plan.remarks}`, trackId);
  return response;
};

export const completeTrack = async (trackId: string, fields: ReceiverActionFields, authHeader: string) => {
  const { response, updated } = await runTransition(trackId, authHeader, TRACK_ACTION.DONE, async (tx, track, actor, now) => {
    const remarks = requireRemarks(fields.remarks);
    const holder = holderOffice(track);
    return {
      status: TRACK_STATUS.DONE,
      historyAction: TRACK_HISTORY_ACTION.DONE,
      from: holder,
      to: { id: null, name: null },
      currentOfficeId: track.current_office_id,
      remarks,
      extra: { completed_at: now, completed_by: actor.userIdBin },
    };
  });
  await notifyOffice(null, updated.created_by, "Document completed",
    `${updated.track_number} "${updated.title}" has been marked as done.`, trackId);
  return response;
};

// ============================================================ setup manager

export const SETUP_KINDS: Record<string, SetupModel> = {
  "process-types": "dtsProcessType",
  purposes: "dtsPurpose",
  offices: "dtsOffice",
};

export interface SetupPayload {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

const toSetupResponse = (row: any) => ({
  id: binaryToUuid(row.id),
  name: row.name,
  sortOrder: row.sort_order,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const modelFor = (kind: string): SetupModel => {
  const model = SETUP_KINDS[kind];
  if (!model) throw new Error(VALIDATION_MESSAGES.DTS_SETUP_KIND_INVALID);
  return model;
};

export const listSetup = async (kind: string, params: QueryParams, activeOnly: boolean) => {
  const model = modelFor(kind);
  const where: any = { record_status: RecordStatus.ACTIVE };
  if (activeOnly) where.is_active = true;
  if (params.search) where.name = { contains: params.search };
  const { data, total } = await listSetupRepo(prisma, model, where, params.offset, params.limit);
  return { data: data.map(toSetupResponse), total };
};

export const createSetup = async (kind: string, payload: SetupPayload, authHeader: string) => {
  const model = modelFor(kind);
  const { userId } = extractUserFromToken(authHeader);
  const name = payload.name.trim();

  const existing = await findSetupByNameRepo(prisma, model, name);
  if (existing && existing.record_status) throw new Error(VALIDATION_MESSAGES.DTS_SETUP_NAME_EXISTS);

  // Re-adding a previously deleted value restores the original row so tracks
  // that reference it keep pointing at the same record.
  const row = existing
    ? await updateSetupRepo(prisma, model, existing.id, {
        record_status: RecordStatus.ACTIVE,
        is_active: payload.isActive ?? true,
        sort_order: payload.sortOrder ?? existing.sort_order,
        updated_by: uuidToBinary(userId),
      })
    : await createSetupRepo(prisma, model, {
        name,
        sort_order: payload.sortOrder ?? 0,
        is_active: payload.isActive ?? true,
        created_by: uuidToBinary(userId),
      });
  return toSetupResponse(row);
};

export const updateSetup = async (kind: string, id: string, payload: SetupPayload, authHeader: string) => {
  const model = modelFor(kind);
  const { userId } = extractUserFromToken(authHeader);
  const row = await findSetupByIdRepo(prisma, model, id);
  if (!row) throw new Error(VALIDATION_MESSAGES.DTS_SETUP_NOT_FOUND);

  const data: any = { updated_by: uuidToBinary(userId) };
  if (payload.name !== undefined) {
    const name = payload.name.trim();
    const clash = await findSetupByNameRepo(prisma, model, name);
    if (clash && !sameId(clash.id, row.id)) throw new Error(VALIDATION_MESSAGES.DTS_SETUP_NAME_EXISTS);
    data.name = name;
  }
  if (payload.sortOrder !== undefined) data.sort_order = payload.sortOrder;
  if (payload.isActive !== undefined) data.is_active = payload.isActive;

  return toSetupResponse(await updateSetupRepo(prisma, model, row.id, data));
};

// Soft delete. An office still holding open tracks cannot be removed, or those
// tracks would be stranded with no one able to act on them.
export const deleteSetup = async (kind: string, id: string, authHeader: string) => {
  const model = modelFor(kind);
  const { userId } = extractUserFromToken(authHeader);
  const row = await findSetupByIdRepo(prisma, model, id);
  if (!row) throw new Error(VALIDATION_MESSAGES.DTS_SETUP_NOT_FOUND);
  if (model === "dtsOffice" && (await countOpenTracksAtOfficeRepo(prisma, id)) > 0) {
    throw new Error(VALIDATION_MESSAGES.DTS_SETUP_IN_USE);
  }
  await updateSetupRepo(prisma, model, row.id, {
    record_status: RecordStatus.DELETED,
    is_active: false,
    updated_by: uuidToBinary(userId),
  });
};

const toOfficeUser = (u: any) => ({
  userId: binaryToUuid(u.id),
  name: fullName(u),
  email: u.email,
  role: u.role?.name ?? null,
  officeId: idOrNull(u.dts_office_id),
  officeName: u.dtsOffice?.name ?? null,
});

export const listOfficeUsers = async (officeId: string) => {
  const office = await findSetupByIdRepo(prisma, "dtsOffice", officeId);
  if (!office) throw new Error(VALIDATION_MESSAGES.DTS_SETUP_NOT_FOUND);
  return (await listOfficeUsersRepo(prisma, officeId)).map(toOfficeUser);
};

// Assign (or with null, unassign) the DTS office a user receives documents for.
export const assignUserOffice = async (userId: string, officeId: string | null) => {
  if (!(await findUserRepo(prisma, userId))) throw new Error(VALIDATION_MESSAGES.USER_NOT_FOUND);
  if (officeId && !(await findActiveSetupRepo(prisma, "dtsOffice", officeId))) {
    throw new Error(VALIDATION_MESSAGES.DTS_OFFICE_ID_INVALID);
  }
  return toOfficeUser(await setUserOfficeRepo(prisma, userId, officeId));
};
