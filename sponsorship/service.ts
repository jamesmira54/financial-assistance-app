import {
  criterionCategory,
  criterionRequiredColumn,
  customInputCriterion,
  DataSource,
  EvaluationStatus,
  FormulaType,
  Preference,
  Prisma,
  PrismaClient,
  sponsorship,
  sponsorshipCriteriaPairwise,
  sponsorshipCriterion,
} from "@prisma/client";
import {
  APPLICATION_STAGE,
  APPLICATION_STATUS,
  binaryToUuid,
  extractUserFromToken,
  SponsorshipRequest,
  TableColumnMap,
  uuidToBinary,
} from "../utils";
import {
  toApplyScholarship,
  toApplyScholarshipResponse,
  toConvertedApplicants,
  toConvertedQualifiedApplicants,
  toCriteriaPairwise,
  toCriteriaPairwiseConverted,
  toCriterionCategory,
  toCustomInputCriterion,
  toCustomInputResponse,
  toPublicSponsorshipResponse,
  toRequiredColumn,
  toSponsorReqModel,
  toSponsorSchoolModel,
  toSponsorshipCriterion,
  toSponsorshipCriteriResponse,
  toSponsorshipModel,
  toSponsorshipResponse,
  toUpdateStatusModel,
  toUpdateStatusResponse,
} from "../utils/converter";
import {
  checkIfSponsorshipExistRepo,
  checkSponsorshipIdRepo,
  createSponsorshipRepo,
  createSponsorshipRequirementRepo,
  createSponsorshipSchoolRepo,
  deleteAllSponsorshipRequirements,
  deleteAllSponsorshipSchools,
  getAllSponsorshipRepo,
  getAllPublicSponsorshipRepo,
  getAllSponsorshipRequirements,
  getAllSponsorshipSchoolRepo,
  updateSponsorshipRepo,
  getOneSponsorshipRepo,
  deleteOneSponsorshipRepo,
  applyToSponsorshipRepo,
  doesStudentAlreadyAppliedRepo,
  getAllStudentSponsorshipRepo,
  getOneStudentSponsorshipRepo,
  getAllSponsorshipStudent,
  adjustStudentEligibilityStatusRepo,
  generateAppIdRepo,
  findAppId,
  checkBatchRepo,
  getCategoryCriterionRepo,
  checkCriterionCategoryIdRepo,
  createSponsorshipCriterionRepo,
  getAllSponsorshipCriterionRepo,
  updateSponsorshipCriterionRepo,
  getAllRequiredColumnRepo,
  updateRequiredColumnRepo,
  createManyRequiredColumnRepo,
  saveBulkPairwiseCriteriaRepo,
  deleteManyRequiredColumnRepo,
  deleteManySponsorshipCriterionRepo,
  getAllCriterionPairwiseRepo,
  updatePairwiseCriteriaRepo,
  deleteManySponsorshipPairwiseCriterion,
  getSponsorshipCriterionRepo,
  getAllSponsorshipCriterionPairwiseRepo,
  getUniqueCustomInput,
  createBulkCustomInput,
  updateCustomInput,
  getCustomInputRepo,
  checkSponsorshipCriterionCategoryIdRepo,
  getPairwiseMatrixRepo,
  getQualifiedApplicants,
  getRequiredColumn,
  getColumnData,
  getCriterionCustomInputValue,
  getAllApplicantsByStageRepo,
  countNumberOfGrantee,
  getSponsorshipBatchNumber,
  cancelStudentApplicationRepo,
} from "./repository";
import {
  Action,
  applicants,
  Applicants,
  ApplySponsorshipRequest,
  ApplySponsorshipResponse,
  AuthPayload,
  ConvertedGetAllApplicantsByStageResult,
  Criteria,
  CriteriaPairwiseConverted,
  criterionCategoryResponse,
  CriterionCategoryWithCriterion,
  CriterionPayload,
  CriterionResponse,
  CustomInput,
  CustomInputResponse,
  DataSourceTable,
  GetAllApplicantsByStageResult,
  GetAllSponsorshipType,
  Pairwise,
  PairwiseMatrixEntry,
  PairwiseMatrixResult,
  PublicSponsorshipResponse,
  PaginatedPublicSponsorshipResponse,
  QualifiedApplicants,
  QualifiedApplicantsConverted,
  QueryParams,
  RecordStatus,
  RequiredColumns,
  SawScoreType,
  SponsorshipApplicantsWithDetails,
  SponsorshipCriteriaPairwise,
  SponsorshipCriterion,
  SponsorshipCriterionModel,
  SponsorshipResponse,
  ToSponsorshipCriteriResponse,
  UpdateStudentStatus,
  UpdateStudentStatusRequest,
} from "../utils/types";
import { getStudentCollegeSchoolRepo } from "../student/repository";
import { getAllFileOfStudent, getBulkFileOfStudents } from "../file/service";
import { countApplicantsAlreadyApproved, getSponsorshipLimit } from "../user/repository";
import { calculateAHPWeights, topsis } from "../utils/ranking";
import { Console } from "console";
const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

const progressionMap = {
  [APPLICATION_STAGE.POOLING]: {
    COMPLETE: {
      nextStage: APPLICATION_STAGE.APPLICATION_LIST,
      nextStatus: APPLICATION_STATUS.PENDING_APPLICATION_LIST,
    },
  },
  [APPLICATION_STAGE.APPLICATION_LIST]: {
    APPROVED: {
      nextStage: APPLICATION_STAGE.RANKING_SELECTION,
      nextStatus: APPLICATION_STATUS.PENDING_RANKING_SELECTION,
    },
  },
  [APPLICATION_STAGE.RANKING_SELECTION]: {
    RANKED: {
      nextStage: APPLICATION_STAGE.FINAS_PROPER,
      nextStatus: APPLICATION_STATUS.AWARDED,
    },
  },
};

