import { announcement, Prisma, PrismaClient } from "@prisma/client";
import { AnnouncementData, AnnouncementDataMinimal, QueryParams, RecordStatus, uuidToBinary } from "../utils";

export const createAnnouncementRepo = async (data: Prisma.announcementUncheckedCreateInput, prisma: PrismaClient ): Promise<announcement> => {
    return await prisma.announcement.create({ data });
}

export const createAnnouncementLocationRepo = async (data: Prisma.announcementLocationUncheckedCreateInput[], prisma: PrismaClient ): Promise<void> => {
    await prisma.announcementLocation.createMany({ data });
}

export const createAnnouncementFileRepo = async ( data: Prisma.announcementFileUncheckedCreateInput[], prisma: PrismaClient): Promise<void> => {
    await prisma.announcementFile.createMany({ data });
}

export const updateAnnouncementRepo = async (data: Prisma.announcementUncheckedCreateInput, prisma: PrismaClient, announcementId: string ): Promise<announcement> => {
    return await prisma.announcement.update({ data, where: {id: uuidToBinary(announcementId)} });
}

export const updateAnnouncementLocations = async (data: Prisma.announcementLocationUncheckedCreateInput[], announcementId: string, prisma: PrismaClient) => {
    await Promise.all(
        data.map(async (e: Prisma.announcementLocationUncheckedCreateInput) => {
            await prisma.announcementLocation.upsert({
                where: { announcement_id_citymun_id: { announcement_id: uuidToBinary(announcementId), citymun_id: e.citymun_id } },
                update: {},
                create: e,
            });
        })
    );
};

export const updateAnnouncementFiles = async (files: Prisma.announcementFileUncheckedCreateInput[], announcementId: string, prisma: PrismaClient) => {
    await Promise.all(
        files.map(async (file: Prisma.announcementFileUncheckedCreateInput) => {
            await prisma.announcementFile.upsert({
                where: { announcement_id_file_name: { announcement_id: uuidToBinary(announcementId), file_name: file.file_name } },
                update: {},
                create: file,
            });
        })
    );
};

export const getOneAnnouncementData = async ( id: string, prisma: PrismaClient ): Promise<AnnouncementData> => {
    return await prisma.announcement.findUnique({
        where: {
            record_status: RecordStatus.ACTIVE,
            id: uuidToBinary( id ),
        },
        select: {
            id: true,
            title: true,
            content: true,
            caption: true,
            sponsorship_id: true,
            locations: {
                select: {
                    citymun: {
                        select: {
                            id: true,
                            citymun_desc: true
                        }
                    }
                }
            },
            files: {
                select: {
                    id: true,
                    file_name: true,
                    path: true
                }
            }
        }
    })
}

export const getAllAnnouncementData = async ( params: QueryParams, prisma: PrismaClient, userId: string ): Promise<AnnouncementDataMinimal[]> => {

    let orderBy: any = {};
    let whereCondition: any = { record_status: RecordStatus.ACTIVE }
    if (params.sort) {
        orderBy['created_at'] = params.sort === 'desc' ? 'desc' : 'asc';
    }

    if (params.search && params.search !== "") {
        whereCondition.OR = [
            { title: { contains: params.search } },
            { caption: { contains: params.search } },
            {  content: { contains: params.search } }
        ];
    }

    if( params.mine ) {
        whereCondition.created_by = uuidToBinary(userId)
    }

    if( params.cityMunId && params.cityMunId !== null) {
        whereCondition.locations = {
            some: {
                citymun_id: params.cityMunId
            }
        };
    }

    return await prisma.announcement.findMany({
        where: whereCondition,
        skip: params.offset,
        take: params.limit,
        orderBy,
        select: {
            id: true,
            title: true,
            content: true,
            caption: true,
            sponsorship_id: true,
        }
    })
}

