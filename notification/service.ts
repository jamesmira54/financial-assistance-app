import { notification, Prisma, PrismaClient } from "@prisma/client";
import { binaryToUuid, extractUserFromToken, uuidToBinary } from "../utils";
import {
    createManyNotificationsRepo,
    createNotificationRepo,
    deleteNotificationRepo,
    doesNotificationExistRepo,
    getNotificationByIdRepo,
    getNotificationsByUserRepo,
    getUnreadCountRepo,
    markAllAsReadRepo,
    markAsReadRepo
} from "./repository";

const prisma = new PrismaClient({
    log: ["query", "info", "warn", "error"],
});

export type NotificationType = 'announcement' | 'application' | 'schedule' | 'system' | 'document';

export interface NotificationPayload {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    referenceId?: string;
}

export interface NotificationResponse {
    id: string;
    title: string;
    message: string;
    type: string;
    referenceId: string | null;
    isRead: boolean;
    createdAt: Date;
}

const toNotificationResponse = (notification: notification): NotificationResponse => {
    return {
        id: binaryToUuid(notification.id),
        title: notification.title,
        message: notification.message,
        type: notification.type,
        referenceId: notification.reference_id ? binaryToUuid(notification.reference_id) : null,
        isRead: notification.is_read,
        createdAt: notification.created_at
    };
};

// Create a single notification
export const createNotification = async (payload: NotificationPayload): Promise<NotificationResponse> => {
    const data: Prisma.notificationUncheckedCreateInput = {
        user_id: uuidToBinary(payload.userId),
        title: payload.title,
        message: payload.message,
        type: payload.type,
        reference_id: payload.referenceId ? uuidToBinary(payload.referenceId) : null
    };

    const result = await createNotificationRepo(data, prisma);
    return toNotificationResponse(result);
};

// Create notifications for multiple users (bulk)
export const createNotificationsForUsers = async (
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType,
    referenceId?: string
): Promise<void> => {
    const data: Prisma.notificationUncheckedCreateInput[] = userIds.map(userId => ({
        user_id: uuidToBinary(userId),
        title,
        message,
        type,
        reference_id: referenceId ? uuidToBinary(referenceId) : null
    }));

    await createManyNotificationsRepo(data, prisma);
};

// Get notifications for current user
export const getMyNotifications = async (
    authHeader: string,
    limit: number = 20,
    offset: number = 0
): Promise<NotificationResponse[]> => {
    const userDetails = extractUserFromToken(authHeader);
    const userId = userDetails.userId;

    const notifications = await getNotificationsByUserRepo(userId, limit, offset, prisma);
    return notifications.map(toNotificationResponse);
};

// Get unread count for current user
export const getUnreadCount = async (authHeader: string): Promise<number> => {
    const userDetails = extractUserFromToken(authHeader);
    const userId = userDetails.userId;

    return await getUnreadCountRepo(userId, prisma);
};

// Mark single notification as read
export const markAsRead = async (
    notificationId: string,
    authHeader: string
): Promise<NotificationResponse | null> => {
    const userDetails = extractUserFromToken(authHeader);
    const userId = userDetails.userId;

    const result = await markAsReadRepo(notificationId, userId, prisma);
    if (!result) return null;
    return toNotificationResponse(result);
};

// Mark all notifications as read
export const markAllAsRead = async (authHeader: string): Promise<void> => {
    const userDetails = extractUserFromToken(authHeader);
    const userId = userDetails.userId;

    await markAllAsReadRepo(userId, prisma);
};

// Delete notification
export const deleteNotification = async (
    notificationId: string,
    authHeader: string
): Promise<void> => {
    const userDetails = extractUserFromToken(authHeader);
    const userId = userDetails.userId;

    await deleteNotificationRepo(notificationId, userId, prisma);
};

// Check if notification exists and belongs to user
export const doesNotificationExist = async (
    notificationId: string,
    authHeader: string
): Promise<boolean> => {
    const userDetails = extractUserFromToken(authHeader);
    const userId = userDetails.userId;

    return await doesNotificationExistRepo(notificationId, userId, prisma);
};

// Get single notification
export const getNotificationById = async (
    notificationId: string,
    authHeader: string
): Promise<NotificationResponse | null> => {
    const userDetails = extractUserFromToken(authHeader);
    const userId = userDetails.userId;

    const notification = await getNotificationByIdRepo(notificationId, userId, prisma);
    if (!notification) return null;
    return toNotificationResponse(notification);
};
