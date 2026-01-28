import { notification, Prisma, PrismaClient } from "@prisma/client";
import { uuidToBinary } from "../utils";

export interface NotificationData {
    id: Uint8Array<ArrayBuffer>;
    user_id: Uint8Array<ArrayBuffer>;
    title: string;
    message: string;
    type: string;
    reference_id: Uint8Array<ArrayBuffer> | null;
    is_read: boolean;
    created_at: Date;
}

export const createNotificationRepo = async (
    data: Prisma.notificationUncheckedCreateInput,
    prisma: PrismaClient
): Promise<notification> => {
    return await prisma.notification.create({ data });
};

export const createManyNotificationsRepo = async (
    data: Prisma.notificationUncheckedCreateInput[],
    prisma: PrismaClient
): Promise<void> => {
    await prisma.notification.createMany({ data });
};

export const getNotificationsByUserRepo = async (
    userId: string,
    limit: number,
    offset: number,
    prisma: PrismaClient
): Promise<notification[]> => {
    return await prisma.notification.findMany({
        where: { user_id: uuidToBinary(userId) },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset
    });
};

export const getUnreadCountRepo = async (
    userId: string,
    prisma: PrismaClient
): Promise<number> => {
    return await prisma.notification.count({
        where: {
            user_id: uuidToBinary(userId),
            is_read: false
        }
    });
};

export const markAsReadRepo = async (
    notificationId: string,
    userId: string,
    prisma: PrismaClient
): Promise<notification | null> => {
    return await prisma.notification.update({
        where: {
            id: uuidToBinary(notificationId),
            user_id: uuidToBinary(userId)
        },
        data: { is_read: true }
    });
};

export const markAllAsReadRepo = async (
    userId: string,
    prisma: PrismaClient
): Promise<void> => {
    await prisma.notification.updateMany({
        where: {
            user_id: uuidToBinary(userId),
            is_read: false
        },
        data: { is_read: true }
    });
};

export const deleteNotificationRepo = async (
    notificationId: string,
    userId: string,
    prisma: PrismaClient
): Promise<void> => {
    await prisma.notification.delete({
        where: {
            id: uuidToBinary(notificationId),
            user_id: uuidToBinary(userId)
        }
    });
};

export const doesNotificationExistRepo = async (
    notificationId: string,
    userId: string,
    prisma: PrismaClient
): Promise<boolean> => {
    const notification = await prisma.notification.findFirst({
        where: {
            id: uuidToBinary(notificationId),
            user_id: uuidToBinary(userId)
        }
    });
    return !!notification;
};

export const getNotificationByIdRepo = async (
    notificationId: string,
    userId: string,
    prisma: PrismaClient
): Promise<notification | null> => {
    return await prisma.notification.findFirst({
        where: {
            id: uuidToBinary(notificationId),
            user_id: uuidToBinary(userId)
        }
    });
};