export const createSponsorship = async (
  payload: SponsorshipRequest,
  authHeader: any
): Promise<SponsorshipResponse> => {
  const userDetails = extractUserFromToken(authHeader);
  const userId = userDetails.userId;

  return await prisma.$transaction(async (prisma) => {
    const data: Prisma.sponsorshipUncheckedCreateInput = toSponsorshipModel(
      payload,
      userId
    );
    const sponsorship: Prisma.sponsorshipUncheckedCreateInput =
      await createSponsorshipRepo(data, prisma); // Pass `prisma` to use transaction
    const sponsorshipId = binaryToUuid(sponsorship.id);

    // Create Sponsorship School data
    if (payload.sponsorshipSchool?.length) {
      const convertedSponSchool: Prisma.sponsorshipSchoolUncheckedCreateInput[] =
        toSponsorSchoolModel(
          payload.sponsorshipSchool,
          binaryToUuid(sponsorship.id)
        );
      await createSponsorshipSchoolRepo(convertedSponSchool, prisma);
    }

    // Create Sponsorship Requirements data
    if (payload.sponsorshipRequirements?.length) {
      const convertedSponReq: Prisma.sponsorshipRequirementUncheckedCreateInput[] =
        toSponsorReqModel(
          payload.sponsorshipRequirements,
          binaryToUuid(sponsorship.id)
        );
      await createSponsorshipRequirementRepo(convertedSponReq, prisma);
    }

    const sponsorshipData = await getOneSponsorshipRepo(sponsorshipId, prisma);
    return toSponsorshipResponse(sponsorshipData);
  }, {
    timeout: 30000 // in milliseconds
  });
};

export const applyToSponsorship = async (
  payload: ApplySponsorshipRequest,
  authHeader: any
): Promise<ApplySponsorshipResponse> => {
  const userDetails = extractUserFromToken(authHeader);
  const userId = userDetails.userId;

  return await prisma.$transaction(async (prisma) => {
    const appId = await generateAppId(payload.sponsorshipId);
    const apply: Prisma.sponsorshipApplicationUncheckedCreateInput =
      toApplyScholarship(payload, appId, userId);
    const data: any = await applyToSponsorshipRepo(apply, prisma);
    console.log("data apply", data);
    return toApplyScholarshipResponse(data);
  }, {
    timeout: 30000 // in milliseconds
  });
};

export const checkRemainingSlot = async (
  payload: ApplySponsorshipRequest
): Promise<boolean> => {

  const sponsorshipId = uuidToBinary(payload.sponsorshipId);
  const sponsorship = await prisma.sponsorship.findUnique({
    where: { id: sponsorshipId },
    select: { slot: true },
  });

  const currentApplicantsCount = await prisma.sponsorshipApplication.count({
    where: { 
      sponsorship_id: sponsorshipId,
      application_stage: APPLICATION_STAGE.APPLICATION_LIST,
    },
  });
  
  return sponsorship.slot == currentApplicantsCount;
};

export const checkSponsorshipLimit = async (
  payload: UpdateStudentStatusRequest
): Promise<boolean> => {

  if(payload.appStage == APPLICATION_STAGE.FINAS_PROPER && APPLICATION_STATUS.AWARDED) {
    const sponsorship = await getSponsorshipLimit( payload.sponsorshipId );
    const currentApprovedApplicants = await countApplicantsAlreadyApproved( payload.sponsorshipId );
    return sponsorship.limit <= currentApprovedApplicants;
  }

  return false;
};

export const cancelStudentApplication = async (
  studentId: string,
  sponsorshipId: string
): Promise<void> => {
  const app = await prisma.sponsorshipApplication.findFirst({
    where: {
      student_id: uuidToBinary(studentId),
      sponsorship_id: uuidToBinary(sponsorshipId),
      record_status: RecordStatus.ACTIVE,
    },
    select: { application_stage: true },
  });

  if (!app) {
    throw new Error("APPLICATION_NOT_FOUND");
  }

  if (app.application_stage !== APPLICATION_STAGE.POOLING) {
    throw new Error("CANNOT_CANCEL_APPLICATION");
  }

  await cancelStudentApplicationRepo(studentId, sponsorshipId, prisma);
};

export const getAllStudentSponsorship = async (
  studentId: string,
  authHeader: any,
  params: QueryParams
): Promise<{ data: ApplySponsorshipResponse[]; total: number }> => {
  const userDetails = extractUserFromToken(authHeader);
  const { data, total } = await getAllStudentSponsorshipRepo(studentId, params, prisma);

  if (!data || data.length === 0) {
    return { data: [], total: 0 };
  }

  const studentFiles: any[] = await getAllFileOfStudent(
    binaryToUuid(data[0].student.user_id)
  );

  return {
    data: data.map((e) => toApplyScholarshipResponse(e, studentFiles)),
    total,
  };
};

export const getOneStudentSponsorship = async (
  sponsorshipId: string,
  authHeader: any
): Promise<ApplySponsorshipResponse> => {
  const userDetails = extractUserFromToken(authHeader);
  const userId = userDetails.userId;
  const data: any = await getOneStudentSponsorshipRepo(sponsorshipId, prisma);
  const studentFiles: any[] = await getAllFileOfStudent(
    binaryToUuid(data.student.user_id)
  );

  return toApplyScholarshipResponse(data, studentFiles);
};

