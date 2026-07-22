import { binaryToUuid, QueryParams, RecordStatus, uuidToBinary } from "../utils";
import { Prisma, PrismaClient, student, user } from "@prisma/client";

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});


export const registerStudentRepo = async (
  student: Prisma.studentUncheckedCreateInput
): Promise<student> => {
  try {
    const newStudent = await prisma.student.create({
      data: student,
    });

    return newStudent;
  } catch (error) {
    console.error("Error registration: ", error);
    throw new Error("Database error: " + error.message);
  }
};

export const updateStudentRepo = async (
  studentData: Prisma.studentUncheckedUpdateInput,
  studentId: Uint8Array<ArrayBuffer>
): Promise<student> => {
  try {
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: studentData,
    });

    return updatedStudent;
  } catch (error) {
    console.error("Error updating student: ", error);
    throw new Error("Database error: " + error.message);
  }
};

export const partialUpdateStudentRepo = async (
  studentData: Prisma.studentUncheckedUpdateInput,
  studentId: Uint8Array<ArrayBuffer>
): Promise<student> => {
  try {
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        id: studentId,
        user_id: studentData.user_id,
        first_name: studentData.first_name,
        last_name: studentData.last_name,
        middle_name: studentData.middle_name,
        mobile_number: studentData.mobile_number,
        email: studentData.email,
      },
    });

    return updatedStudent;
  } catch (error) {
    console.error("Error updating student: ", error);
    throw new Error("Database error: " + error.message);
  }
};

export const registerSiblingsRepo = async (
  siblings: Prisma.siblingUncheckedCreateInput[]
): Promise<void> => {
  try {
    await prisma.sibling.createMany({
      data: siblings,
    });
  } catch (error) {
    console.error("Error registration: ", error);
    throw new Error("Database error: " + error.message);
  }
};

export const updateSiblingsRepo = async (
  studentId: string,
  siblings: Prisma.siblingUncheckedCreateInput[]
): Promise<void> => {
  try {
    await prisma.$transaction([
      // Delete all existing siblings linked to the student
      prisma.sibling.deleteMany({
        where: { student_id: uuidToBinary(studentId) },
      }),

      prisma.sibling.createMany({
        data: siblings,
      }),
    ]);

    console.log("Sibling data updated successfully.");
  } catch (error) {
    console.error("Error updating siblings: ", error);
    throw new Error("Database error: " + error.message);
  }
};

export const checkStudentEmailExists = async (
  email: string
): Promise<boolean> => {
  try {
    const user = await prisma.student.findFirst({
      where: {
        email: email,
        record_status: RecordStatus.ACTIVE,
      },
    });

    return user !== null;
  } catch (error) {
    console.error("Error checking email existence:", error);
    throw new Error("Database error");
  }
};

export const getAllStudentRepo = async ( params: QueryParams ): Promise<any> => {
  try {

    let orderBy: any = {};
    let whereCondition: any = { record_status: RecordStatus.ACTIVE }
    if (params.sort) {
      orderBy['created_at'] = params.sort === 'desc' ? 'desc' : 'asc';
    }

    if (params.search && params.search != "") {
      whereCondition.first_name = {
        contains: params.search
      };
    }

    const users = await prisma.student.findMany({
      where: whereCondition,
      skip: params.offset,
      take: params.limit,
      orderBy,
      include: {
        siblings: true,
        permanent_barangay: { select: { brgy_desc: true, brgy_code: true } },
        permanent_citynum: {
          select: { citymun_desc: true, citymun_code: true },
        },
        permanent_province: { select: { prov_desc: true, prov_code: true } },
        permanent_region: { select: { reg_desc: true, reg_code: true } },
        current_barangay: { select: { brgy_desc: true, brgy_code: true } },
        current_citynum: { select: { citymun_desc: true, citymun_code: true } },
        current_province: { select: { prov_desc: true, prov_code: true } },
        current_region: { select: { reg_desc: true, reg_code: true } },
        college_school: { select: { school_name: true } },
      },
    });

    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new Error("Database error");
  }
};

export const getOneStudentUsingUserIdRepo = async (userId: string): Promise<any> => {
  try {
    const user = await prisma.student.findFirst({
      where: {
        record_status: RecordStatus.ACTIVE,
        user_id: uuidToBinary(userId),
      }
    });

    return user;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new Error("Database error");
  }
};

export const getStudentCollegeSchoolRepo = async ( studentId: string ): Promise<string> => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        record_status: RecordStatus.ACTIVE,
        id: uuidToBinary(studentId),
      },
      select: {
        college_school_id: true
      },
    });

    if (!student || !student.college_school_id) {
      console.warn(`Student dont have college school details: ${studentId}`);
      return null;
    }

    return binaryToUuid(student.college_school_id);
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new Error("Database error");
  }
}

export const getOneStudentRepo = async (studentId: string): Promise<any> => {
  try {
    const user = await prisma.student.findFirst({
      where: {
        record_status: RecordStatus.ACTIVE,
        id: uuidToBinary(studentId),
      },
      include: {
        siblings: true,
        permanent_barangay: { select: { brgy_desc: true, brgy_code: true } },
        permanent_citynum: {
          select: { citymun_desc: true, citymun_code: true },
        },
        permanent_province: { select: { prov_desc: true, prov_code: true } },
        permanent_region: { select: { reg_desc: true, reg_code: true } },
        current_barangay: { select: { brgy_desc: true, brgy_code: true } },
        current_citynum: { select: { citymun_desc: true, citymun_code: true } },
        current_province: { select: { prov_desc: true, prov_code: true } },
        current_region: { select: { reg_desc: true, reg_code: true } },
        college_school: { select: { school_name: true } },
      },
    });

    return user;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new Error("Database error");
  }
};

export const checkIfStudentRepo = async (userId: string): Promise<boolean> => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: uuidToBinary(userId),
        record_status: RecordStatus.ACTIVE,
      },
      select: {
        role: {
          select: {
            id: true,
            name: true,
            record_status: true,
          },
        },
      },
    });

    if (
      !user ||
      !user.role ||
      user.role.record_status !== RecordStatus.ACTIVE
    ) {
      return false;
    }

    console.log("user", userId, {
      id: binaryToUuid(user.role.id),
      role_name: user.role.name,
    });

    return (
      user.role.name.toLowerCase() === "student" ||
      user.role.name.toLowerCase() === "system admin"
    );
  } catch (error) {
    console.error("Error checking role existence:", error);
    throw new Error("Database error");
  }
};

export const isEmailTakenByAnotherStudentRepo = async (
  email: string,
  studentId: string
): Promise<boolean> => {
  try {
    const existingUser = await prisma.student.findFirst({
      where: {
        email,
        id: { not: uuidToBinary(studentId) },
      },
    });

    return !!existingUser;
  } catch (error) {
    console.error("Error checking email existence:", error);
    throw new Error("Database error");
  }
};

export const doesStudentExistRepo = async (
  studentId: string
): Promise<boolean> => {
  const student = await prisma.student.findUnique({
    where: { id: uuidToBinary(studentId) },
  });
  return !!student;
};

export const deleteStudentRepo = async ( studentId: string ) => {
  try {
    await prisma.student.update({
      where: { id: uuidToBinary(studentId) },
      data: {record_status: RecordStatus.DELETED},
    });
  } catch (error) {
    console.error('Error updating user:', error);
  }
}