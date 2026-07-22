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

// A grantee can only be moved from ACTIVE into one of these terminal states via
// the monitoring list. Reinstatement (back to ACTIVE) is out of scope.
const ALLOWED_TRANSITIONS: string[] = [
  APPLICATION_STATUS.DELISTED,
  APPLICATION_STATUS.GRADUATED,
];

const prisma = new PrismaClient();

// The Monitoring List "Type" filter maps to a stored grantee lifecycle status.
// "Active" grantees are stored as AWARDED (Awarded == Active).
const TYPE_TO_STATUS: Record<string, APPLICATION_STATUS> = {
  active: APPLICATION_STATUS.AWARDED,
  delisted: APPLICATION_STATUS.DELISTED,
  graduated: APPLICATION_STATUS.GRADUATED,
};

// AWARDED is stored in the DB but presented as "ACTIVE" in the monitoring list
// so the Status column reads Active / Delisted / Graduated per spec.
const STATUS_LABEL: Record<string, string> = {
  [APPLICATION_STATUS.AWARDED]: "ACTIVE",
  [APPLICATION_STATUS.DELISTED]: "DELISTED",
  [APPLICATION_STATUS.GRADUATED]: "GRADUATED",
};

const completeName = (s: any): string => {
  const given = [s.first_name, s.middle_name].filter(Boolean).join(" ");
  const ext = s.extension_name ? ` ${s.extension_name}` : "";
  return `${s.last_name}, ${given}${ext}`.trim();
};

const toGranteeRow = (row: any, seq: number) => ({
  seq,
  awardNumber: row.award_number ?? null,
  grantName: row.sponsorship?.name ?? null,
  batch: row.sponsorship?.batch_number ?? null,
  semester: row.sponsorship?.academicYear?.school_term ?? null,
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
  // Base set: everyone who has ever been a grantee (ACTIVE/DELISTED/GRADUATED).
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

  if (!target || !ALLOWED_TRANSITIONS.includes(target)) {
    throw new Error(VALIDATION_MESSAGES.INVALID_GRANTEE_STATUS);
  }
  if (target === APPLICATION_STATUS.DELISTED && !payload.remarks) {
    throw new Error(VALIDATION_MESSAGES.DELIST_REMARKS_REQUIRED);
  }

  const app = await findGranteeAppRepo(prisma, applicationId);
  if (!app) {
    throw new Error(VALIDATION_MESSAGES.GRANTEE_NOT_FOUND);
  }
  if (app.application_status !== APPLICATION_STATUS.AWARDED) {
    throw new Error(VALIDATION_MESSAGES.GRANTEE_NOT_ACTIVE);
  }

  const { userId } = extractUserFromToken(authHeader);
  await updateGranteeStatusRepo(prisma, applicationId, target, payload.remarks, userId);

  return { applicationId, status: target, remarks: payload.remarks ?? null };
};