export const getAllPublicAnnouncementData = async ( params: QueryParams, prisma: PrismaClient ): Promise<{ data: any[]; total: number }> => {

    let orderBy: any = {};
    const whereCondition: any = { record_status: RecordStatus.ACTIVE };

    if (params.sort) {
        orderBy['created_at'] = params.sort === 'desc' ? 'desc' : 'asc';
    }

    if (params.search && params.search !== "") {
        whereCondition.OR = [
            { title: { contains: params.search } },
            { caption: { contains: params.search } },
            { content: { contains: params.search } }
        ];
    }

    if (params.cityMunId && params.cityMunId !== null) {
        whereCondition.locations = {
            some: { citymun_id: params.cityMunId }
        };
    }

    const [data, total] = await Promise.all([
        prisma.announcement.findMany({
            where: whereCondition,
            skip: params.offset,
            take: params.limit,
            orderBy,
            select: {
                id: true,
                title: true,
                content: true,
                caption: true,
                sponsorship_id: true,
                locations: {
                    select: {
                        citymun: {
                            select: { id: true, citymun_desc: true }
                        }
                    }
                },
                files: {
                    select: { id: true, file_name: true, path: true }
                }
            }
        }),
        prisma.announcement.count({ where: whereCondition })
    ]);

    return { data, total };
}

export const getExistingLocations = async( announcementId: string, prisma: PrismaClient): Promise<{citymun_id: number}[]> => {
    return await prisma.announcementLocation.findMany({
        where: { announcement_id: uuidToBinary(announcementId) },
        select: { citymun_id: true }
    });
}

export const deleteLocationsNotUsed = async ( citiesId: number[], announcementId: string, prisma: PrismaClient): Promise<void> => {
    await prisma.announcementLocation.deleteMany({
        where: {
            announcement_id: uuidToBinary(announcementId),
            citymun_id: { in: citiesId }
        }
    });
}

export const deleteAllUnusedLocation = async ( announcementId: string, prisma: PrismaClient): Promise<void> => {
    await prisma.announcementLocation.deleteMany({
        where: {
            announcement_id: uuidToBinary(announcementId)
        }
    });
}

export const deleteFilesNotUsed = async ( fileNames: string[], announcementId: string, prisma: PrismaClient): Promise<void> => {
    await prisma.announcementFile.deleteMany({
        where: {
            announcement_id: uuidToBinary(announcementId),
            file_name: { in: fileNames }
        }
    });
}

export const deleteAllFilesNotUsed = async ( announcementId: string, prisma: PrismaClient): Promise<void> => {
    await prisma.announcementFile.deleteMany({
        where: {
            announcement_id: uuidToBinary(announcementId)
        }
    });
}

export const getExistingFiles = async( announcementId: string, prisma: PrismaClient): Promise<{file_name: string}[]> => {
    return await prisma.announcementFile.findMany({
        where: { announcement_id: uuidToBinary(announcementId) },
        select: { file_name: true }
    });
}

export const doesAnnExistRepo = async (
    annId: string,
    userId: string,
    isAdmin: boolean = false,
    prisma: PrismaClient
): Promise<boolean> => {
    const whereStatement: any = {id: uuidToBinary(annId), record_status: RecordStatus.ACTIVE }
    if(!isAdmin) {
        whereStatement.created_by =  uuidToBinary(userId);
    }
    const ann = await prisma.announcement.findUnique({
        where: whereStatement,
    });
    return !!ann;
};

export const doesAnnExistGetRepo = async (
    annId: string,
    prisma: PrismaClient
): Promise<boolean> => {
    const whereStatement: any = {id: uuidToBinary(annId), record_status: RecordStatus.ACTIVE }
    const ann = await prisma.announcement.findUnique({
        where: whereStatement,
    });
    return !!ann;
};

export const deleteAnnouncementRepo = async ( announcementId: string, prisma: PrismaClient ): Promise<void> => {
    await prisma.announcement.update({ data: {record_status: false}, where: {id: uuidToBinary(announcementId)}})
}