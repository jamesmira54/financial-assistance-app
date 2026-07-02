import { Router } from "express";
import { ResponseHandler } from "../response";
import { ACADEMIC_STRANDS, AWARD_HONORS, getQueryParams, GetStudentFile, QueryParams, StudentRequest } from "../utils";
import { getAllStudent, getOneStudent, getStudentFiles, updateStudentService } from "./service";
import { validateStudentRegistration, validateUpdateStudent, validateGetOneStudent, validateStudentId, validateQueryParams } from "../middleware/validation";


export default () => {

    const studentAPI = Router();

    studentAPI.post('/', validateStudentRegistration, async (req, res) => {

        try {
            const data: StudentRequest = req.body;
            const authHeader = req.headers.authorization;

            // const result = await registerStudentService(data, authHeader);
            ResponseHandler.created(req, res, "API has been disable for now");
        } catch (err) {
            ResponseHandler.invalidRequest(req, res , err.message);
        }
    });

    studentAPI.put('/:studentId', validateUpdateStudent, async (req, res) => {

        try {
            
            const data: StudentRequest = req.body;
            const authHeader = req.headers.authorization;
            const { studentId } = req.params;

            const result = await updateStudentService(data, authHeader, studentId);
            ResponseHandler.updated(req, res, result);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res , err.message);
        }
    });

    // Static lookups. Registered before '/:studentId' so they are not captured as a studentId param.
    studentAPI.get('/academic-strands', async (req, res) => {
        ResponseHandler.ok(req, res, ACADEMIC_STRANDS);
    });

    studentAPI.get('/award-honors', async (req, res) => {
        ResponseHandler.ok(req, res, AWARD_HONORS);
    });

    studentAPI.get('/:studentId', validateStudentId, async (req, res) => {
        try {

            const { studentId } = req.params;
            const result = await getOneStudent( studentId );
            ResponseHandler.ok(req, res, result);

        } catch (err) {
            ResponseHandler.internalServerError(req, res , err.message);
        }
    })

    studentAPI.get('/files/:studentId', validateStudentId, async (req, res) => { 
        try {

            const { studentId } = req.params;
            const result: GetStudentFile[] = await getStudentFiles( studentId );
            ResponseHandler.ok(req, res, result);

        } catch (err) {
            ResponseHandler.internalServerError(req, res , err.message);
        }
    })

    studentAPI.get('/', validateQueryParams, async (req, res) => { 
        try {

            const params: QueryParams = getQueryParams(req);
            const result = await getAllStudent( params );
            ResponseHandler.ok(req, res, result);

        } catch (err) {
            ResponseHandler.internalServerError(req, res , err.message);
        }
    })


    return studentAPI;
}


