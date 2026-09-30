import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['query'] });

// Default Document Tracking System (DTS) Setup Manager values. Idempotent:
// `name` is unique per table, so re-running skips anything already present
// (including values an admin has since renamed away from, which stay as-is).

const PROCESS_TYPES = [
  'For Processing',
  'For Application',
  'For Renewal',
  'For Evaluation',
  'For Validation',
  'For Approval',
  'For Allowance Processing',
  'For Payment Processing',
  'Fund Processing',
  'For Claim Processing',
  'For Allowance Disbursement',
  'For Requirement Submission',
];

const PURPOSES = [
  'Scholarship/Assistance',
  'Educational Assistance',
  'Scholarship Validation',
  'Educational Assistance Validation',
  'Student Financial Assistance',
  'Disbursement of Allowance',
  'Scholarship/Assistance Voucher',
  'Scholarship/Assistance Billing',
  'Tuition Assistance',
  'School Supplies Assistance',
  'Transportation Assistance',
  'Other Educational Support',
];

const OFFICES = [
  'Office of the Congressman',
  'Scholarship Office',
  'Mayor’s Office',
  'Budget Office',
  'Accounting Office',
  'Treasury Office',
  'Cashier',
  'Disbursing Office',
];

// Role for accounts created only to receive/process documents at an office.
const DTS_ROLE = {
  name: 'DTS Officer',
  description: 'Receives and processes tracked documents for an assigned DTS office.',
};

const rows = (names: string[]) => names.map((name, i) => ({ name, sort_order: i + 1 }));

async function main(): Promise<void> {
  try {
    const types = await prisma.dtsProcessType.createMany({ data: rows(PROCESS_TYPES), skipDuplicates: true });
    console.log(`✅ Process types: ${types.count} created`);

    const purposes = await prisma.dtsPurpose.createMany({ data: rows(PURPOSES), skipDuplicates: true });
    console.log(`✅ Process purposes: ${purposes.count} created`);

    const offices = await prisma.dtsOffice.createMany({ data: rows(OFFICES), skipDuplicates: true });
    console.log(`✅ Destination offices: ${offices.count} created`);

    const role = await prisma.role.createMany({ data: [DTS_ROLE], skipDuplicates: true });
    console.log(`✅ DTS Officer role: ${role.count} created`);

    console.log('🎉 DTS seeding complete.');
  } catch (error) {
    console.error('❌ Error during DTS seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