export const updateSponsorship = async (
  payload: SponsorshipRequest,
  authHeader: any,
  sponsorshipId: string
): Promise<SponsorshipResponse> => {
  const userDetails = extractUserFromToken(authHeader);
  const userId = userDetails.userId;

  return await prisma.$transaction(async (prisma) => {
    const data: Prisma.sponsorshipUncheckedCreateInput = toSponsorshipModel(
      payload,
      userId
    );
    await updateSponsorshipRepo(sponsorshipId, data, prisma);

    // delete school and requirements inside that sponsor
    await deleteAllSponsorshipSchools(sponsorshipId, prisma);
    await deleteAllSponsorshipRequirements(sponsorshipId, prisma);

    // create SponsorshipSchool data
    if (payload.sponsorshipSchool && payload.sponsorshipSchool.length > 0) {
      const convertedSponSchool: Prisma.sponsorshipSchoolUncheckedCreateInput[] =
        toSponsorSchoolModel(payload.sponsorshipSchool, sponsorshipId);
      await createSponsorshipSchoolRepo(convertedSponSchool, prisma);
    }

    // create Sponsorship Requirements data
    if (
      payload.sponsorshipRequirements &&
      payload.sponsorshipRequirements.length > 0
    ) {
      const convertedSponReq: Prisma.sponsorshipRequirementUncheckedCreateInput[] =
        toSponsorReqModel(payload.sponsorshipRequirements, sponsorshipId);
      await createSponsorshipRequirementRepo(convertedSponReq, prisma);
    }

    const sponsorshipData = await getOneSponsorshipRepo(sponsorshipId, prisma);
    return toSponsorshipResponse(sponsorshipData);
  }, {
    timeout: 30000 // in milliseconds
  });
};

export const getAllSponsorship = async (
  authHeader: string,
  params: QueryParams
): Promise<SponsorshipResponse[]> => {
  // check if student or sponsor
  const userDetails: { email: string; userId: string } =
    extractUserFromToken(authHeader);
  const userId: string = userDetails.userId;

  const whereCondition = {
    coordinator_id: uuidToBinary(userId),
    record_status: RecordStatus.ACTIVE,
  };

  const data: GetAllSponsorshipType[] = await getAllSponsorshipRepo(
    whereCondition,
    prisma,
    params
  );
  console.log("Get all sponsorship success");

  //get all student files
  const studentIds: string[] = [];
  data.forEach((item: GetAllSponsorshipType) => {
    if (item.sponsorshipApplication) {
      item.sponsorshipApplication.forEach((app) => {
        studentIds.push(binaryToUuid(app.student.id));
      });
    }
  });

  const bulkFiles = await getBulkFileOfStudents(studentIds);

  const filesByStudent = bulkFiles.reduce((acc, file) => {
    if (!acc[file.student_id]) acc[binaryToUuid(file.student_id)] = [];
    acc[binaryToUuid(file.student_id)].push({
      name: file.file_name,
      fileType: file.fileType.name,
    });
    return acc;
  }, {});

  const result = data.map((item: GetAllSponsorshipType) => {
    if (item.sponsorshipApplication) {
      item.sponsorshipApplication.forEach((app) => {
        app.student.files = filesByStudent[binaryToUuid(app.student.id)] || [];
      });
    }
    return toSponsorshipResponse(item);
  });

  return result;
};

export const getAllAvailableSponsorship = async (
  studentId: string,
  params: QueryParams
): Promise<SponsorshipResponse[]> => {
  let whereCondition: any = {};

  const studentCollegeSchoolID = await getStudentCollegeSchoolRepo(studentId);

  if (!studentCollegeSchoolID || studentCollegeSchoolID === null) {
    return [];
  }

  whereCondition = {
    record_status: RecordStatus.ACTIVE,
    schools: {
      some: {
        school_id: {
          equals: uuidToBinary(studentCollegeSchoolID),
        },
      },
    },
  };

  const data = await getAllSponsorshipRepo(whereCondition, prisma, params);
  return data.map((item) => toSponsorshipResponse(item));
};

export const getAllPublicSponsorship = async (
  params: QueryParams
): Promise<PaginatedPublicSponsorshipResponse> => {
  const { data, total } = await getAllPublicSponsorshipRepo(prisma, params);
  return {
    data: data.map((item) => toPublicSponsorshipResponse(item)),
    total,
  };
};

export const getOneSponsorship = async (
  sponsorshipId: string
): Promise<SponsorshipResponse> => {
  const data: GetAllSponsorshipType = await getOneSponsorshipRepo(
    sponsorshipId,
    prisma
  );

  //get all student files
  const studentIds = [];
  if (data.sponsorshipApplication) {
    data.sponsorshipApplication.forEach((app) => {
      studentIds.push(binaryToUuid(app.student.id));
    });
  }

  const bulkFiles = await getBulkFileOfStudents(studentIds);

  const filesByStudent = bulkFiles.reduce((acc, file) => {
    if (!acc[file.student_id]) acc[binaryToUuid(file.student_id)] = [];
    acc[binaryToUuid(file.student_id)].push({
      name: file.file_name,
      fileType: file.fileType.name,
    });
    return acc;
  }, {});

  if (data.sponsorshipApplication) {
    data.sponsorshipApplication.forEach((app) => {
      app.student.files = filesByStudent[binaryToUuid(app.student.id)] || [];
    });
  }

  const pairwiseData: SponsorshipCriteriaPairwise[] = await getAllSponsorshipCriterionPairwiseRepo(sponsorshipId, prisma);

  return toSponsorshipResponse(data, pairwiseData);
};

