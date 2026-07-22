
import { Prisma, student, user, academicYear, sponsorship, EvaluationStatus, announcement, schedule_type, examination_type, criterionCategory, DataSource, FormulaType, Preference, customInputCriterion, sponsorshipCriteriaPairwise } from '@prisma/client';
import { User } from "../authentication/model";
import { AcademicYearRequest, AcademicYearResponse, AddressResponse, AnnouncementData, AnnouncementDataMinimal, AnnouncementPayloadString, applicants, ApplySponsorshipRequest, ApplySponsorshipResponse, Criteria, CriteriaPairwiseConverted, criterionCategoryResponse, CriterionCategoryWithCriterion, CustomInput, CustomInputResponse, DashboardStats, FileTypeResponse, FlattenedAnnouncementData, FlattenedAnnouncementDataMinimal, GetStudentFile, Pairwise, PairwiseMatrixEntry, PartialStudentUser, PublicSponsorshipResponse, QualifiedApplicants, QualifiedApplicantsConverted, RecordStatus, RegisterRequest, RequiredColumns, RoleResponse, ScheduleModified, ScheduleRequest, ScheduleResponse, SchoolPayload, SiblingRequest, SponsorshipApplicantsWithDetails, SponsorshipCriteriaPairwise, SponsorshipCriterionModel, SponsorshipRequest, SponsorshipResponse, SponsorshipStatus, StudentListResponse, StudentRequest, ToSponsorshipCriteriResponse, UpdateStudentStatus, UploadedAnnouncementFile, UserDetailsResponse, UserListResponse, UserResponse } from './types';
import { binaryToUuid, uuidToBinary } from "./utils";
import { APPLICATION_STAGE, APPLICATION_STATUS } from './constant';

/**
 * Coerce a request value to an integer for Prisma Int columns.
 * Request bodies may deliver numeric fields as strings (e.g. "2025"); Prisma
 * rejects those with "Expected Int ... provided String". Returns null for
 * empty/absent/non-numeric input so nullable columns stay null instead of NaN.
 */
function toIntOrNull(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : Math.trunc(parsed);
}

/**
 * Coerce a request value to a float for Prisma Float columns. Same rationale as
 * toIntOrNull but preserves decimals (income, gwa, height, weight).
 */
