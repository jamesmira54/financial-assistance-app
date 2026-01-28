import { Router, Request, Response, NextFunction } from 'express';
import { ResponseHandler } from '../response';
import { getQueryParams, QueryParams } from '../utils';
import {
    createFaq,
    updateFaq,
    deleteFaq,
    getOneFaq,
    getAllFaqs,
    getFaqCategories,
    doesFaqExist,
    FaqPayload
} from './service';
import { allowRoles, authentication } from '../middleware/authentication';

// Middleware to check if FAQ exists
const checkFaqExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const faqId = req.params.faqId as string;
        const exists = await doesFaqExist(faqId);
        if (!exists) {
            ResponseHandler.invalidRequest(req, res, 'FAQ not found');
            return;
        }
        next();
    } catch (err) {
        ResponseHandler.invalidRequest(req, res, err.message);
    }
};

export default () => {
    const faqAPI = Router();

    // Create FAQ (admin only)
    faqAPI.post(
        '/',
        authentication,
        allowRoles('system admin', 'financial assistance coordinator'),
        async (req: Request, res: Response): Promise<void> => {
            try {
                const authHeader: string = req.headers.authorization as string;
                const payload: FaqPayload = {
                    question: req.body.question,
                    answer: req.body.answer,
                    category: req.body.category,
                    sortOrder: req.body.sortOrder
                };

                if (!payload.question || !payload.answer) {
                    ResponseHandler.invalidRequest(req, res, 'Question and answer are required');
                    return;
                }

                const response = await createFaq(payload, authHeader);
                ResponseHandler.created(req, res, response);
            } catch (err) {
                ResponseHandler.invalidRequest(req, res, err.message);
            }
        }
    );

    // Update FAQ (admin only)
    faqAPI.put(
        '/:faqId',
        authentication,
        allowRoles('system admin', 'financial assistance coordinator'),
        checkFaqExists,
        async (req: Request, res: Response): Promise<void> => {
            try {
                const authHeader: string = req.headers.authorization as string;
                const faqId = req.params.faqId as string;
                const payload: FaqPayload = {
                    question: req.body.question,
                    answer: req.body.answer,
                    category: req.body.category,
                    sortOrder: req.body.sortOrder
                };

                if (!payload.question || !payload.answer) {
                    ResponseHandler.invalidRequest(req, res, 'Question and answer are required');
                    return;
                }

                const response = await updateFaq(faqId, payload, authHeader);
                ResponseHandler.updated(req, res, response);
            } catch (err) {
                ResponseHandler.invalidRequest(req, res, err.message);
            }
        }
    );

    // Delete FAQ (admin only)
    faqAPI.delete(
        '/:faqId',
        authentication,
        allowRoles('system admin', 'financial assistance coordinator'),
        checkFaqExists,
        async (req: Request, res: Response): Promise<void> => {
            try {
                const faqId = req.params.faqId as string;
                await deleteFaq(faqId);
                ResponseHandler.updated(req, res, 'FAQ deleted successfully');
            } catch (err) {
                ResponseHandler.invalidRequest(req, res, err.message);
            }
        }
    );

    // Get single FAQ (public)
    faqAPI.get('/:faqId', checkFaqExists, async (req: Request, res: Response): Promise<void> => {
        try {
            const faqId = req.params.faqId as string;
            const response = await getOneFaq(faqId);
            ResponseHandler.ok(req, res, response);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    // Get all FAQs (public - no auth required)
    faqAPI.get('/', async (req: Request, res: Response): Promise<void> => {
        try {
            const params: QueryParams = getQueryParams(req);
            const category = req.query.category as string | undefined;
            const response = await getAllFaqs(params, category);
            ResponseHandler.ok(req, res, response);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    // Get FAQ categories (public)
    faqAPI.get('/meta/categories', async (req: Request, res: Response): Promise<void> => {
        try {
            const categories = await getFaqCategories();
            ResponseHandler.ok(req, res, { categories });
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    return faqAPI;
};