export const adjustStudentEligibilityStatus = async (
  studentId: string,
  details: UpdateStudentStatusRequest,
  authHeader: string
) => {
  const userDetails = extractUserFromToken(authHeader);
  const userId = userDetails.userId;
  let awardNumber: string = null;

  const next = progressionMap[details.appStage]?.[details.appStatus];
  if (next) {
    details.appStage = next.nextStage;
    details.appStatus = next.nextStatus;
  }

  if(next && details.appStage == APPLICATION_STAGE.FINAS_PROPER) {

    // coung grantee
    const sponsorship = await getSponsorshipBatchNumber(details.sponsorshipId, prisma);
    const granteeCount = await countNumberOfGrantee( prisma, details.sponsorshipId);
    const batchNumber = String(sponsorship.batch_number).padStart(3, "0");
    const granteeNumber = String(granteeCount + 1).padStart(4, "0");

    awardNumber = "AWD-" + batchNumber +"-"+ granteeNumber;
  }

  return await prisma.$transaction(async (prisma) => {
    const app = await findAppId(prisma, studentId, details.sponsorshipId);
    const converted: UpdateStudentStatus = toUpdateStatusModel(
      details,
      studentId,
      userId,
      awardNumber
    );
    await adjustStudentEligibilityStatusRepo(
      converted,
      binaryToUuid(app.id),
      prisma
    );

    const response = toUpdateStatusResponse(converted);
    return response;
  }, {
    timeout: 30000 // in milliseconds
  });
};

export const deleteOneSponsorship = async (sponsorshipId: string) => {
  await deleteOneSponsorshipRepo(sponsorshipId, prisma);
};

export const checkIfSponsorshipExist = async (
  name: string,
  batchNumber: number,
  sponsorshipId: any
): Promise<boolean> => {
  return await checkIfSponsorshipExistRepo(
    name,
    batchNumber,
    sponsorshipId,
    prisma
  );
};

export const checkSponsorshipId = async (
  sponsorshipId: string
): Promise<boolean> => {
  return await checkSponsorshipIdRepo(sponsorshipId, prisma);
};

export const doesStudentAlreadyApplied = async (
  studentId: string,
  sponsorshipId: string
): Promise<boolean> => {
  return await doesStudentAlreadyAppliedRepo(studentId, sponsorshipId, prisma);
};

export const checkBatch = async (
  batchNo: number,
  sponsorshipId: string
): Promise<boolean> => {
  return await checkBatchRepo(batchNo, sponsorshipId, prisma);
};

export const getCategoryCriterion = async (): Promise<
  criterionCategoryResponse[]
> => {
  const result: CriterionCategoryWithCriterion[] =
    await getCategoryCriterionRepo(prisma);
  return result.map((e) => toCriterionCategory(e));
};

export const checkCriterionCategoryId = async (
  criterionCategoryId: string
): Promise<boolean> => {
  return checkCriterionCategoryIdRepo(criterionCategoryId, prisma);
};

export const getDataSources = async(): Promise<DataSourceTable[]> => {

  const structuredData = Object.entries(TableColumnMap).map(([tableName, columns]) => ({
    name: tableName,
    columns: columns.map(column => ({ name: column }))
  }));
  return structuredData;
}

