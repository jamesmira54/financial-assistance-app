import { Router, Request, Response, NextFunction } from "express";
import { ResponseHandler } from "../response";
import { getQueryParams, QueryParams } from "../utils";
import {
    createResource,
    deleteResource,
    doesResourceExist,
    downloadResource,
    getAllResources,
    getOneResource,
    updateResource,
    ResourcePayload,
    ResourceResponse
} from "./service";
import { upload } from "../middleware/uploads";
import { allowRoles } from "../middleware/authentication";
import path from "path";

// Middleware to check if resource exists
const checkResourceExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const resourceId = req.params.resourceId as string;
        const exists = await doesResourceExist(resourceId);
        if (!exists) {
            ResponseHandler.invalidRequest(req, res, "Resource not found");
            return;
        }
        next();
    } catch (err) {
        ResponseHandler.invalidRequest(req, res, err.message);
    }
};

export default () => {
    const resourceAPI = Router();

    // Create resource (admin only)
    resourceAPI.post(
        '/',
        allowRoles('system admin', 'financial assistance coordinator'),
        upload.single("file"),
        async (req: Request, res: Response): Promise<void> => {
            try {
                if (!req.file) {
                    ResponseHandler.invalidRequest(req, res, "File is required");
                    return;
                }

                const authHeader: string = req.headers.authorization as string;
                const payload: ResourcePayload = {
                    title: req.body.title,
                    description: req.body.description,
                    category: req.body.category
                };

                if (!payload.title) {
                    ResponseHandler.invalidRequest(req, res, "Title is required");
                    return;
                }

                const response: ResourceResponse = await createResource(payload, req.file, authHeader);
                ResponseHandler.created(req, res, response);
            } catch (err) {
                ResponseHandler.invalidRequest(req, res, err.message);
            }
        }
    );

    // Update resource
    resourceAPI.put(
        '/:resourceId',
        allowRoles('system admin', 'financial assistance coordinator'),
        checkResourceExists,
        upload.single("file"),
        async (req: Request, res: Response): Promise<void> => {
            try {
                const authHeader: string = req.headers.authorization as string;
                const resourceId = req.params.resourceId as string;
                const payload: ResourcePayload = {
                    title: req.body.title,
                    description: req.body.description,
                    category: req.body.category
                };

                if (!payload.title) {
                    ResponseHandler.invalidRequest(req, res, "Title is required");
                    return;
                }

                const response: ResourceResponse = await updateResource(
                    payload,
                    resourceId,
                    req.file,
                    authHeader
                );
                ResponseHandler.updated(req, res, response);
            } catch (err) {
                ResponseHandler.invalidRequest(req, res, err.message);
            }
        }
    );

    // Delete resource (soft delete)
    resourceAPI.delete(
        '/:resourceId',
        allowRoles('system admin', 'financial assistance coordinator'),
        checkResourceExists,
        async (req: Request, res: Response): Promise<void> => {
            try {
                const resourceId = req.params.resourceId as string;
                await deleteResource(resourceId);
                ResponseHandler.updated(req, res, "Resource deleted successfully");
            } catch (err) {
                ResponseHandler.invalidRequest(req, res, err.message);
            }
        }
    );

    // Get single resource
    resourceAPI.get('/:resourceId', checkResourceExists, async (req: Request, res: Response): Promise<void> => {
        try {
            const resourceId = req.params.resourceId as string;
            const response: ResourceResponse | null = await getOneResource(resourceId);
            ResponseHandler.ok(req, res, response);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    // Get all resources (public - no auth required for listing)
    resourceAPI.get('/', async (req: Request, res: Response): Promise<void> => {
        try {
            const params: QueryParams = getQueryParams(req);
            const response: ResourceResponse[] = await getAllResources(params);
            ResponseHandler.ok(req, res, response);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    // Download resource file
    resourceAPI.get('/:resourceId/download', checkResourceExists, async (req: Request, res: Response): Promise<void> => {
        try {
            const resourceId = req.params.resourceId as string;
            const resource = await downloadResource(resourceId);

            if (!resource) {
                ResponseHandler.invalidRequest(req, res, "Resource not found");
                return;
            }

            const filePath = path.resolve(resource.file_path);
            res.download(filePath, resource.file_name, (err) => {
                if (err) {
                    ResponseHandler.invalidRequest(req, res, "Error downloading file");
                }
            });
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    return resourceAPI;
};
