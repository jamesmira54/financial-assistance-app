import { Prisma } from "@prisma/client";
import { checkIfInvalidFileTypeIdRepo, doesFileExistRepo, fileDeleteRepo, fileUploadRepo, findFileTypeIdRepo, getAllFileOfStudentRepo, getAllFileTypeRepo, getBulkFileOfStudentsRepo, imageUploadRepo } from "./repository"
import { binaryToUuid, uuidToBinary } from "../utils";
import { FileTypeResponse } from '../utils/types';
import { toFileTypeResponse } from "../utils/converter";

export const fileUpload= async ( studentId: string, uploadedFileName: string, mimetype: string,fileTypeId: string, path: string, userUUID: string ) => { 
    const data: Prisma.fileUncheckedCreateInput = {
        file_name: uploadedFileName,
        path,
        mime_type: mimetype,
        file_type_id: uuidToBinary(fileTypeId),
        student_id: uuidToBinary(studentId),
        created_by: uuidToBinary(userUUID),
        updated_by: uuidToBinary(userUUID),
        updated_at: new Date()
    }
    return await fileUploadRepo( data);
}

export const imageUpload= async ( userId: string, uploadedImageName: string) => { 
    return await imageUploadRepo( uploadedImageName, userId);
}

export const findFileTypeId = async (fileTypeId: string): Promise<boolean>  => {
    return await findFileTypeIdRepo(fileTypeId)
}

export const checkIfInvalidFileTypeId = async ( fileTypeIds: string[]): Promise<boolean> => {
    const convertedId = fileTypeIds.map( item => uuidToBinary(item));
    return await checkIfInvalidFileTypeIdRepo( convertedId );
}

export const getAllFileType = async ():Promise<any> => {
    const data = await getAllFileTypeRepo();
    const converted =  data.map( item => toFileTypeResponse(item))
    return { count: converted.length, fileTypes: converted }
}

export const getAllFileOfStudent = async (studentId: string): Promise<any[]> => {
    return await getAllFileOfStudentRepo( studentId );
}

export const getBulkFileOfStudents = async (studentIds: string[]): Promise<any[]> => {
    const convertedIds = studentIds.map( item => uuidToBinary( item ));
    return await getBulkFileOfStudentsRepo( convertedIds );
}

export const fileDelete = async ( fileId: string ) => {
    await fileDeleteRepo( fileId );
}

export const doesFileExist = async (fileId: string): Promise<boolean> => { 
    return doesFileExistRepo(fileId);
};