export const bulkUpsertCustomInput = async(payload: CustomInput[], authHeader: string): Promise<CustomInputResponse[]> => {
  return await prisma.$transaction(async (prisma: PrismaClient) => {
    const bulkCreateData: Prisma.customInputCriterionUncheckedCreateInput[] = [];
    const updatePromises: Promise<void>[] = [];
    const userDetails = extractUserFromToken(authHeader);
    const userId = userDetails.userId;

    for (const item of payload) { 
      const existing = await getUniqueCustomInput(item.studentId, item.sponsorshipCriterionId, item.sponsorshipId, prisma);
      const converted: Prisma.customInputCriterionUncheckedCreateInput = toCustomInputCriterion( item, userId );

      if(existing){
        updatePromises.push(
          updateCustomInput(
            converted,
            item.studentId,
            item.sponsorshipCriterionId,
            item.sponsorshipId,
            prisma
          )
        );
      } else {
        bulkCreateData.push(converted);
      }
    }

    if(bulkCreateData.length > 0) {
      await createBulkCustomInput( bulkCreateData, prisma );
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    const result: customInputCriterion[] = await getCustomInputRepo( payload[0].sponsorshipCriterionId, payload[0].sponsorshipId, "",
      null, prisma );

    return result.map(e => toCustomInputResponse(e));
  }, {
    timeout: 30000 // in milliseconds
  });
}


export const checkSponsorshipCriterionCategoryId = async ( criterionId: string ): Promise<boolean> => {
  return await checkSponsorshipCriterionCategoryIdRepo( criterionId, prisma );
}

export const getAllCriterionCustomInputValue = async( params: QueryParams ): Promise<CustomInputResponse[]> => {
  const studentId: string = params.studentId ? params.studentId : "";
  const result: customInputCriterion[] = await getCustomInputRepo( params.sponsorshipCriterionId, params.sponsorshipId, studentId,  params, prisma );
  return result.map(e => toCustomInputResponse(e));
}

export const rankStudent = async( sponsorshipId: string, ): Promise<SawScoreType[]> => {
  // pairwise

  const pairwiseMatrix: PairwiseMatrixEntry[] = await getPairwiseMatrixRepo( sponsorshipId, prisma );

  console.log('Pariwise matrix', pairwiseMatrix);

  const pairwiseMatrixConverted: CriteriaPairwiseConverted[] = pairwiseMatrix.map( e => toCriteriaPairwiseConverted( e ));

  console.log("pairwiseMatrixConverted 123", pairwiseMatrixConverted);

  const pairwise: PairwiseMatrixResult = generatePairwiseMatrix(pairwiseMatrixConverted);

  console.log("pairwise 123", pairwise);

  const weights: number[] = calculateAHPWeights(pairwise.matrix);

  // 2) extract the ordered list of criterion-A names
  const criterionNameInOrder: string[] = pairwise.criteriaOrder.map(
    entry => entry.criterionAName
  );

  console.log("Criterion name in order", criterionNameInOrder);
  
  const isBenefit: boolean[] = pairwise.criteriaOrder.map(
    entry => entry.preference === Preference.MAX
  );
  
  // get student applicants
  const applicants: QualifiedApplicants[] = await getQualifiedApplicants( sponsorshipId, prisma );

  if(applicants.length == 0) {
    return [];
  }

  const applicantsConverted: QualifiedApplicantsConverted[] = applicants.map( e => toConvertedQualifiedApplicants( e ));

  const processedApplicants: Record<string, any>[] = await processApplicantsData(applicantsConverted, pairwise.criteriaOrder);

  console.log("Processed Applicants", processedApplicants);
  console.debug("Applicants: ", applicantsConverted);
  console.debug("Pairwise matrix", pairwise.matrix);
  console.debug("Criterion to be used", criterionNameInOrder);
  console.debug("AHP Criteria Weights:", weights);
  console.debug("Criteria Order", pairwise.criteriaOrder);
  console.debug("Min/Max value", isBenefit);

  // final rankings
  const rankedApplicants: SawScoreType[] = topsis(processedApplicants, criterionNameInOrder, isBenefit, weights);
  console.debug("Final Rankings:", rankedApplicants);

  return rankedApplicants;
}

/**
 * Updates the sponsorship criterion along with required columns and pairwise data.
 *
 * This function handles both creation and update logic depending on whether the sponsorship
 * already has existing criteria. It performs all operations inside a Prisma transaction to 
 * maintain consistency.
 *
 * @param payload - The criterion data payload containing criteria, required columns, and pairwise comparisons.
 * @param sponsorshipId - The ID of the sponsorship this criterion belongs to.
 * @param authHeader - Authorization header for user context (unused in current implementation).
 * @returns CriterionResponse or null after updating/creating criteria.
 */
export const updateSponsorshipCriterion = async (
  payload: CriterionPayload,
  sponsorshipId: string,
  authHeader: string
): Promise<ToSponsorshipCriteriResponse | null> => {
  const categoryCriterionId: string = payload.criterionCategoryId;
  return await prisma.$transaction(async (prisma: PrismaClient) => {
    // get all sponsorhipCrierion data using sponsorshipId
    const sponsorshipCriterionData: sponsorshipCriterion[] =
      await getAllSponsorshipCriterionRepo(sponsorshipId, prisma);
    if (payload.criteria.length === 0) {
      return null;
    }

    // if the sponsorship still dont have criterion
    if (sponsorshipCriterionData.length == 0) {
      const sponsorshipCriterion: SponsorshipCriterion[] = [];
      for (const data of payload.criteria) {
        const sponsorshipCriterionData: sponsorshipCriterion =
          await handleCriterion(
            data,
            [],
            categoryCriterionId,
            sponsorshipId,
            [],
            "",
            "CREATE",
            prisma
          );
        
        // save required column
        if(data.dataSource !== 'CUSTOM_INPUT') { 
          if (data.requiredColumns.length > 0) {
            await bulkCreateRequiredColumn(
              data.requiredColumns,
              binaryToUuid(sponsorshipCriterionData.id),
              prisma
            );
          }
        }

        sponsorshipCriterion.push({
          id: binaryToUuid(sponsorshipCriterionData.id),
          name: sponsorshipCriterionData.name,
        });
      }

      // save the criterion pairwise
      if (payload.pairwise.length > 0) {
        await bulkCreatePairwiseCriterion(
          payload.pairwise,
          sponsorshipCriterion,
          sponsorshipId,
          prisma
        );
      }
    } else {
      const sponsorshipCrit: SponsorshipCriterion[] = [];
      // loop through the existing criterion data
      for (const data of payload.criteria) {
        const criteria = sponsorshipCriterionData.find(
          (c) => c.name === data.name
        );
        const convertedData: Prisma.sponsorshipCriterionUncheckedCreateInput = toSponsorshipCriterion(
          data,
          categoryCriterionId,
          sponsorshipId
        );
        console.log("data",convertedData);

        // Create or update the sponsorship criterion
        const sponsorshipCriterion = criteria
          ? await updateSponsorshipCriterionRepo(
              convertedData,
              binaryToUuid(criteria.id),
              prisma
            )
          : await createSponsorshipCriterionRepo(convertedData, prisma);
        console.log("Created/Updated sponsorship criterion");

        // Sync required columns
        if(data.dataSource !== 'CUSTOM_INPUT') {
          const sponsorshipCriterionId = binaryToUuid(sponsorshipCriterion.id);
          await syncRequiredColumns(
            data.requiredColumns,
            sponsorshipCriterionId,
            prisma
          );
          console.log("Sync required columns");
        }

        sponsorshipCrit.push({
          id: binaryToUuid(sponsorshipCriterion.id),
          name: sponsorshipCriterion.name,
        });
      }

      console.log("loop done");
      // sync pairwise data
      await syncPairwiseCriterion(
        payload.pairwise,
        sponsorshipCrit,
        sponsorshipId,
        prisma
      );
      console.log("Sync pairwise done");

      await handleCriterion(
        null,
        payload.criteria,
        "",
        "",
        sponsorshipCriterionData,
        "",
        "DELETE",
        prisma
      );
      console.log("Delete criterion done");
    }

    // get the details and pass it on front end
    const criterionResponse: SponsorshipCriterionModel[] = await getSponsorshipCriterionRepo( sponsorshipId, prisma );
    const criterionPairwiseResponse: SponsorshipCriteriaPairwise[] = await getAllSponsorshipCriterionPairwiseRepo( sponsorshipId, prisma);

    const convertedResponse: ToSponsorshipCriteriResponse = toSponsorshipCriteriResponse(criterionResponse, criterionPairwiseResponse, sponsorshipId, categoryCriterionId);
    return convertedResponse;
  }, {
    timeout: 30000 // in milliseconds
  });
};

/**
 * Handles create, update, or delete operations for a sponsorship criterion.
 *
 * Depending on the `action` parameter, this function:
 * - Creates a new criterion ("CREATE")
 * - Updates an existing criterion ("UPDATE")
 * - Deletes criteria that are no longer present in the provided `criterionArray` ("DELETE")
 *
 * @param criterion - The criterion to be created or updated (required for CREATE/UPDATE).
 * @param criterionArray - The latest array of criteria from the user (used for DELETE comparison).
 * @param categoryCriterionId - ID of the category this criterion belongs to.
 * @param sponsorshipId - ID of the sponsorship campaign.
 * @param sponsorshipCriterionData - Existing criteria in the database (used for DELETE comparison).
 * @param id - UUID of the criterion to update (required for UPDATE).
 * @param action - The action to perform: "CREATE" | "UPDATE" | "DELETE".
 * @param prisma - Prisma client instance.
 * @returns The created/updated criterion, or null if deleting.
 */
const handleCriterion = async (
  criterion: Criteria,
  criterionArray: Criteria[] = [],
  categoryCriterionId: string = "",
  sponsorshipId: string = "",
  sponsorshipCriterionData: sponsorshipCriterion[] = [],
  id: string = "",
  action: Action = "CREATE",
  prisma: PrismaClient
): Promise<sponsorshipCriterion | null> => {
  let convertedData: Prisma.sponsorshipCriterionUncheckedCreateInput;
  const deleteIds: string[] = [];

  if (['CREATE', 'UPDATE',].includes(action)) {
    convertedData = toSponsorshipCriterion(
      criterion,
      categoryCriterionId,
      sponsorshipId
    );
  }

  if (action == "CREATE") {
    return await createSponsorshipCriterionRepo(convertedData, prisma);
  } else if (action == "UPDATE") {
    return await updateSponsorshipCriterionRepo(convertedData, id, prisma);
  }
  console.log(criterionArray);
  for (const data of sponsorshipCriterionData) {
    const criteria = criterionArray.find((c) => c.name === data.name);
    if (!criteria) {
      deleteIds.push(binaryToUuid(data.id));
    }
  }

  if (deleteIds.length > 0) {
    await deleteManySponsorshipCriterionRepo(deleteIds, prisma);
  }
  return null;
};

/**
 * Bulk creates required columns associated with a specific sponsorship criterion.
 *
 * This function transforms the input `requiredColumns` into database-compatible format
 * and saves them in bulk to optimize performance.
 *
 * @param requiredColumns - Array of required column definitions to associate with the criterion.
 * @param sponsorshipCriterionDataId - The UUID of the criterion to link these columns to.
 * @param prisma - Prisma client instance.
 * @returns A promise that resolves once the required columns have been saved.
 */
const bulkCreateRequiredColumn = async (
  requiredColumns: RequiredColumns[],
  sponsorshipCriterionDataId: string = "",
  prisma: PrismaClient
): Promise<void> => {
  const bulk: Prisma.criterionRequiredColumnUncheckedCreateInput[] = [];
  for (const col of requiredColumns) {
    const convertedRequiredColumnData: Prisma.criterionRequiredColumnUncheckedCreateInput =
      toRequiredColumn(col, sponsorshipCriterionDataId);
    bulk.push(convertedRequiredColumnData);
  }

  await createManyRequiredColumnRepo(bulk, prisma);
};

/**
 * Bulk creates pairwise comparisons for sponsorship criteria.
 *
 * This function maps over the given `pairwise` data, matches each pair with their corresponding
 * criterion IDs from `sponsorshipCriterion`, converts them into a database-compatible format,
 * and performs a bulk insert.
 *
 * @param pairwise - Array of pairwise comparison data between criteria.
 * @param sponsorshipCriterion - Array of created or existing sponsorship criteria, used to resolve IDs.
 * @param sponsorshipId - The ID of the sponsorship to associate the pairwise data with.
 * @param prisma - Prisma client instance.
 * @returns A promise that resolves after saving all valid pairwise comparisons.
 */
const bulkCreatePairwiseCriterion = async (
  pairwise: Pairwise[],
  sponsorshipCriterion: SponsorshipCriterion[],
  sponsorshipId: string,
  prisma: PrismaClient
): Promise<void> => {
  const bulk: Prisma.sponsorshipCriteriaPairwiseUncheckedCreateInput[] = [];

  for (const pair of pairwise) {
    const criterionA = sponsorshipCriterion.find(
      (c) => c.name === pair.criteriaNameA
    );
    const criterionB = sponsorshipCriterion.find(
      (c) => c.name === pair.criteriaNameB
    );

    if (!criterionA || !criterionB) {
      continue;
    }

    const pairwiseConverted: Prisma.sponsorshipCriteriaPairwiseUncheckedCreateInput =
      toCriteriaPairwise(
        criterionA.id,
        criterionB.id,
        sponsorshipId,
        pair
      );
    bulk.push(pairwiseConverted);
  }

  await saveBulkPairwiseCriteriaRepo(bulk, prisma);
};

/**
 * Synchronizes the required columns for a given sponsorship criterion.
 *
 * This function compares incoming required columns against those already in the database.
 * It will:
 * - Add new required columns that don't exist yet
 * - Update existing ones if needed
 * - Delete any columns that were removed from the input
 *
 * @param incomingCols - The latest required column definitions from the user input.
 * @param sponsorshipCriterionId - The UUID of the sponsorship criterion to sync columns for.
 * @param prisma - Prisma client instance.
 * @returns A promise that resolves once all create/update/delete operations are complete.
 */
const syncRequiredColumns = async (
  incomingCols: RequiredColumns[],
  sponsorshipCriterionId: string,
  prisma: PrismaClient
): Promise<void> => {
  const existingCols: criterionRequiredColumn[] =
    await getAllRequiredColumnRepo(sponsorshipCriterionId, prisma);
  const bulk: Prisma.criterionRequiredColumnUncheckedCreateInput[] = [];
  const deleteIds: string[] = [];

  for (const reqCol of incomingCols) {
    const match: criterionRequiredColumn = existingCols.find(
      (c) => c.table === reqCol.table && c.column === reqCol.column
    );
    const converted: Prisma.criterionRequiredColumnUncheckedCreateInput =
      toRequiredColumn(reqCol, sponsorshipCriterionId);

    if (!match) {
      bulk.push(converted);
    } else {
      await updateRequiredColumnRepo(converted, binaryToUuid(match.id), prisma);
    }
  }

  if (bulk.length > 0) {
    console.log("bulk", bulk);
    await createManyRequiredColumnRepo(bulk, prisma);
  }

  for (const existing of existingCols) {
    const stillExists: RequiredColumns = incomingCols.find(
      (c) => c.table === existing.table && c.column === existing.column
    );
    if (!stillExists) {
      deleteIds.push(binaryToUuid(existing.id));
    }
  }

  if (deleteIds.length > 0) {
    await deleteManyRequiredColumnRepo(deleteIds, prisma);
  }
};

/**
 * Synchronizes pairwise comparison data for sponsorship criteria.
 *
 * This function performs a full sync by:
 * - Inserting new pairwise entries that don't yet exist
 * - Updating existing entries if the value has changed
 * - Deleting any existing pairwise entries that are no longer present in the input
 *
 * @param incomingPairwise - Array of new or updated pairwise comparisons.
 * @param sponsorshipCriterionData - Current list of sponsorship criteria used to resolve IDs.
 * @param sponsorshipId - The sponsorship ID these pairwise relationships belong to.
 * @param prisma - Prisma client instance for database operations.
 */
const syncPairwiseCriterion = async (
  incomingPairwise: Pairwise[],
  sponsorshipCriterionData: SponsorshipCriterion[],
  sponsorshipId: string,
  prisma: PrismaClient
): Promise<void> => {
  const bulk: Prisma.sponsorshipCriteriaPairwiseUncheckedCreateInput[] = [];
  const deleteIds: string[] = [];
  const updatePromises: Promise<void>[] = [];

  // Fetch existing pairwise data
  const existingData: sponsorshipCriteriaPairwise[] =
    await getAllCriterionPairwiseRepo(sponsorshipId, prisma);

  // Create lookup maps
  const existingMap = new Map<string, sponsorshipCriteriaPairwise>();
  for (const d of existingData) {
    const key = `${d.sponsorship_criterion_name_a}-${d.sponsorship_criterion_name_b}`;
    existingMap.set(key, d);
  }

  const criterionMap = new Map<string, SponsorshipCriterion>();
  for (const c of sponsorshipCriterionData) {
    criterionMap.set(c.name, c);
  }

  // Process incoming pairwise comparisons
  for (const pairwise of incomingPairwise) {
    const criterionA = criterionMap.get(pairwise.criteriaNameA);
    const criterionB = criterionMap.get(pairwise.criteriaNameB);

    if (!criterionA || !criterionB) continue;

    const key = `${pairwise.criteriaNameA}-${pairwise.criteriaNameB}`;
    const existing = existingMap.get(key);
    const newEntry = toCriteriaPairwise(
      criterionA.id,
      criterionB.id,
      sponsorshipId,
      pairwise
    );

    if (!existing) {
      bulk.push(newEntry);
    } else {
      // Only update if value has changed
      if (existing.value !== pairwise.value) {
        updatePromises.push(
          updatePairwiseCriteriaRepo(
            newEntry,
            binaryToUuid(existing.id),
            prisma
          )
        );
      }
      existingMap.delete(key); // Mark as processed
    }
  }

  // Insert new entries
  if (bulk.length > 0) {
    await saveBulkPairwiseCriteriaRepo(bulk, prisma);
  }

  // Perform updates
  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }

  // Delete unmatched existing entries
  for (const [key, unreferenced] of existingMap.entries()) {
    deleteIds.push(binaryToUuid(unreferenced.id));
  }

  if (deleteIds.length > 0) {
    await deleteManySponsorshipPairwiseCriterion(deleteIds, prisma);
  }
};


