import { PrismaClient, staticContent } from '@prisma/client';
import { binaryToUuid, uuidToBinary, RecordStatus } from '../utils';

const prisma = new PrismaClient();

export type ContentType = 'ABOUT_US' | 'CONTACT_US';

export interface StaticContentCreateInput {
    content_type: ContentType;
    title: string;
    content: string;
    created_by?: Uint8Array<ArrayBuffer>;
}

export interface StaticContentUpdateInput {
    title?: string;
    content?: string;
    updated_by?: Uint8Array<ArrayBuffer>;
}

export const createOrUpdateStaticContentRepo = async (
    data: StaticContentCreateInput
): Promise<staticContent> => {
    try {
        const existing = await prisma.staticContent.findFirst({
            where: { content_type: data.content_type }
        });

        if (existing) {
            // Update existing
            return await prisma.staticContent.update({
                where: { id: existing.id },
                data: {
                    title: data.title,
                    content: data.content,
                    updated_by: data.created_by,
                    record_status: true
                }
            });
        } else {
            // Create new
            return await prisma.staticContent.create({
                data: {
                    content_type: data.content_type,
                    title: data.title,
                    content: data.content,
                    created_by: data.created_by
                }
            });
        }
    } catch (error) {
        console.error('Error creating/updating static content:', error);
        throw new Error('Database error');
    }
};

export const updateStaticContentRepo = async (
    contentType: ContentType,
    data: StaticContentUpdateInput
): Promise<staticContent | null> => {
    try {
        const existing = await prisma.staticContent.findFirst({
            where: { content_type: contentType }
        });

        if (!existing) {
            return null;
        }

        return await prisma.staticContent.update({
            where: { id: existing.id },
            data: {
                title: data.title,
                content: data.content,
                updated_by: data.updated_by
            }
        });
    } catch (error) {
        console.error('Error updating static content:', error);
        throw new Error('Database error');
    }
};

export const getStaticContentByTypeRepo = async (
    contentType: ContentType
): Promise<staticContent | null> => {
    try {
        return await prisma.staticContent.findFirst({
            where: {
                content_type: contentType,
                record_status: RecordStatus.ACTIVE
            }
        });
    } catch (error) {
        console.error('Error getting static content:', error);
        throw new Error('Database error');
    }
};

export const getAllStaticContentRepo = async (): Promise<staticContent[]> => {
    try {
        return await prisma.staticContent.findMany({
            where: { record_status: RecordStatus.ACTIVE },
            orderBy: { content_type: 'asc' }
        });
    } catch (error) {
        console.error('Error getting all static content:', error);
        throw new Error('Database error');
    }
};

export const deleteStaticContentRepo = async (contentType: ContentType): Promise<void> => {
    try {
        await prisma.staticContent.updateMany({
            where: { content_type: contentType },
            data: { record_status: false }
        });
    } catch (error) {
        console.error('Error deleting static content:', error);
        throw new Error('Database error');
    }
};
