import { PrismaClient } from "@prisma/client";
import { uuidToBinary } from "../utils";

// Raw Prisma access for the grantee monitoring list. The `where` clause is
// assembled in the service so this stays a thin data-access layer.
export const getGranteesRepo = async (
  prisma: PrismaClient,
  where: any,
  offset: number,
  limit: number,
) => {
  const [data, totalCount] = await Promise.all([
    prisma.sponsorshipApplication.findMany({
      where,
      include: {
        student: { include: { college_school: true } },
        sponsorship: { include: { academicYear: true } },
      },
      orderBy: { created_at: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.sponsorshipApplication.count({ where }),
  ]);

  return { data, totalCount };
};

export const findGranteeAppRepo = (prisma: PrismaClient, applicationId: string) =>
  prisma.sponsorshipApplication.findFirst({
    where: { id: uuidToBinary(applicationId), record_status: true },
  });

export const updateGranteeStatusRepo = (
  prisma: PrismaClient,
  applicationId: string,
  status: string,
  remarks: string | undefined,
  userId: string,
) =>
  prisma.sponsorshipApplication.update({
    where: { id: uuidToBinary(applicationId) },
    data: {
      application_status: status as any,
      remarks: remarks ?? undefined,
      updated_by: uuidToBinary(userId),
    },
  });
