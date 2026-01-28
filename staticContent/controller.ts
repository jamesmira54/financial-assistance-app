import { Router, Request, Response } from 'express';
import { ResponseHandler } from '../response';
import {
    createOrUpdateStaticContent,
    getStaticContentByType,
    getAllStaticContent,
    deleteStaticContent,
    getAvailableContentTypes,
    StaticContentPayload
} from './service';
import { allowRoles, authentication } from '../middleware/authentication';

export default () => {
    const staticContentAPI = Router();

    // Create or Update static content (admin only)
    // Using PUT since content types are unique and this upserts
    staticContentAPI.put(
        '/:contentType',
        authentication,
        allowRoles('system admin'),
        async (req: Request, res: Response): Promise<void> => {
            try {
                const authHeader: string = req.headers.authorization as string;
                const contentType = req.params.contentType as string;
                const payload: StaticContentPayload = {
                    title: req.body.title,
                    content: req.body.content
                };

                if (!payload.title || !payload.content) {
                    ResponseHandler.invalidRequest(req, res, 'Title and content are required');
                    return;
                }

                const response = await createOrUpdateStaticContent(
                    contentType.toUpperCase(),
                    payload,
                    authHeader
                );
                ResponseHandler.ok(req, res, response);
            } catch (err) {
                ResponseHandler.invalidRequest(req, res, err.message);
            }
        }
    );

    // Delete static content (admin only)
    staticContentAPI.delete(
        '/:contentType',
        authentication,
        allowRoles('system admin'),
        async (req: Request, res: Response): Promise<void> => {
            try {
                const contentType = req.params.contentType as string;
                await deleteStaticContent(contentType.toUpperCase());
                ResponseHandler.updated(req, res, 'Content deleted successfully');
            } catch (err) {
                ResponseHandler.invalidRequest(req, res, err.message);
            }
        }
    );

    // Get static content by type (public)
    staticContentAPI.get('/:contentType', async (req: Request, res: Response): Promise<void> => {
        try {
            const contentType = req.params.contentType as string;
            const response = await getStaticContentByType(contentType.toUpperCase());

            if (!response) {
                ResponseHandler.ok(req, res, { message: 'Content not found', data: null });
                return;
            }

            ResponseHandler.ok(req, res, response);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    // Get all static content (public)
    staticContentAPI.get('/', async (req: Request, res: Response): Promise<void> => {
        try {
            const response = await getAllStaticContent();
            ResponseHandler.ok(req, res, response);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    // Get available content types (public)
    staticContentAPI.get('/meta/types', async (req: Request, res: Response): Promise<void> => {
        try {
            const types = getAvailableContentTypes();
            ResponseHandler.ok(req, res, { types });
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    return staticContentAPI;
};
