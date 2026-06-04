import { announcement, Prisma, PrismaClient } from "@prisma/client";
import { AnnouncementData, AnnouncementDataMinimal, AnnouncementPayloadString, binaryToUuid, extractUserFromToken, FlattenedAnnouncementData, FlattenedAnnouncementDataMinimal, PaginatedPublicAnnouncementResponse, QueryParams } from "../utils";
import { toAnnouncementLocationModel, toAnnouncementMinimalResponse, toAnnouncementModel, toAnnouncementResponse, toUploadedFileModel } from "../utils/converter";
import { createAnnouncementFileRepo, createAnnouncementLocationRepo, createAnnouncementRepo, deleteAllFilesNotUsed, deleteAllUnusedLocation, deleteAnnouncementRepo, deleteFilesNotUsed, deleteLocationsNotUsed, doesAnnExistGetRepo, doesAnnExistRepo, getAllAnnouncementData, getAllPublicAnnouncementData, getExistingFiles, getExistingLocations, getOneAnnouncementData, updateAnnouncementFiles, updateAnnouncementLocations, updateAnnouncementRepo } from './repository';


const prisma = new PrismaClient({
    log: ["query", "info", "warn", "error"],
});

export const createAnnouncement = async (payload: AnnouncementPayloadString, files: any, authHeader: string): Promise<FlattenedAnnouncementData> => {

    const userDetails = extractUserFromToken(authHeader);
    const createdUserId = userDetails.userId;

    return await prisma.$transaction(async (prisma: PrismaClient) => { 
        // save announcement
        const data: Prisma.announcementUncheckedCreateInput = toAnnouncementModel( payload, createdUserId );
        const result: announcement = await createAnnouncementRepo( data, prisma );

        // save announcement location
        if(payload.targetMunicipalitys && payload.targetMunicipalitys.length > 0) {
            const locationPayload: Prisma.announcementLocationUncheckedCreateInput[] = payload.targetMunicipalitys.map( (e: number) => toAnnouncementLocationModel( e, binaryToUuid(result.id)));
            await createAnnouncementLocationRepo( locationPayload, prisma );
        }

        // save announcement file
        if(files && files.length > 0) {
            const filePayloads: Prisma.announcementFileUncheckedCreateInput[] = files.map( (file: Express.Multer.File) => toUploadedFileModel(file, binaryToUuid(result.id)));
            await createAnnouncementFileRepo( filePayloads, prisma );
        }
        
        const response: AnnouncementData = await getOneAnnouncementData( binaryToUuid(result.id), prisma );
        return toAnnouncementResponse( response );
    });
}


export const updateAnnouncement = async (payload: AnnouncementPayloadString, files: any, announcementId: string, authHeader: string): Promise<FlattenedAnnouncementData> => {

    const userDetails = extractUserFromToken(authHeader);
    const createdUserId = userDetails.userId;

    return await prisma.$transaction(async (prisma: PrismaClient) => { 
        // save announcement
        const data: Prisma.announcementUncheckedCreateInput = toAnnouncementModel( payload, createdUserId, true );
        const result: announcement = await updateAnnouncementRepo( data, prisma, announcementId );

        // save announcement location
        if(payload.targetMunicipalitys && payload.targetMunicipalitys.length > 0) {

            const existingLocations: {citymun_id: number}[] = await getExistingLocations(announcementId, prisma);
            const existingCitymunIds: number[] = existingLocations.map(loc => loc.citymun_id);
            const toDelete: number[] = existingCitymunIds.filter(id => !payload.targetMunicipalitys.includes(id));

            if(toDelete.length > 0) {
                await deleteLocationsNotUsed(toDelete, announcementId, prisma);
            }

            const locationPayload: Prisma.announcementLocationUncheckedCreateInput[] = payload.targetMunicipalitys.map( (e: number) => toAnnouncementLocationModel( e, announcementId));
            await updateAnnouncementLocations(locationPayload, announcementId, prisma);
        } else {
            await deleteAllUnusedLocation( announcementId, prisma );
        }

        // save announcement file
        if(files && files.length > 0) {

            const existingFiles: {file_name: string}[] = await getExistingFiles(announcementId, prisma);
            const existingFileName: string[] = existingFiles.map(file => file.file_name);
            const toDelete: string[] = existingFileName.filter(name => !files.includes(name));

            if(toDelete.length > 0) {
                await deleteFilesNotUsed(toDelete, announcementId, prisma);
            }

            const filePayloads: Prisma.announcementFileUncheckedCreateInput[] = files.map( (file: Express.Multer.File) => toUploadedFileModel(file, announcementId));
            await updateAnnouncementFiles(filePayloads, announcementId, prisma);
            
        } else {
            await deleteAllFilesNotUsed( announcementId, prisma);
        }
        
        const response: AnnouncementData = await getOneAnnouncementData( binaryToUuid(result.id), prisma );
        return toAnnouncementResponse( response );
    });
}

export const deleteAnnouncement = async ( announcementId: string): Promise<void> => {
    await deleteAnnouncementRepo( announcementId, prisma );
}

export const doesAnnExist = async ( annId: string, userId: string, isAdmin: boolean = false ): Promise<boolean> => {
    return await doesAnnExistRepo(annId, userId, isAdmin, prisma);
}

export const doesAnnExistGet = async ( annId: string ): Promise<boolean> => {
    return await doesAnnExistGetRepo(annId, prisma);
}

export const getOneAnnouncement = async( annId: string ): Promise<FlattenedAnnouncementData> => {
    const data: AnnouncementData = await getOneAnnouncementData( annId, prisma );
    return toAnnouncementResponse( data ); 
}

export const getAllPublicAnnouncement = async ( params: QueryParams ): Promise<PaginatedPublicAnnouncementResponse> => {
    const { data, total } = await getAllPublicAnnouncementData( params, prisma );
    return {
        data: data.map( (e: AnnouncementData) => toAnnouncementResponse( e )),
        total
    };
}

export const getAllAnnouncement = async ( params: QueryParams, authHeader: string ): Promise<FlattenedAnnouncementDataMinimal[]> => {
    
    const userDetails = extractUserFromToken(authHeader);
    const userId = userDetails.userId;

    const data: AnnouncementDataMinimal[] =  await getAllAnnouncementData( params, prisma, userId );
    return data.map( (e: AnnouncementDataMinimal) => toAnnouncementMinimalResponse( e ));
}