async function generateAppId(sponsorshipId: string) {
  const currentYear = new Date().getFullYear();
  const count: number = await generateAppIdRepo(sponsorshipId, prisma);
  const nextNumber = count + 1;

  // Pad the number with leading zeros
  const paddedNumber = String(nextNumber).padStart(5, "0");

  // Formulate app_id
  const appId = `${currentYear}-${paddedNumber}`;

  return appId;
}

const processApplicantsData = async ( 
  applicantsConverted: QualifiedApplicantsConverted[], 
  criteriaOrder: CriteriaPairwiseConverted[],
) : Promise<Record<string, any>[]> => {

  const applicantsDetails: Record<string, any>[] = [];
  console.log("applicants lenght",applicantsConverted.length);
  //loop through the applicants
  for(const applicant of applicantsConverted) {
    const dynamicObject: Record<string, any> = {};
    dynamicObject['id'] = applicant.studentId;
    dynamicObject['name'] = applicant.student.first_name + ' ' + applicant.student.middle_name + ' ' + applicant.student.last_name;
    //loop through each criteria to get the value
    for(const criteria of criteriaOrder) {
      console.log("criteria 123", criteria);
      switch (criteria.dataSource) {
        case DataSource.COLUMN:
          const requiredColumn: criterionRequiredColumn[] = await getRequiredColumn( criteria.criterionAId, prisma );
          let total = 0;

          if(requiredColumn.length > 0) {
            for( const cfg of requiredColumn ) {
              const tableName: string  = cfg.table;  
              const columnName: string = cfg.column; 
              const record: number = await getColumnData( tableName, columnName, applicant.studentId, prisma );
              console.log(`${criteria.criterionAName} value :`, record);
              total = record;
            }
          }
          dynamicObject[criteria.criterionAName] = total;
          break;
        case DataSource.COMPUTED:
          const requiredColumnComputed: criterionRequiredColumn[] = await getRequiredColumn( criteria.criterionAId, prisma );
          let totalComputed = 0;

          if(requiredColumnComputed.length > 0) {
            for( const cfg of requiredColumnComputed ) {
              const tableName: string  = cfg.table;  
              const columnName: string = cfg.column; 
              const record: number = await getColumnData( tableName, columnName, applicant.studentId, prisma );
              console.log(`${criteria.criterionAName} value :`, record);
              totalComputed += record;
            }

            totalComputed = criteria.formulaType == FormulaType.AVG ? totalComputed / requiredColumnComputed.length : totalComputed;
          }

          dynamicObject[criteria.criterionAName] = totalComputed;
          break;
      
        default:
          console.log("custom input", criteria);
          const value: number = await getCriterionCustomInputValue( criteria.criterionAId, applicant.studentId, prisma);
          dynamicObject[criteria.criterionAName] = value;
          break;
      }
    }
    applicantsDetails.push(dynamicObject);
  }

  console.log("applicants details", applicantsDetails);
  return applicantsDetails;
}

