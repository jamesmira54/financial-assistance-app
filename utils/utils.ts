import jwt from "jsonwebtoken";
import { ERROR_MESSAGES } from "./constant";
import { QueryParams } from "./types";


export function uuidToBinary(uuid: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(uuid.replace(/-/g, ''), 'hex');

  return new Uint8Array(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  );
}


export function binaryToUuid(binary: Uint8Array): string {
  try {
    const hex = Array.from(binary).map(byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  } catch ( err ) {
    console.log("Error converting binary to uuid: ", binary);
  }
}

export const extractUserFromToken = (authHeader: any): { email: string, userId: string } => {


  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error(ERROR_MESSAGES.INVALID_HEADER);
  } 
  
  const token = authHeader.split(' ')[1];
  const secretKey = process.env.SECRET_KEY;

  if (!secretKey) {
      throw new Error("Server configuration error: SECRET_KEY is not defined.");
  }

  try {
      const decoded = jwt.verify(token, secretKey);
      return {
          email: decoded.email,
          userId: decoded.userId
      };
  } catch (err) {
      throw new Error("Invalid or expired token.");
  }
};

export const getQueryParams = (req: any): QueryParams => {
  const { offset, limit, search, sort, mine, cityMunId, sponsorshipCriterionId, sponsorshipId, studentId, applicationStage, applicationStatus, status, academic_year_id, sponsor_id, duration_from, duration_to } = req.query;
  return {
    offset: offset && !isNaN(Number(offset)) ? Number(offset) : 0,
    limit: limit && !isNaN(Number(limit)) ? Number(limit) : 50,
    search: (search && search !== 'undefined' && search !== 'null') ? String(search) : '',
    sort: (sort && sort !== 'undefined' && sort !== 'null') ? String(sort) : 'desc',
    mine: (mine && mine !== 'undefined' && mine !== 'null') ? (String(mine).toLowerCase() == "true" ? true : false) : false,
    cityMunId: cityMunId && !isNaN(Number(cityMunId)) ? Number(cityMunId) : null,
    sponsorshipCriterionId: sponsorshipCriterionId,
    sponsorshipId: sponsorshipId,
    studentId: studentId,
    applicationStage: applicationStage,
    applicationStatus: applicationStatus,
    status: (status && status !== 'undefined' && status !== 'null') ? String(status) : null,
    academic_year_id: (academic_year_id && academic_year_id !== 'undefined' && academic_year_id !== 'null') ? String(academic_year_id) : null,
    sponsor_id: (sponsor_id && sponsor_id !== 'undefined' && sponsor_id !== 'null') ? String(sponsor_id) : null,
    duration_from: (duration_from && duration_from !== 'undefined' && duration_from !== 'null') ? String(duration_from) : null,
    duration_to: (duration_to && duration_to !== 'undefined' && duration_to !== 'null') ? String(duration_to) : null,
  };
};