function toFloatOrNull(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function convertStudentResponseToStudent(response: StudentRequest, userId: string): Prisma.studentUncheckedCreateInput  {
  return {
    user_id: uuidToBinary(response.userId),
    first_name: response.firstName,
    middle_name: response.middleName,
    last_name: response.lastName,
    extension_name: response.extensionName,
    sex: response.sex,
    place_of_birth: response.placeOfBirth,
    birthdate: response.birthdate ? new Date(response.birthdate) : null,
    height: toFloatOrNull(response.height),
    weight: toFloatOrNull(response.weight),
    permanent_street: response.permanentStreet,
    permanent_brg_id: toIntOrNull(response.permanentBrgId),
    permanent_citymun_id: toIntOrNull(response.permanentCitymunId),
    permanent_province_id: toIntOrNull(response.permanentProvinceId),
    permanent_region_id: toIntOrNull(response.permanentRegionId),
    permanent_zip_code: toIntOrNull(response.permanentZipCode),
    permanent_country: response.permanentCountry,
    current_street: response.currentStreet,
    current_brg_id: toIntOrNull(response.currentBrgId),
    current_citymun_id: toIntOrNull(response.currentCitymunId),
    current_province_id: toIntOrNull(response.currentProvinceId),
    current_region_id: toIntOrNull(response.currentRegionId),
    current_zip_code: toIntOrNull(response.currentZipCode),
    current_country: response.currentCountry,
    g12_academic_strand: response.g12AcademicStrand,
    g12_program_name: response.g12ProgramName,
    g12_award_honor: response.g12AwardHonor,
    g12_organization: response.g12Organization,
    g12_year_of_graduation: toIntOrNull(response.g12YearOfGraduation),
    g12_school_name: response.g12SchoolName,
    college_program_name: response.collegeProgramName,
    college_year_level: toIntOrNull(response.collegeYearLevel),
    college_award_honor: response.collegeAwardHonor,
    college_organization: response.collegeOrganization,
    college_school_id: response.collegeSchoolId ? uuidToBinary(response.collegeSchoolId) : null,
    email: response.email,
    mobile_number: response.mobileNumber,
    is_solo_parent: response.isSoloParent,
    is_child_of_solo_parent: response.isChildOfSoloParent,
    is_indigenous_people: response.isIndigenousPeople,
    indigenous_group: response.indigenousGroup,
    is_sped: response.isSped,
    is_pwd: response.isPwd,
    emergency_contact_name: response.emergencyContactName,
    emergency_contact_number: response.emergencyContactNumber,
    emergency_contact_relationship: response.emergencyContactRelationship,
    father_first_name: response.fatherFirstName,
    father_middle_name: response.fatherMiddleName,
    father_last_name: response.fatherLastName,
    father_extension: response.fatherExtension,
    father_occupation: response.fatherOccupation,
    father_income: toFloatOrNull(response.fatherIncome),
    father_mobile_number: response.fatherMobileNumber,
    mother_maiden_first_name: response.motherFirstName,
    mother_maiden_middle_name: response.motherMiddleName,
    mother_maiden_last_name: response.motherLastName,
    mother_occupation: response.motherOccupation,
    mother_income: toFloatOrNull(response.motherIncome),
    mother_mobile_number: response.motherMobileNumber,
    guardian_first_name: response.guardianFirstName,
    guardian_middle_name: response.guardianMiddleName,
    guardian_last_name: response.guardianLastName,
    guardian_extension: response.guardianExtension,
    guardian_occupation: response.guardianOccupation,
    guardian_income: toFloatOrNull(response.guardianIncome),
    guardian_mobile_number: response.guardianMobileNumber,
    number_of_siblings: toIntOrNull(response.numberOfSiblings),
    gwa: toFloatOrNull(response.gwa),
    created_by: uuidToBinary(userId),
    updated_by: uuidToBinary(userId),
    updated_at: new Date(),
    record_status: true
    
  };
}

export function convertToStudentUser(response: any): PartialStudentUser {
  return {
    first_name: response.firstName,
    middle_name: response.middleName,
    last_name: response.lastName,
    mobile_number: response.mobileNumber
  }
}



export function convertToSiblingData(
  studentId: string, 
  siblingRequests?: SiblingRequest[]
): Prisma.siblingUncheckedCreateInput[] {

  if (!siblingRequests || siblingRequests.length === 0) {
    return [];
  }

  return siblingRequests.map(sibling => ({
    student_id: uuidToBinary(studentId),
    sibling_name: sibling.name,
    sibling_bdate: sibling.birthdate ? new Date(sibling.birthdate) : null, // Ensure valid date
    sibling_age: sibling.age,
    living_with_parents: sibling.livingWithParents,
    sibling_status: sibling.status as "Single" | "Married" | "Divorced" | "Widowed",
    own_house: sibling.ownHouse,
    created_by: uuidToBinary(studentId),
    updated_by: uuidToBinary(studentId)
  }));
}


export function convertToUser(data: RegisterRequest, hashedPassword: any ): Prisma.userUncheckedCreateInput {
   return {
      email: data.email,
      password: hashedPassword,
      username: data.username,
      last_name:  data.lastName,
      first_name: data.firstName,
      middle_name: data.middleName,
      mobile_number: data.mobileNumber,
      role_id: uuidToBinary(data.roleId)
  }
}

export function toUserResponse(user: any, baseUrl?: string): UserListResponse {
  return {
    username: user.username,
    firstName: user.first_name,
    middleName: user.middle_name ?? null,
    lastName: user.last_name,
    mobileNumber: user.mobile_number,
    userId: binaryToUuid(user.id),
    email: user.email,
    userTypeId: binaryToUuid(user.role_id),
    userType: user.role?.name || 'Unknown',
    profilePhoto: user.profile && baseUrl ? `${baseUrl}/uploads/images/${user.profile}` : null,
  };
}

export function toStudentResponse(item: any ): StudentListResponse {
  return {
    studentId: binaryToUuid(item.student_id || item.id),
    userId: binaryToUuid(item.user_id),
    firstName: item.first_name,
    middleName: item.middle_name || undefined,
    lastName: item.last_name,
    extensionName: item.extension_name || undefined,
    sex: item.sex,
    placeOfBirth: item.place_of_birth,
    birthdate: item.birthdate ? new Date(item.birthdate) : null,
    height: item.height || undefined,
    weight: item.weight || undefined,
    permanentStreet: item.permanent_street,
    permanentBrgyId: item.permanent_brg_id,
    permanentBrgyName: item.permanent_barangay?.brgy_desc,
    permanentBrgyCode: item.permanent_barangay?.brgy_code,
    permanentCitymunId: item.permanent_citymun_id,
    permanentCitymunName: item.permanent_citynum?.citymun_desc,
    permanentCitymunCode: item.permanent_citynum?.citymun_code,
    permanentProvinceId: item.permanent_province_id,
    permanentProvinceName: item.permanent_province?.prov_desc,
    permanentProvinceCode: item.permanent_province?.prov_code,
    permanentRegionId: item.permanent_region_id,
    permanentRegionName: item.permanent_region?.region_desc,
    permanentRegionCode: item.permanent_region?.region_code,
    permanentZipCode: item.permanent_zip_code,
    permanentCountry: item.permanent_country,
    currentStreet: item.current_street,
    currentBrgyId: item.current_brg_id,
    currentBrgyName: item.current_barangay?.brgy_desc,
    currentBrgyCode: item.current_barangay?.brgy_code,
    currentCitymunId: item.current_citymun_id,
    currentCitymunName: item.current_citymun?.citymun_desc,
    currentCitymunCode: item.current_citymun?.citymun_code,
    currentProvinceId: item.current_province_id,
    currentProvinceName: item.current_province?.prov_desc,
    currentProvinceCode: item.current_province?.prov_code,
    currentRegionId: item.current_region_id,
    currentRegionName: item.current_region?.region_desc,
    currentRegionCode: item.current_region?.region_code,
    currentZipCode: item.current_zip_code,
    currentCountry: item.current_country,
    email: item.email,
    mobileNumber: item.mobile_number,
    isSoloParent: item.is_solo_parent,
    isChildOfSoloParent: item.is_child_of_solo_parent,
    isIndigenousPeople: item.is_indigenous_people,
    indigenousGroup: item.indigenous_group || undefined,
    isSped: item.is_sped,
    isPwd: item.is_pwd,
    emergencyContactName: item.emergency_contact_name,
    emergencyContactNumber: item.emergency_contact_number,
    emergencyContactRelationship: item.emergency_contact_relationship,
    g12AcademicStrand: item.g12_academic_strand,
    g12ProgramName: item.g12_program_name,
    g12AwardHonor: item.g12_award_honor,
    g12Organization: item.g12_organization,
    g12YearOfGraduation: item.g12_year_of_graduation,
    g12SchoolName: item.g12_school_name,
    collegeProgramName: item.college_program_name,
    collegeYearLevel: item.college_year_level,
    collegeAwardHonor: item.college_award_honor,
    collegeOrganization: item.college_organization,
    collegeSchoolId: item.college_school_id ? binaryToUuid(item.college_school_id) : item.college_school_id,
    collegeSchoolName: item.college_school?.school_name,
    fatherLastName: item.father_last_name,
    fatherFirstName: item.father_first_name,
    fatherMiddleName: item.father_middle_name || undefined,
    fatherExtension: item.father_extension || undefined,
    fatherOccupation: item.father_occupation,
    fatherIncome: item.father_income || undefined,
    fatherMobileNumber: item.father_mobile_number,
    motherMaidenLastName: item.mother_maiden_last_name,
    motherMaidenFirstName: item.mother_maiden_first_name,
    motherMaidenMiddleName: item.mother_maiden_middle_name || undefined,
    motherOccupation: item.mother_occupation,
    motherIncome: item.mother_income || undefined,
    motherMobileNumber: item.mother_mobile_number,
    guardianLastName: item.guardian_last_name,
    guardianFirstName: item.guardian_first_name,
    guardianMiddleName: item.guardian_middle_name || undefined,
    guardianExtension: item.guardian_extension || undefined,
    guardianOccupation: item.guardian_occupation,
    guardianIncome: item.guardian_income || undefined,
    guardianMobileNumber: item.guardian_mobile_number,
    numberOfSiblings: item.number_of_siblings,
    gwa: item.gwa,
    siblings: item.siblings?.map((sibling: any) => ({
      studentId: binaryToUuid(sibling.student_id),
      siblingName: sibling.sibling_name,
      siblingBdate: new Date(sibling.sibling_bdate),
      siblingAge: sibling.sibling_age,
      siblingStatus: sibling.sibling_status,
      livingWithParents: sibling.living_with_parents,
      ownHouse: sibling.own_house,
    })) || [],
  }
}

export function toUserPermissionResponse(permissions: any[]): any[] {
  if (!Array.isArray(permissions)) {
    console.error("Invalid permissions data:", permissions); // Debugging output
    return [];
  }

  return permissions.map(permission => ({
    moduleId: binaryToUuid(permission.module_id),
    moduleName: permission.module?.name,
    parentId: permission.module?.parent_id ? binaryToUuid(permission.module.parent_id) : null,
    parentName: permission.module?.parent?.name ?? null,
    roleId: binaryToUuid(permission.role_id),
    roleName: permission.role?.name,
    show: permission.show ?? false,
    edit: permission.edit ?? false,
    save: permission.save ?? false,
    delete: permission.delete ?? false,
  }));
}



export function toAddressResponse(data: any[]): AddressResponse[] {
  return data.map((item) => ({
    id: item.id,
    psgcCode: item.psgc_code,
    regDesc: item.reg_desc,
    regCode: item.reg_code,
    provDesc: item.prov_desc,
    provCode: item.prov_code,
    citymunDesc: item.citymun_desc,
    citymunCode: item.citymun_code,
    brgyCode: item.brgy_code,
    brgyDesc: item.brgy_desc,
  }));
}

export function toRolesResponse(data: any[]): RoleResponse[] {
  return data.map((item) => ({
    id: binaryToUuid(item.id),
    name: item.name,
    description: item.description
  }));
}

export function toSchoolResponse(data: any): any {
  console.log("Data here", data);
  return {
    id: binaryToUuid(data.id),
    name: data.school_name,
    provinceId: data.province_id,
    provinceName: data.province.prov_desc,
    cityMunId: data.citymun_id,
    cityMunName: data.citymun.citymun_desc,
    brgyId: data.brgy_id,
    brgyName: data.brgy.brgy_desc,
    schoolType: data.school_type
  };
}

export function toSchoolModel( school: SchoolPayload): Prisma.schoolUncheckedCreateInput {
  return {
    school_name: school.name,
    school_type: school.schoolType,
    citymun_id: school.cityMunId,
    province_id: school.provinceId,
    brgy_id: school.brgyId
  }
}

export function toAcadyearModel( academicYear: AcademicYearRequest,userId: string): Prisma.academicYearUncheckedCreateInput {
  return {
    academic_year_start: academicYear.academicYearStart,
    academic_year_end: academicYear.academicYearEnd,
    school_term: academicYear.schoolTerm,
    date_from: academicYear.dateFrom,
    date_to: academicYear.dateTo,
    updated_at:  new Date,
    created_by: uuidToBinary(userId),
    updated_by: uuidToBinary(userId),
  }
}

export function toAcadyearResponse( data: academicYear ): AcademicYearResponse {
  return {
    id: binaryToUuid( data.id),
    academicYearStart: data.academic_year_start,
    academicYearEnd: data.academic_year_end,
    schoolTerm: data.school_term,
    dateFrom: data.date_from.toISOString(),
    dateTo: data.date_to.toISOString()
  }
}

export function toSponsorshipModel( payload: SponsorshipRequest, userId:string): Prisma.sponsorshipUncheckedCreateInput {
  return {
    name: payload.name,
    sponsor_id: uuidToBinary(payload.sponsorId),
    coordinator_id: uuidToBinary(userId),
    academic_year_id: uuidToBinary(payload.academicYearId),
    duration_from: new Date(payload.durationFrom),
    duration_to: new Date(payload.durationTo),
    batch_number: payload.batchNumber,
    limit: payload.limit,
    slot: payload.slot,
    fund_allocation: payload.fundAllocation,
    allowance_per_student: payload.allowancePerStudent,
    status: SponsorshipStatus.ACTIVE,
    updated_at:  new Date,
    created_by: uuidToBinary(userId),
    updated_by: uuidToBinary(userId),
  }
}

export function toApplyScholarship( payload: ApplySponsorshipRequest, appId:string, userId:string  ): Prisma.sponsorshipApplicationUncheckedCreateInput {
  return {
    app_id: appId,
    student_id: uuidToBinary(payload.studentId),
    sponsorship_id: uuidToBinary(payload.sponsorshipId),
    application_stage: APPLICATION_STAGE.POOLING,
    application_status: APPLICATION_STATUS.PENDING_POOLING,
    created_by: uuidToBinary(userId),
    updated_by: uuidToBinary(userId),
  }
}

export function toApplyScholarshipResponse( payload: any, studentFiles: any[] = [] ): ApplySponsorshipResponse {

  const data: ApplySponsorshipResponse =  {
    appId: payload.app_id,
    studentId: binaryToUuid(payload.student_id),
    studentName: `${payload.student.first_name} ${payload.student.middle_name ? payload.student.middle_name + " " : ""}${payload.student.last_name}`,
    studentSex: payload.student.sex,
    programName: payload.student.college_program_name,
    yearLevel: payload.student.college_year_level,
    sponsorshipId: binaryToUuid(payload.sponsorship_id),
    sponsorshipName: payload.sponsorship.name,
    // cityMun: payload.current_citynum.citymun_desc,
    sponsorshipRemarks: payload.remarks,
    sponsorshipStatus: payload.application_status,
    sponsorshipStage: payload.application_stage,
    applicationDate: payload.application_date,
    sponsorshipRequirement : (payload?.sponsorship?.requirements ?? []).map(item => ({
      fileId: binaryToUuid(item.file_type_id),
      fileName: item.fileType.name
    }))
  }

  if(studentFiles.length > 0) {
    data.studentFiles = (studentFiles ?? []).map(item => ({
      fileName: item.file_name,
      fileType: item.fileType?.name ?? ""
    }));
  }

  return data;
}

export const toStudentFileResponse = ( data: any ): GetStudentFile => { 
  return {
    id: binaryToUuid(data.id),
    filename: data.file_name,
    mime_type: data.mime_type,
    path: data.path,
    filetype: data.fileType.name
  }
}

export function toSponsorSchoolModel(payload: string[], sponsorshipId: string): Prisma.sponsorshipSchoolUncheckedCreateInput[] {
  return payload.map(data => ({
    sponsorship_id: uuidToBinary(sponsorshipId),
    school_id: uuidToBinary(data)
  }));
}

export function toSponsorReqModel(payload: string[], sponsorshipId: string): Prisma.sponsorshipRequirementUncheckedCreateInput[] {
  return payload.map(data => ({
    sponsorship_id: uuidToBinary(sponsorshipId),
    file_type_id: uuidToBinary(data)
  }));
}

export function toFileTypeResponse( payload: any):FileTypeResponse {
  return {
    id: binaryToUuid( payload.id ),
    name: payload.name
  }
}

export function toSponsorshipResponse( payload: any, pairwise: any[] = [] ): SponsorshipResponse {
  return {
    id: binaryToUuid(payload.id),
    name: payload.name,
    sponsorId: binaryToUuid(payload.sponsor_id),
    sponsorName: payload.sponsor?.first_name + " " + payload.sponsor?.last_name,
    coordinatorId: binaryToUuid(payload.coordinator_id),
    coordinatorName: payload.coordinator?.first_name + " " + payload.coordinator?.last_name,
    academicYearId: binaryToUuid(payload.academic_year_id),
    academicYearEnd: payload.academicYear?.academic_year_end,
    academicYearStart: payload.academicYear?.academic_year_start,
    durationFrom: payload.duration_from ? payload.duration_from.toISOString() : null,
    durationTo: payload.duration_to ? payload.duration_to.toISOString() : null,
    batchNumber: payload.batch_number,
    limit: payload.limit,
    slot: payload.slot,
    fundAllocation: payload.fund_allocation,
    allowancePerStudent: payload.allowance_per_student ?? null,
    status: payload.status,
    studentCount: payload._count?.sponsorshipApplication ?? 0,
    sponsorshipSchool: (payload.schools ?? []).map(item => ({
      schoolId: binaryToUuid(item.school_id),
      schoolName: item.school.school_name
    })),
    sponsorshipRequirements: (payload.requirements ?? []).map(item => ({
      fileId: binaryToUuid(item.file_type_id),
      fileName: item.fileType.name
    })),
    students: (payload.sponsorshipApplication ?? []).map(item => (
      {
      studentId: item.student.id ? binaryToUuid(item.student.id) : null,
      studentName: `${item.student.first_name} ${item.student.middle_name ? item.student.middle_name + " " : ""}${item.student.last_name}`,
      files: item.student.files
    })),
    criterion: (payload.criterion ?? []).map((item: any) => ({
      id: binaryToUuid(item.id),
      name: item.name ?? null,
      label: item.label ?? null,
      dataSource: item.data_source ?? null,
      formulaType: item.formula_type ?? null,
      preference: item.preference ?? null,
      requiredColumns: item.requiredColumn.map(col => ({
        id: binaryToUuid(col.id),
        sponsorshipCriterionId: binaryToUuid(col.sponsorship_criterion_id),
        table: col.table,
        column: col.column,
      }))
    })),
    pairwise: pairwise.map(p => ({
      id: binaryToUuid(p.id),
      sponsorshipId: binaryToUuid(p.sponsorship_id),
      criterionAId: binaryToUuid(p.sponsorship_criterion_id_a),
      criterionAName: p.sponsorship_criterion_name_a,
      criterionBId: binaryToUuid(p.sponsorship_criterion_id_b),
      criterionBName: p.sponsorship_criterion_name_b,
      value: p.value,
    })),
  };
}

export function toPublicSponsorshipResponse( payload: any ): PublicSponsorshipResponse {
  return {
    id: binaryToUuid(payload.id),
    name: payload.name,
    sponsorName: payload.sponsor?.first_name + " " + payload.sponsor?.last_name,
    academicYearStart: payload.academicYear?.academic_year_start,
    academicYearEnd: payload.academicYear?.academic_year_end,
    durationFrom: payload.duration_from ? payload.duration_from.toISOString() : null,
    durationTo: payload.duration_to ? payload.duration_to.toISOString() : null,
    slot: payload.slot,
    status: payload.status,
    sponsorshipSchool: (payload.schools ?? []).map(item => ({
      schoolId: binaryToUuid(item.school_id),
      schoolName: item.school.school_name
    })),
    sponsorshipRequirements: (payload.requirements ?? []).map(item => ({
      fileId: binaryToUuid(item.file_type_id),
      fileName: item.fileType.name
    })),
  };
}

export function toUpdateStatusModel(details: any, studentId: string, userId: string, awardNumber?: string): UpdateStudentStatus {
  const model: any = {
    student_id: uuidToBinary(studentId),
    sponsorship_id: uuidToBinary(details.sponsorshipId),
    application_stage: details.appStage,
    application_status: details.appStatus,
    remarks: details.remarks,
    award_number: awardNumber,
    updated_at: new Date(),
    updated_by: uuidToBinary(userId)
  };

  // Only include exam_status if provided
  if (details.examStatus !== undefined) {
    model.exam_status = details.examStatus;
  }

  // Only include interview_status if provided
  if (details.interviewStatus !== undefined) {
    model.interview_status = details.interviewStatus;
  }

  return model;
}


export function toUpdateStatusResponse( converted: UpdateStudentStatus) {
  return {
    ...converted,
    student_id: binaryToUuid(converted.student_id),
    sponsorship_id: binaryToUuid(converted.sponsorship_id),
    updated_by: binaryToUuid(converted.updated_by),
  };
}

export function toAnnouncementModel( payload: AnnouncementPayloadString, userId: string, isUpdate: boolean = false ): Prisma.announcementUncheckedCreateInput {
  const data: Prisma.announcementUncheckedCreateInput = {
    title: payload.title,
    content: payload.content,
    caption: payload.caption,
    sponsorship_id: payload.sponsorshipId ? uuidToBinary(payload.sponsorshipId) : null
  };

  if(isUpdate) {
    data.updated_at = new Date();
    data.updated_by = uuidToBinary(userId);
  } else {
    data.created_by = uuidToBinary(userId);
    data.updated_by =  uuidToBinary(userId);
  }

  return data;
}


export function toAnnouncementLocationModel( locationId: number, announcementId: string): Prisma.announcementLocationUncheckedCreateInput {
  return {
    citymun_id: Number(locationId),
    announcement_id: uuidToBinary(announcementId),
  }
}

export const toUploadedFileModel = (file: Express.Multer.File, announcementId: string): Prisma.announcementFileUncheckedCreateInput => {
  return {
    announcement_id: uuidToBinary(announcementId),
    file_name: file.filename,
    path: file.path,
    mime_type: file.mimetype,
  };
};

export const toAnnouncementResponse = ( data: AnnouncementData ): FlattenedAnnouncementData => {
  return {
    id: binaryToUuid(data.id), // Convert Uint8Array to UUID string
    title: data.title,
    content: data.content,
    caption: data.caption,
    sponsorshipId: binaryToUuid(data.sponsorship_id), // Convert Uint8Array to UUID string
    locations: data.locations.map(location => ({
        id: location.citymun.id,
        name: location.citymun.citymun_desc
    })), // Extract id and city name
    files: data.files.map( file => ({
      id: binaryToUuid(file.id),
      fileName: file.file_name,
      path: file.path
    }))
  };
}

export const toAnnouncementMinimalResponse = ( data: AnnouncementDataMinimal ): FlattenedAnnouncementDataMinimal => {
  return {
    id: binaryToUuid(data.id),
    title: data.title,
    content: data.content,
    caption: data.caption,
    sponsorshipId: binaryToUuid(data.sponsorship_id)
  };
}

export const toScheduleModel = ( data: ScheduleRequest, creatorId: string, isEdit: boolean = false ): Prisma.scheduleUncheckedCreateInput => {
  return {
    sponsorship_id: uuidToBinary( data.sponsorshipId ),
    batch_no: data.batchNo,
    batch_code: data.batchCode,
    schedule_type: data.scheduleType as schedule_type,
    examination_type: data.examinationType as examination_type,
    proctor_interviewer: data.proctorInterviewer,
    location: data.location,
    start_date: data.startDate,
    end_date: data.endDate,
    schedule_quota: data.scheduleQuota,
    ...(isEdit ? {} : { created_by: uuidToBinary(creatorId) }),
    updated_by: uuidToBinary( creatorId )
  }
}

export const convertedScheduleResponse = ( data: ScheduleModified ): ScheduleResponse => {
  return {
    id: binaryToUuid( data.id ),
    sponsorshipId: binaryToUuid( data.sponsorship_id ),
    sponsorshipName: data.sponsorship?.name ?? null,
    batchNo: data.batch_no,
    batchCode: data.batch_code ?? null,
    location: data.location,
    startDate: data.start_date.toISOString(),
    endDate: data.end_date.toISOString(),
    scheduleQuota: data.schedule_quota,
    scheduleType: data.schedule_type,
    examinationType: data.examination_type ?? null,
    proctorInterviewer: data.proctor_interviewer ?? null
  }
}

export const toCriterionCategory = ( data: CriterionCategoryWithCriterion): criterionCategoryResponse => {
  return {
    id: binaryToUuid(data.id),
    name: data.name,
    criterions: data?.criterion.map(e => {return { id: binaryToUuid(e.id), name: e.name}})
  }
}

export const toSponsorshipCriterion = ( data: Criteria, categoryCriterionId: string, sponsorshipId: string ): Prisma.sponsorshipCriterionUncheckedCreateInput => {
  return {
    sponsorship_id: uuidToBinary(sponsorshipId),
    criterion_category_id: uuidToBinary(categoryCriterionId),
    name: data.name,
    label: data.label ?? "",
    data_source: data.dataSource as DataSource,
    formula_type: data.formulaType as FormulaType,
    preference: data.preference as Preference
  }
}

export const toRequiredColumn = ( data: RequiredColumns, sponsorshipCriterionId: string ): Prisma.criterionRequiredColumnUncheckedCreateInput => {
  return {
    sponsorship_criterion_id: uuidToBinary( sponsorshipCriterionId ),
    table: data.table,
    column: data.column
  }
}

export const toCriteriaPairwise = ( criterionAId: string, criterionBId, sponsorshipId: string, data: Pairwise ): Prisma.sponsorshipCriteriaPairwiseUncheckedCreateInput => {
  return {
    sponsorship_criterion_id_a: uuidToBinary(criterionAId),
    sponsorship_criterion_name_a: data.criteriaNameA,
    sponsorship_criterion_id_b: uuidToBinary(criterionBId),
    sponsorship_criterion_name_b: data.criteriaNameB,
    sponsorship_id: uuidToBinary(sponsorshipId),
    value: data.value
  }
}

export const toSponsorshipCriteriResponse = (
  criterionsMap: SponsorshipCriterionModel[],
  pairwise: SponsorshipCriteriaPairwise[],
  sponsorshipId: string,
  criterionCategoryId: string
): ToSponsorshipCriteriResponse => {
  return {
    sponsorshipId: sponsorshipId,
    criterionCategoryId: criterionCategoryId,
    criterions: criterionsMap.map(e => ({
      id: binaryToUuid(e.id),
      sponsorshipId: binaryToUuid(e.sponsorship_id),
      criterionCategoryId: binaryToUuid(e.criterion_category_id),
      name: e.name,
      label: e.label,
      dataSource: e.data_source,
      formulaType: e.formula_type,
      preference: e.preference,
      requiredColumns: e.requiredColumn.map(col => ({
        id: binaryToUuid(col.id),
        sponsorshipCriterionId: binaryToUuid(col.sponsorship_criterion_id),
        table: col.table,
        column: col.column,
      }))
    })),
    pairwise: pairwise.map(p => ({
      id: binaryToUuid(p.id),
      sponsorshipId: binaryToUuid(p.sponsorship_id),
      criterionAId: binaryToUuid(p.sponsorship_criterion_id_a),
      criterionAName: p.sponsorship_criterion_name_a,
      criterionBId: binaryToUuid(p.sponsorship_criterion_id_b),
      criterionBName: p.sponsorship_criterion_name_b,
      value: p.value
    }))
  };
};

export const toCustomInputCriterion = ( item: CustomInput, userId: string ): Prisma.customInputCriterionUncheckedCreateInput => {
  return {
    student_id: uuidToBinary(item.studentId),
    sponsorship_id: uuidToBinary(item.sponsorshipId),
    sponsorship_criterion_id: uuidToBinary(item.sponsorshipCriterionId),
    value: item.value,
    created_by: uuidToBinary(userId),
    updated_by: uuidToBinary(userId)
  }
}

export const toCustomInputResponse = ( item: customInputCriterion ): CustomInputResponse => {
  return {
    id: binaryToUuid(item.id),
    studentId: binaryToUuid(item.student_id),
    sponsorshipId: binaryToUuid(item.sponsorship_id),
    sponsorshipCriterionId: binaryToUuid(item.sponsorship_criterion_id),
    value: item.value
  }
}

export const toCriteriaPairwiseConverted = ( pairwiseMatrix: PairwiseMatrixEntry ): CriteriaPairwiseConverted => {
  return {
    criterionAId: binaryToUuid(pairwiseMatrix.sponsorship_criterion_id_a),
    criterionAName: pairwiseMatrix.sponsorship_criterion_name_a,
    criterionBId: binaryToUuid(pairwiseMatrix.sponsorship_criterion_id_b),
    criterionBName: pairwiseMatrix.sponsorship_criterion_name_b,
    value: pairwiseMatrix.value,
    dataSource: pairwiseMatrix.criterion_a.data_source,
    formulaType: pairwiseMatrix.criterion_a.formula_type,
    preference: pairwiseMatrix.criterion_a.preference
  }
}

export const toConvertedQualifiedApplicants = ( payload: QualifiedApplicants): QualifiedApplicantsConverted => {
  return {
    appId: payload.app_id,
    student: payload.student,
    studentId: binaryToUuid(payload.student_id),
    interviewStatus: payload.interview_status,
    examStatus: payload.exam_status
  }
}

export const toConvertedApplicants = ( payload: SponsorshipApplicantsWithDetails ): applicants => {
  
  const middle = payload.student.middle_name !== null ? payload.student.middle_name : "";
  let name = payload.student.first_name + " " + middle + " " + payload.student.last_name;
  
  return {
    id: binaryToUuid(payload.id),
    appNumber: payload.app_id,
    studentId: binaryToUuid(payload.student_id),
    sponsorshipId: binaryToUuid(payload.sponsorship_id),
    appStatus: payload.application_status,
    appStage: payload.application_stage,
    applicantName: name,
    sex: payload.student.sex,
    program: payload.student.college_program_name,
    yearLevel: payload.student.college_year_level,
    municipality: payload.student.permanent_citynum.citymun_desc,
    finAssname: payload.sponsorship.name,
    dateOfApp: payload.application_date.toISOString(),
  }
}