function generatePairwiseMatrix(
  data: CriteriaPairwiseConverted[]
): PairwiseMatrixResult {
  // 1. Extract unique names but *also* keep a reference to one object
  const map = new Map<string, CriteriaPairwiseConverted>();

  data.forEach(item => {
    if (!map.has(item.criterionAName)) 
      map.set(item.criterionAName, { 
        criterionAId: item.criterionAId,
        criterionAName: item.criterionAName,
        criterionBId: item.criterionBId,        // you might need to pick which B-fields make sense here
        criterionBName: item.criterionBName,    // or omit B-fields if irrelevant
        value: item.value,
        dataSource: item.dataSource,
        formulaType: item.formulaType,
        preference: item.preference,
      }
    );

    // Add criterion B if not yet added
    if (!map.has(item.criterionBName)) {
      map.set(item.criterionBName, {
        criterionAId: item.criterionBId,
        criterionAName: item.criterionBName,
        dataSource: item.dataSource,
        formulaType: item.formulaType,
        preference: item.preference,
      } as CriteriaPairwiseConverted);
    }
  });

  const criteriaOrder = Array.from(map.values());

  // 2. Build index map from names
  const indexMap = Object.fromEntries(
    criteriaOrder.map((c, i) => [c.criterionAName, i])
  );

  console.log('criterioORder', criteriaOrder);
  console.log('index map', indexMap);
  // 3. Initialize & fill your matrix exactly as before
  const size = criteriaOrder.length;
  const matrix: number[][] = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i === j ? 1 : 0))
  );

  console.log(data);
  console.log(indexMap);

  for (const item of data) {
    const i = indexMap[item.criterionAName];
    const j = indexMap[item.criterionBName];

    console.log(i,j);

    if (i === j) continue;
    matrix[i][j] = item.value;
    matrix[j][i] = 1 / item.value;
  }

  return { criteriaOrder, matrix };
}

