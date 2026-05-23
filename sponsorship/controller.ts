import { Router } from "express";
import { validateApplyScholarship, validateBulkCustomInputPayload, validateChangeStudentStatus, validateCustomInputPayload, validatedAppStageParams, validateGetAllCustomInput, validateQueryParams, validateSponsorship, validateSponsorshipId, validateStudentId, validateUpdateCriterionPayload } from "../middleware/validation";
import { ResponseHandler } from "../response";
import { ApplySponsorshipRequest, ApplySponsorshipResponse, ConvertedGetAllApplicantsByStageResult, criterionCategoryResponse, CriterionPayload, CriterionResponse, CustomInput, CustomInputResponse, DataSourceTable, ERROR_MESSAGES, getQueryParams, PairwiseMatrixResult, QueryParams, SawScoreType, SponsorshipRequest, SponsorshipResponse, SUCCESS_MESSAGES, ToSponsorshipCriteriResponse, UpdateStudentStatusRequest, VALIDATION_MESSAGES } from "../utils";
import { adjustStudentEligibilityStatus, applyToSponsorship, bulkUpsertCustomInput, cancelStudentApplication, checkRemainingSlot, checkSponsorshipLimit, createSponsorship, deleteOneSponsorship, getAllApplicantsByStage, getAllAvailableSponsorship, getAllCriterionCustomInputValue, getAllSponsorship, getAllStudentSponsorship, getCategoryCriterion, getDataSources, getOneSponsorship, getOneStudentSponsorship, rankStudent, updateSponsorship, updateSponsorshipCriterion } from "./service";
import { allowRoles } from "../middleware/authentication";

