import { Router } from "express";
import { ResponseHandler } from "../response";
import { edit, fetch, list, remove, store } from "./service";
import { getQueryParams, QueryParams, ScheduleRequest, VALIDATION_MESSAGES } from "../utils";
import { validateScheduleId, validateSchedulePayload } from "../middleware/validation";
import { allowRoles } from "../middleware/authentication";



export default () => {

    const scheduleAPI = Router();

    scheduleAPI.post('/', allowRoles('system admin', 'financial assistance coordinator' ), validateSchedulePayload,  async (req, res) => {
        try {
            const authHeader: string = req.headers.authorization;
            const payload: ScheduleRequest = req.body;
            const data = await store( payload, authHeader );
            ResponseHandler.created(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });

    scheduleAPI.put('/:scheduleId', allowRoles('system admin', 'financial assistance coordinator' ), validateScheduleId , validateSchedulePayload,  async (req, res) => {
        try {
            const { scheduleId } = req.params;
            const authHeader: string = req.headers.authorization;
            const payload: ScheduleRequest = req.body;
            const data = await edit( payload, scheduleId, authHeader );
            ResponseHandler.updated(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });

    scheduleAPI.get('/', async (req, res) => {
        try {
            const authHeader: string = req.headers.authorization;
            const params: QueryParams = getQueryParams(req);
            const data = await list( authHeader, params );
            ResponseHandler.ok(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });

    scheduleAPI.get('/:scheduleId', validateScheduleId , async (req, res) => {
        try {
            const { scheduleId } = req.params;
            const data = await fetch( scheduleId );
            ResponseHandler.ok(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });

    scheduleAPI.delete('/:scheduleId', allowRoles('system admin', 'financial assistance coordinator' ), validateScheduleId , async (req, res) => {
        try {
            const { scheduleId } = req.params;
            await remove( scheduleId );
            ResponseHandler.deleted(req, res, VALIDATION_MESSAGES.SCHEDULE_DELETED);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    });

    return scheduleAPI;
}