import { Router, Request, Response, NextFunction } from "express";
import { ResponseHandler } from "../response";
import {
    deleteNotification,
    doesNotificationExist,
    getMyNotifications,
    getNotificationById,
    getUnreadCount,
    markAllAsRead,
    markAsRead,
    NotificationResponse
} from "./service";

// Middleware to check if notification exists and belongs to user
const checkNotificationExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const notificationId = req.params.notificationId as string;
        const authHeader = req.headers.authorization as string;
        const exists = await doesNotificationExist(notificationId, authHeader);
        if (!exists) {
            ResponseHandler.invalidRequest(req, res, "Notification not found");
            return;
        }
        next();
    } catch (err) {
        ResponseHandler.invalidRequest(req, res, err.message);
    }
};

export default () => {
    const notificationAPI = Router();

    // Get all notifications for current user
    notificationAPI.get('/', async (req: Request, res: Response): Promise<void> => {
        try {
            const authHeader = req.headers.authorization as string;
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = parseInt(req.query.offset as string) || 0;

            const response: NotificationResponse[] = await getMyNotifications(authHeader, limit, offset);
            ResponseHandler.ok(req, res, response);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    // Get unread count
    notificationAPI.get('/unread-count', async (req: Request, res: Response): Promise<void> => {
        try {
            const authHeader = req.headers.authorization as string;
            const count = await getUnreadCount(authHeader);
            ResponseHandler.ok(req, res, { unreadCount: count });
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    // Get single notification
    notificationAPI.get('/:notificationId', checkNotificationExists, async (req: Request, res: Response): Promise<void> => {
        try {
            const notificationId = req.params.notificationId as string;
            const authHeader = req.headers.authorization as string;
            const response: NotificationResponse | null = await getNotificationById(notificationId, authHeader);
            ResponseHandler.ok(req, res, response);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    // Mark single notification as read
    notificationAPI.put('/:notificationId/read', checkNotificationExists, async (req: Request, res: Response): Promise<void> => {
        try {
            const notificationId = req.params.notificationId as string;
            const authHeader = req.headers.authorization as string;
            const response = await markAsRead(notificationId, authHeader);
            ResponseHandler.updated(req, res, response);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    // Mark all notifications as read
    notificationAPI.put('/read-all', async (req: Request, res: Response): Promise<void> => {
        try {
            const authHeader = req.headers.authorization as string;
            await markAllAsRead(authHeader);
            ResponseHandler.updated(req, res, "All notifications marked as read");
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    // Delete notification
    notificationAPI.delete('/:notificationId', checkNotificationExists, async (req: Request, res: Response): Promise<void> => {
        try {
            const notificationId = req.params.notificationId as string;
            const authHeader = req.headers.authorization as string;
            await deleteNotification(notificationId, authHeader);
            ResponseHandler.updated(req, res, "Notification deleted successfully");
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    return notificationAPI;
};
