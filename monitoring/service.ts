import { PrismaClient } from "@prisma/client";
import {
  APPLICATION_STATUS,
  GRANTEE_STATUSES,
  QueryParams,
  VALIDATION_MESSAGES,
  binaryToUuid,
  extractUserFromToken,
  uuidToBinary,
} from "../utils";
import { getUserRole } from "../authentication/service";
import {
  findGranteeAppRepo,
  getGranteesRepo,
  updateGranteeStatusRepo,
} from "./repository";

// Allowed lifecycle moves, keyed by current status. An active (AWARDED) grantee
// can be delisted, graduated, or put on leave of absence. LOA is temporary, so
// an LOA grantee can be reinstated to AWARDED. DELISTED/GRADUATED are final.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  [APPLICATION_STATUS.AWARDED]: [
    APPLICATION_STATUS.DELISTED,
    APPLICATION_STATUS.GRADUATED,
    APPLICATION_STATUS.LOA,
  ],
  [APPLICATION_STATUS.LOA]: [APPLICATION_STATUS.AWARDED],
};

const TARGET_STATUSES = new Set(Object.values(ALLOWED_TRANSITIONS).flat());

// Every move except reinstatement needs a reason (e.g. the graduation date).
const REMARKS_REQUIRED: string[] = [
  APPLICATION_STATUS.DELISTED,
  APPLICATION_STATUS.GRADUATED,
  APPLICATION_STATUS.LOA,
];

const prisma = new PrismaClient();

// The Monitoring List "Type" filter maps to a stored grantee lifecycle status.
// "Active" grantees are stored as AWARDED (Awarded == Active).
const TYPE_TO_STATUS: Record<string, APPLICATION_STATUS> = {
  active: APPLICATION_STATUS.AWARDED,
  delisted: APPLICATION_STATUS.DELISTED,
  graduated: APPLICATION_STATUS.GRADUATED,
  loa: APPLICATION_STATUS.LOA,
};

// AWARDED is stored in the DB but presented as "ACTIVE" in the monitoring list
// so the Status column reads Active / Delisted / Graduated per spec.
const STATUS_LABEL: Record<string, string> = {
  [APPLICATION_STATUS.AWARDED]: "ACTIVE",
  [APPLICATION_STATUS.DELISTED]: "DELISTED",
  [APPLICATION_STATUS.GRADUATED]: "GRADUATED",
  [APPLICATION_STATUS.LOA]: "LOA",
};

const completeName = (s: any): string => {
  const given = [s.first_name, s.middle_name].filter(Boolean).join(" ");
  const ext = s.extension_name ? ` ${s.extension_name}` : "";
  return `${s.last_name}, ${given}${ext}`.trim();
};

// Academic year is stored as start/end ints on the related academicYear and
// presented as a "2024-2025" label. Null when either bound is missing.
const academicYearLabel = (ay: any): string | null => {
  if (!ay || ay.academic_year_start == null || ay.academic_year_end == null) {
    return null;
  }
  return `${ay.academic_year_start}-${ay.academic_year_end}`;
};

const toGranteeRow = (row: any, seq: number) => ({
  seq,
  applicationId: binaryToUuid(row.id),
  awardNumber: row.award_number ?? null,
  // The client uses the application number as the student number.
  studentNumber: row.app_id ?? null,
  grantName: row.sponsorship?.name ?? null,
  batch: row.sponsorship?.batch_number ?? null,
  academicYear: academicYearLabel(row.sponsorship?.academicYear),
  semester: row.sponsorship?.academicYear?.school_term ?? null,
  sponsor: row.sponsorship?.sponsor
    ? [row.sponsorship.sponsor.first_name, row.sponsorship.sponsor.last_name].filter(Boolean).join(" ")
    : null,
  studentId: row.student?.id ? binaryToUuid(row.student.id) : null,
  completeName: completeName(row.student),
  gender: row.student?.sex ?? null,
  yearLevel: row.student?.college_year_level ?? null,
  course: row.student?.college_program_name ?? null,
  school: row.student?.college_school?.name ?? null,
  gwa: row.student?.gwa ?? null,
  status: STATUS_LABEL[row.application_status] ?? row.application_status,
});

export const getGrantees = async (
  authHeader: string,
  params: QueryParams,
  type: string,
) => {
  // Base set: everyone who has ever been a grantee (ACTIVE/DELISTED/GRADUATED/LOA).
  // A specific Type narrows to a single lifecycle status.
  const status = TYPE_TO_STATUS[type?.toLowerCase()];
  const where: any = {
    record_status: true,
    application_status: status ? status : { in: GRANTEE_STATUSES },
  };

  // Scholarship name + academic year are attributes of the related sponsorship.
  const sponsorship: any = {};
  if (params.search) {
    sponsorship.name = { contains: params.search };
  }
  if (params.academic_year_id) {
    sponsorship.academic_year_id = uuidToBinary(params.academic_year_id);
  }

  // A sponsor only ever sees grantees under sponsorships they own. Admins and
  // coordinators are unscoped.
  const { userId } = extractUserFromToken(authHeader);
  const role = await getUserRole(userId);
  if (role === "sponsor") {
    sponsorship.sponsor_id = uuidToBinary(userId);
  }

  if (Object.keys(sponsorship).length) {
    where.sponsorship = sponsorship;
  }

  const { data, totalCount } = await getGranteesRepo(
    prisma,
    where,
    params.offset,
    params.limit,
  );

  const grantees = data.map((row: any, i: number) =>
    toGranteeRow(row, params.offset + i + 1),
  );

  return { grantees, totalCount };
};

export const changeGranteeStatus = async (
  applicationId: string,
  payload: { status?: string; remarks?: string },
  authHeader: string,
) => {
  const target = payload.status?.toUpperCase();

  if (!target || !TARGET_STATUSES.has(target)) {
    throw new Error(VALIDATION_MESSAGES.INVALID_GRANTEE_STATUS);
  }
  if (REMARKS_REQUIRED.includes(target) && !payload.remarks?.trim()) {
    throw new Error(VALIDATION_MESSAGES.GRANTEE_REMARKS_REQUIRED);
  }

  const app = await findGranteeAppRepo(prisma, applicationId);
  if (!app) {
    throw new Error(VALIDATION_MESSAGES.GRANTEE_NOT_FOUND);
  }
  if (!ALLOWED_TRANSITIONS[app.application_status]?.includes(target)) {
    throw new Error(VALIDATION_MESSAGES.GRANTEE_NOT_ACTIVE);
  }

  const { userId } = extractUserFromToken(authHeader);
  await updateGranteeStatusRepo(prisma, applicationId, target, payload.remarks, userId);

  return { applicationId, status: target, remarks: payload.remarks ?? null };
};
