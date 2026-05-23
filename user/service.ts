import { user } from "@prisma/client";
import { binaryToUuid, UpdateUserRequest, UserDetailsResponse, UserParameter, UserResponse, uuidToBinary } from "../utils";
import { toUserResponse } from "../utils/converter";
import { checkIfNotSponsorRepo, deleteUserRepo, doesUserExistRepo, getAllUsersRepo, getOneUserRepo, isAdminRepo, updateUserRepo } from "./repository"
import { checkIfStudentRepo, deleteStudentRepo, getOneStudentUsingUserIdRepo, partialUpdateStudentRepo, updateStudentRepo } from "../student/repository";
import { getOneStudentUsingUserId } from "../student/service";

export const isAdmin = async (userId: string) : Promise<boolean> => { 
    return isAdminRepo(userId);
}

export const getPermission = async (userId: string) : Promise<boolean> => { 
    // return await getPermissionRepo(userId);
    return true
}


export const getAllUsers = async ( params: UserParameter ) => { 

    const data: any = await getAllUsersRepo( params );
    const converted = data.map( user => toUserResponse(user));
    return { count: converted.length, users: converted};
}

export const doesUserExist = async ( userId: string ) : Promise<boolean> => {
    return await doesUserExistRepo( userId);
}


export const getOneUser = async ( userId: string, baseUrl?: string ) : Promise<UserResponse> => {
    const data: user = await getOneUserRepo( userId);
    return toUserResponse( data, baseUrl );
}

export const updateUserService = async ( data: UpdateUserRequest, userId: string ) : Promise<any> => {
    
    // get user details
    const user: user = await getOneUserRepo( userId);

    user.email = data.email;
    user.first_name = data.firstName;
    user.last_name = data.lastName;
    user.middle_name = data.middleName;
    user.mobile_number = data.mobileNumber;
    user.username = data.username;
    user.role_id = uuidToBinary( data.roleId);

    await updateUserRepo( user, userId);

    // check if student
    const checkStudent = await checkIfStudentRepo(userId);
    console.log("Check if user is student", checkStudent);

    if(checkStudent) {
        const student = await getOneStudentUsingUserId(userId);

        if(student) {
            student.first_name = data.firstName;
            student.last_name = data.lastName;
            student.middle_name = data.middleName;
            student.mobile_number = data.mobileNumber;
            student.email = data.email;
            
            await partialUpdateStudentRepo(student, student.id);
        }
    }

    return toUserResponse(user);
}

export const deleteUserService = async ( userId: string) => {

    const student = await checkIfStudentRepo(userId);
    await deleteUserRepo(userId);
    if(student) {
        const studentDetails: any = await getOneStudentUsingUserId(userId);
        console.log("deleting student", studentDetails);

        // another if to ensure that it is a student not a admin
        if( studentDetails ) {
            const studentId = binaryToUuid(studentDetails.id);
            await deleteStudentRepo( studentId );
        }
    }
}

export const checkIfNotSponsor = async ( userId: string): Promise<boolean> => {
    return await checkIfNotSponsorRepo( userId );
}