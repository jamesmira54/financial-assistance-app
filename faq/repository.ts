import { PrismaClient, faq, Prisma } from '@prisma/client';
import { binaryToUuid, uuidToBinary, RecordStatus } from '../utils';

const prisma = new PrismaClient();

export interface FaqCreateInput {
    question: string;
    answer: string;
    category?: string;
    sort_order?: number;
    created_by?: Uint8Array<ArrayBuffer>;
}

export interface FaqUpdateInput {
    question?: string;
    answer?: string;
    category?: string;
    sort_order?: number;
    updated_by?: Uint8Array<ArrayBuffer>;
}

export const createFaqRepo = async (data: FaqCreateInput): Promise<faq> => {
    try {
        const faq = await prisma.faq.create({
            data: {
                question: data.question,
                answer: data.answer,
                category: data.category,
                sort_order: data.sort_order || 0,
                created_by: data.created_by
            }
        });
        return faq;
    } catch (error) {
        console.error('Error creating FAQ:', error);
        throw new Error('Database error');
    }
};

export const updateFaqRepo = async (faqId: string, data: FaqUpdateInput): Promise<faq> => {
    try {
        const faq = await prisma.faq.update({
            where: { id: uuidToBinary(faqId) },
            data: {
                question: data.question,
                answer: data.answer,
                category: data.category,
                sort_order: data.sort_order,
                updated_by: data.updated_by
            }
        });
        return faq;
    } catch (error) {
        console.error('Error updating FAQ:', error);
        throw new Error('Database error');
    }
};

export const deleteFaqRepo = async (faqId: string): Promise<void> => {
    try {
        await prisma.faq.update({
            where: { id: uuidToBinary(faqId) },
            data: { record_status: false }
        });
    } catch (error) {
        console.error('Error deleting FAQ:', error);
        throw new Error('Database error');
    }
};

export const getOneFaqRepo = async (faqId: string): Promise<faq | null> => {
    try {
        const faq = await prisma.faq.findFirst({
            where: {
                id: uuidToBinary(faqId),
                record_status: RecordStatus.ACTIVE
            }
        });
        return faq;
    } catch (error) {
        console.error('Error getting FAQ:', error);
        throw new Error('Database error');
    }
};

export const getAllFaqsRepo = async (
    limit?: number,
    offset?: number,
    category?: string
): Promise<{ faqs: faq[]; total: number }> => {
    try {
        const whereCondition: any = {
            record_status: RecordStatus.ACTIVE
        };

        if (category) {
            whereCondition.category = category;
        }

        const [faqs, total] = await Promise.all([
            prisma.faq.findMany({
                where: whereCondition,
                orderBy: [
                    { sort_order: 'asc' },
                    { created_at: 'desc' }
                ],
                take: limit,
                skip: offset
            }),
            prisma.faq.count({ where: whereCondition })
        ]);

        return { faqs, total };
    } catch (error) {
        console.error('Error getting FAQs:', error);
        throw new Error('Database error');
    }
};

export const getFaqCategoriesRepo = async (): Promise<string[]> => {
    try {
        const categories = await prisma.faq.findMany({
            where: {
                record_status: RecordStatus.ACTIVE,
                category: { not: null }
            },
            select: { category: true },
            distinct: ['category']
        });
        return categories.map(c => c.category).filter(Boolean) as string[];
    } catch (error) {
        console.error('Error getting FAQ categories:', error);
        throw new Error('Database error');
    }
};

export const faqExistsRepo = async (faqId: string): Promise<boolean> => {
    try {
        const faq = await prisma.faq.findFirst({
            where: {
                id: uuidToBinary(faqId),
                record_status: RecordStatus.ACTIVE
            }
        });
        return faq !== null;
    } catch (error) {
        console.error('Error checking FAQ existence:', error);
        throw new Error('Database error');
    }
};
