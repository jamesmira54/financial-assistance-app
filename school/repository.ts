import { Prisma, PrismaClient } from "@prisma/client";
import { RecordStatus, uuidToBinary } from "../utils";

const prisma = new PrismaClient({
   log: ["query"],
});

 export const getSchoolsRepo = async (): Promise<any> => {
   try {
      return await prisma.school.findMany({
         where: { record_status: RecordStatus.ACTIVE },
         include: {
            province: {
               select: { prov_desc: true }  
            },
            citymun: {
               select: { citymun_desc: true }  
            },
            brgy: {
               select: { brgy_desc: true }  
            }
         }
      });
   } catch (error) {
      console.error('Error getSchoolsRepo:', error);
      throw new Error('Database error');
   }
};


export const checkSchoolExistRepo = async ( id: string ): Promise<boolean> => {
   try {

      console.log("School ID", id);
      const whereCondition: any = { record_status: RecordStatus.ACTIVE };
      if (id !== null) whereCondition.id = uuidToBinary(id);

      const school = await prisma.school.findFirst({
         where: whereCondition,
      });
      
      console.log("School Data", school);
      return school === null; 
   } catch (error) {
      console.error('Error checkSchoolExistRepo:', error);
      throw new Error('Database error');
   }
}

export const checkSchoolNameExistRepo = async (name: string, schoolId: any): Promise<boolean> => {
   try {
      console.log("School Name:", name, "School ID:", schoolId);

      const whereCondition: any = {
         school_name: name, record_status: RecordStatus.ACTIVE
      };

      if (schoolId) {
         whereCondition.id = { not: uuidToBinary(schoolId) };
      }

    
      const school = await prisma.school.findFirst({
         where: whereCondition,
      });

      console.log("School Data:", school);
      return school === null; // Returns true if no matching school exists
   } catch (error) {
      console.error('Error in checkSchoolNameExistRepo:', error);
      throw new Error('Database error');
   }
};



export const getOneSchoolRepo = async ( id: string ): Promise<any> => {
   try {

      console.log("School ID", id);
      const whereCondition: any = { record_status: RecordStatus.ACTIVE };
      if (id !== null) whereCondition.id = uuidToBinary(id);

      const school = await prisma.school.findFirst({
         where: whereCondition,
         include: {
            province: {
               select: { prov_desc: true }  
            },
            citymun: {
               select: { citymun_desc: true }  
            },
            brgy: {
               select: { brgy_desc: true }  
            }
         }
      });
      
      console.log("School Data", school);
      return school; 
   } catch (error) {
      console.error('Error getRegionsRepo:', error);
      throw new Error('Database error');
   }
}

export const createSchoolRepo = async ( school: Prisma.schoolUncheckedCreateInput): Promise<any> => {
   try {
      const newSchool = await prisma.school.create({
         data: school,
      });
   
      return newSchool;
   } catch (error) {
      console.error('Error createSchoolRepo:', error);
      throw new Error('Database error');
   }
}

export const updateSchoolRepo = async ( updatedData: Prisma.schoolUncheckedUpdateInput, schoolId: string): Promise<any> => {
   try {
      const updatedSchool = await prisma.school.update({
         where: { id: uuidToBinary(schoolId) },
         data: updatedData,
      });

      return updatedSchool;
   } catch (error) {
      console.error('Error updateSchoolRepo:', error);
      throw new Error('Database error');
   }
};


export const deleteSchoolRepo = async ( schoolId: string): Promise<void> => {
   try {
      const updatedSchool = await prisma.school.update({
         where: { id: uuidToBinary(schoolId) },
         data: { record_status: false },
      });

   } catch (error) {
      console.error('Error updateSchoolRepo:', error);
      throw new Error('Database error');
   }
};

export const checkIfInvalidSchoolIdRepo = async ( schoolIds: Uint8Array<ArrayBuffer>[]) => {
   const validSchoolsCount = await prisma.school.count({
      where: {
         id: { in: schoolIds },
         record_status: RecordStatus.ACTIVE
      },
   });
   return validSchoolsCount !== schoolIds.length;
}