function normalizeSAW(data: Record<string, any>[], criteria: string[], isBenefit: boolean[]): number[][] {
    return criteria.map((criterion, index) => {
        const values: number[] = data.map(applicant => {
            if (typeof applicant[criterion] !== 'number') {
                throw new Error(`Invalid value for criterion ${criterion} in applicant ${applicant.id}`);
            }
            return applicant[criterion];
        });
        const max: number = Math.max(...values);
        const min: number = Math.min(...values);

        if (max === min) {
            return data.map(() => 1);
        }
        
        return data.map(applicant => isBenefit[index] ? applicant[criterion] / max : min / applicant[criterion]);
    });
}

function calculateSAWScores(normalizedMatrix: number[][], weights: number[], applicants: Record<string, any>[], criteriaNames: string[]): SawScoreType[] {
  return applicants.map((applicant, i) => {
      const score: number = criteriaNames.reduce((sum, _, j) => sum + (normalizedMatrix[j][i] * weights[j]), 0);
      return { id: applicant.id, name: applicant.name, score, evaluation: [] };
  });
}

export const getAllApplicantsByStage = async (
  params: QueryParams
): Promise<ConvertedGetAllApplicantsByStageResult> => {

  const data: GetAllApplicantsByStageResult = await getAllApplicantsByStageRepo(
    params, prisma
  );

  const converted: applicants[] = data.data.map( e => toConvertedApplicants(e));

  const response: ConvertedGetAllApplicantsByStageResult = {
    applicants: converted,
    totalCount: data.totalCount
  }

  return response;
};