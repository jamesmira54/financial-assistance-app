import { Prisma, PrismaClient, schedule, schedule_type, examination_type } from "@prisma/client";
import { QueryParams, RecordStatus, ScheduleModified, uuidToBinary } from "../utils";

export const save = async ( data: Prisma.scheduleUncheckedCreateInput ,prisma: PrismaClient ): Promise<schedule> => {
    return await prisma.schedule.create({ data });
}

export const update = async ( data: Prisma.scheduleUncheckedCreateInput, id: string ,prisma: PrismaClient ): Promise<schedule> => {
    return await prisma.schedule.update({ data, where: { id: uuidToBinary(id)} });
}

export const destroy = async ( id: string ,prisma: PrismaClient ): Promise<schedule> => {
    return await prisma.schedule.update({ data: {record_status: RecordStatus.DELETED}, where: { id: uuidToBinary(id)} });
}

export const get = async ( id: string ,prisma: PrismaClient ): Promise<ScheduleModified> => {
    return await prisma.schedule.findUnique(
        { 
            select: {
                id: true,
                sponsorship_id: true,
                batch_no: true,
                batch_code: true,
                schedule_type: true,
                examination_type: true,
                proctor_interviewer: true,
                location: true,
                start_date: true,
                end_date: true,
                schedule_quota: true,
                sponsorship: {
                    select: {
                        name: true
                    }
                }
            }, 
            where: { id: uuidToBinary(id), record_status: RecordStatus.ACTIVE} 
        }
    );
}

export const all = async ( params: QueryParams, creatorId: string = "" ,prisma: PrismaClient ): Promise<ScheduleModified[]> => {
    
    let orderBy: any = {};
    let whereCondition: any = { record_status: RecordStatus.ACTIVE }
    if (params.sort) {
        orderBy['created_at'] = params.sort === 'desc' ? 'desc' : 'asc';
    }

    if (params.search && params.search !== "") {
        const search = params.search;
        // `contains` is a string-only operator. Only apply it to string columns; use typed
        // equality for numeric/enum columns, and only when the search term is that type.
        const or: any[] = [
            { location: { contains: search } },
            { batch_code: { contains: search } },
            { proctor_interviewer: { contains: search } },
        ];

        const asNumber = Number(search);
        if (!Number.isNaN(asNumber)) {
            or.push({ batch_no: { equals: asNumber } });
            or.push({ schedule_quota: { equals: asNumber } });
        }

        const upper = search.toUpperCase();
        if (upper === 'TEST' || upper === 'INTERVIEW') {
            or.push({ schedule_type: { equals: upper as schedule_type } });
        }
        if (upper === 'ONSITE' || upper === 'ONLINE') {
            or.push({ examination_type: { equals: upper as examination_type } });
        }

        whereCondition.OR = or;
    }

    if(params.mine) {
        whereCondition.created_by = uuidToBinary(creatorId);
    }
    
    return await prisma.schedule.findMany(
        { 
            select: {
                id: true,
                sponsorship_id: true,
                batch_no: true,
                batch_code: true,
                schedule_type: true,
                examination_type: true,
                proctor_interviewer: true,
                location: true,
                start_date: true,
                end_date: true,
                schedule_quota: true,
                sponsorship: {
                    select: {
                        name: true
                    }
                }
            }, 
            where: whereCondition,
            skip: params.offset,
            take: params.limit,
            orderBy,
        }
    );
}

export const findIfExistsRepo = async ( id: string, prisma: PrismaClient ): Promise<boolean> => {
    const result = await prisma.schedule.findFirst({
        where: {
            id: uuidToBinary(id),
            record_status: RecordStatus.ACTIVE,
        },
    });

    return !!result;
}