export default () => {

    // for coordinator

    const sponsorshipAPI = Router();

    sponsorshipAPI.post('/coordinator', allowRoles('system admin', 'financial assistance coordinator' ), validateSponsorship, async (req, res) => {

        try {
            const payload: SponsorshipRequest = req.body;
            const authHeader = req.headers.authorization;
            const data: SponsorshipResponse = await createSponsorship( payload, authHeader );
            ResponseHandler.created(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    }); 

    sponsorshipAPI.put('/coordinator/:sponsorshipId', allowRoles('system admin', 'financial assistance coordinator' ), validateSponsorship, validateSponsorshipId, async (req, res) => {

        try {
            const { sponsorshipId } = req.params;
            const payload: SponsorshipRequest = req.body;
            const authHeader = req.headers.authorization;
            const data: SponsorshipResponse = await updateSponsorship( payload, authHeader, sponsorshipId );
            ResponseHandler.updated(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    }); 

    sponsorshipAPI.get('/coordinator/:sponsorshipId', allowRoles('system admin', 'financial assistance coordinator', ), validateSponsorshipId, async (req, res) => {

        try {
            const { sponsorshipId } = req.params;
            const data: SponsorshipResponse = await getOneSponsorship( sponsorshipId );
            ResponseHandler.ok(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    }); 

    sponsorshipAPI.delete('/coordinator/:sponsorshipId', allowRoles('system admin', 'financial assistance coordinator', ), validateSponsorshipId, async (req, res) => {

        try {
            const { sponsorshipId } = req.params;
            await deleteOneSponsorship( sponsorshipId );
            ResponseHandler.deleted(req, res, SUCCESS_MESSAGES.SPONSORSHIP_DELETED);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    }); 

    sponsorshipAPI.get('/coordinator', allowRoles('system admin', 'financial assistance coordinator' ), validateQueryParams , async (req, res) => {

        try {

            const params: QueryParams = getQueryParams(req);
            console.log("parameter", params);
            const authHeader: string = req.headers.authorization;
            const data: SponsorshipResponse[] = await getAllSponsorship( authHeader, params );
            ResponseHandler.ok(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    }); 

    sponsorshipAPI.get('/criterion-category', allowRoles('system admin', 'financial assistance coordinator' ), validateQueryParams , async (req, res) => {

        try {
            const data: criterionCategoryResponse[] = await getCategoryCriterion();
            ResponseHandler.ok(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    }); 

    sponsorshipAPI.get('/applicants/by-stage', allowRoles('system admin', 'financial assistance coordinator' ), validateQueryParams, validatedAppStageParams, async (req, res) => {
        try {
            const params: QueryParams = getQueryParams(req);
            console.log("parameter", params);
            const data: ConvertedGetAllApplicantsByStageResult = await getAllApplicantsByStage( params );
            ResponseHandler.ok(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    })

    sponsorshipAPI.put('/update-criterion/:sponsorshipId', allowRoles('system admin', 'financial assistance coordinator' ), validateSponsorshipId,validateUpdateCriterionPayload, async (req, res) => {
        try {
            const payload: CriterionPayload = req.body;
            const authHeader: string = req.headers.authorization;
            const { sponsorshipId } = req.params;
            const result: ToSponsorshipCriteriResponse | null = await updateSponsorshipCriterion( payload, sponsorshipId, authHeader );
            ResponseHandler.updated( req, res, result);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });

    sponsorshipAPI.post('/bulk-upsert-custom-input', allowRoles('system admin', 'financial assistance coordinator' ), validateBulkCustomInputPayload, async (req, res) => {
        try {
            const payload: CustomInput[] = req.body;
            const authHeader: string = req.headers.authorization;
            const result: CustomInputResponse[] = await bulkUpsertCustomInput( payload, authHeader );
            ResponseHandler.created( req, res, result);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });

    sponsorshipAPI.get('/custom-input', allowRoles('system admin', 'financial assistance coordinator' ), validateGetAllCustomInput, async (req, res) => {
        try {
            const params: QueryParams = getQueryParams(req);
            const result: CustomInputResponse[] = await getAllCriterionCustomInputValue( params );
            ResponseHandler.created( req, res, result);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });

    sponsorshipAPI.get('/criterion-category/data-sources', allowRoles('system admin', 'financial assistance coordinator' ), async (req, res) => {
        try {
            const result: DataSourceTable[] = await getDataSources();
            ResponseHandler.ok( req, res, result);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });

    sponsorshipAPI.put('/coordinator/students/:studentId/status', allowRoles('system admin', 'financial assistance coordinator' ), validateStudentId, validateChangeStudentStatus, async (req, res)  => {
        try {
            const authHeader: string = req.headers.authorization;
            const { studentId } = req.params;
            const payload: UpdateStudentStatusRequest = req.body;

            const noAvailableSlot: boolean = await checkSponsorshipLimit( payload );

            if( noAvailableSlot ) {
                ResponseHandler.invalidRequest(req, res, VALIDATION_MESSAGES.LIMIT_REACHED);
            } else {
                const response = await adjustStudentEligibilityStatus(studentId, payload, authHeader);
                ResponseHandler.updated(req, res, response);
            }
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });

    sponsorshipAPI.get('/rank-student/:sponsorshipId', allowRoles('system admin', 'financial assistance coordinator' ), validateSponsorshipId, async (req, res) => {
        try {
            const { sponsorshipId } = req.params;
            const result: SawScoreType[] = await rankStudent( sponsorshipId );
            ResponseHandler.ok( req, res, result);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });

    // for students

    sponsorshipAPI.get('/student/available', (req, res) => {
        ResponseHandler.internalServerError( req, res, VALIDATION_MESSAGES.STUDENT_ID_REQUIRED);
    });
    sponsorshipAPI.get('/student/available/:studentId', allowRoles('system admin', 'student' ), validateStudentId, validateQueryParams, async (req, res) => {

        try {
            const { studentId } = req.params;
            const params: QueryParams = getQueryParams(req);
            const data: SponsorshipResponse[] = await getAllAvailableSponsorship( studentId, params );
            ResponseHandler.ok(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    }); 

    sponsorshipAPI.get('/student/:sponsorshipId', allowRoles('system admin', 'student' ), validateSponsorshipId, async (req, res) => {

        try {

            const authHeader = req.headers.authorization;
            const { sponsorshipId } = req.params;
            const data: ApplySponsorshipResponse = await getOneStudentSponsorship( sponsorshipId, authHeader );
            ResponseHandler.ok(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    }); 

    sponsorshipAPI.post('/student/', allowRoles('system admin', 'student'),  validateApplyScholarship, async (req, res) => {

        try {
            const authHeader = req.headers.authorization;
            const payload: ApplySponsorshipRequest = req.body;

            const noAvailableSlot: boolean = await checkRemainingSlot( payload);

            if( noAvailableSlot ) {
                ResponseHandler.invalidRequest(req, res, VALIDATION_MESSAGES.SLOT_FULL);
            } else {
                const data: ApplySponsorshipResponse = await applyToSponsorship( payload, authHeader );
                ResponseHandler.ok(req, res, data);
            }
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    }); 

    sponsorshipAPI.delete('/student/:studentId/cancel/:sponsorshipId', allowRoles('system admin', 'student'), validateStudentId, validateSponsorshipId, async (req, res) => {
        try {
            const { studentId, sponsorshipId } = req.params;
            await cancelStudentApplication(studentId, sponsorshipId);
            ResponseHandler.deleted(req, res, 'Application successfully cancelled.');
        } catch (err) {
            if (err.message === 'APPLICATION_NOT_FOUND') {
                ResponseHandler.invalidRequest(req, res, VALIDATION_MESSAGES.APPLICATION_NOT_FOUND);
            } else if (err.message === 'CANNOT_CANCEL_APPLICATION') {
                ResponseHandler.invalidRequest(req, res, VALIDATION_MESSAGES.CANNOT_CANCEL_APPLICATION);
            } else {
                ResponseHandler.invalidRequest(req, res, err.message);
            }
        }
    });

    sponsorshipAPI.get('/student/my-sponsorships/:studentId', allowRoles('system admin', 'student'), validateStudentId, validateQueryParams, async (req, res) => {

        try {

            const authHeader = req.headers.authorization;
            const { studentId } = req.params;
            const params: QueryParams = getQueryParams(req);
            const result = await getAllStudentSponsorship( studentId, authHeader, params );
            ResponseHandler.ok(req, res, result);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });
    return sponsorshipAPI;
}