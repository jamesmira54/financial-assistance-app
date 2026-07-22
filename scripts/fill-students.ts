/**
 * FILL ALL STUDENT DATA via the real update API (PUT /api/v1/students/:studentId).
 *
 * Loads every student in the DB and re-submits a fully-populated payload through the
 * actual route -> validation -> updateStudentService path, so no student column is left
 * null. Address FK columns are set to a real, consistent barangay->citymun->province->
 * region chain, and collegeSchoolId to a real school, resolved from the DB at runtime.
 *
 * Three columns are intentionally NOT written by the update API and will stay null:
 *   - emergency_contact_name2 / emergency_contact_number2  (deprecated; API no longer writes)
 *   - mother_maiden_extension                               (Prisma @ignore; not settable)
 *
 * RUN:  TS_NODE_TRANSPILE_ONLY=1 npx ts-node scripts/fill-students.ts
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const app = require('../app').default;
import { binaryToUuid } from '../utils';

const prisma = new PrismaClient();
const SECRET = process.env.SECRET_KEY as string;

const SEX = ['Male', 'Female'];
const STRANDS = ['STEM', 'ABM', 'HUMSS', 'GAS', 'TVL'];
const AWARDS = ['With Highest Honor', 'With High Honor', 'With Honor', 'Sports Excellence Award'];

async function main() {
  if (!SECRET) throw new Error('SECRET_KEY not loaded from .env.');

  const admin = await prisma.user.findFirst({ where: { email: 'admin@gmail.com' } });
  if (!admin) throw new Error('admin@gmail.com not found.');
  const adminToken = jwt.sign(
    { email: admin.email, userId: binaryToUuid(admin.id) },
    SECRET,
    { expiresIn: '12h' },
  );

  // Resolve a consistent address chain + a school from the seeded reference data.
  const brg = await prisma.barangay.findFirst();
  if (!brg) throw new Error('No barangay rows — run npm run prisma-sql.');
  const citymun = await prisma.citymun.findFirst({ where: { citymun_code: brg.citymun_code } });
  const province = await prisma.province.findFirst({ where: { prov_code: brg.prov_code } });
  const region = await prisma.region.findFirst({ where: { reg_code: brg.reg_code } });
  const school = await prisma.school.findFirst();
  if (!citymun || !province || !region) throw new Error('Address chain incomplete.');
  if (!school) throw new Error('No school rows — cannot set collegeSchoolId.');

  const addr = {
    brgId: brg.id,
    citymunId: citymun.id,
    provinceId: province.id,
    regionId: region.id,
    schoolId: binaryToUuid(school.id),
  };
  console.log('Address chain:', addr);

  // Every student + its owning user (for userId + a guaranteed-valid email).
  const students = await prisma.student.findMany({ include: { users: true } });
  console.log(`Updating ${students.length} students...\n`);

  let ok = 0;
  const failures: string[] = [];

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const studentId = binaryToUuid(s.id);
    const userId = binaryToUuid(s.user_id);
    const email = s.email || s.users.email; // own email avoids the "taken by another" check
    const n = i + 1;

    const payload = {
      userId,
      email,
      // Personal
      firstName: s.first_name || `Student${n}`,
      middleName: 'Santos',
      lastName: s.last_name || `Dela Cruz ${n}`,
      extensionName: 'Jr.',
      sex: SEX[i % SEX.length],
      placeOfBirth: 'Iligan City',
      birthdate: '2003-05-15',
      height: 165.5,
      weight: 58.2,
      // Permanent address
      permanentStreet: `${100 + n} Purok 3, Rizal Street`,
      permanentBrgId: addr.brgId,
      permanentCitymunId: addr.citymunId,
      permanentProvinceId: addr.provinceId,
      permanentRegionId: addr.regionId,
      permanentZipCode: 9200,
      permanentCountry: 'Philippines',
      // Current address
      currentStreet: `${100 + n} Purok 3, Rizal Street`,
      currentBrgId: addr.brgId,
      currentCitymunId: addr.citymunId,
      currentProvinceId: addr.provinceId,
      currentRegionId: addr.regionId,
      currentZipCode: 9200,
      currentCountry: 'Philippines',
      // Contact
      mobileNumber: '09171234567',
      // Flags
      isSoloParent: i % 2 === 0,
      isChildOfSoloParent: i % 3 === 0,
      isIndigenousPeople: i % 5 === 0,
      indigenousGroup: i % 5 === 0 ? 'Higaonon' : 'None',
      isSped: false,
      isPwd: i % 7 === 0,
      // Emergency contact
      emergencyContactName: 'Maria Dela Cruz',
      emergencyContactNumber: '09181234567',
      emergencyContactRelationship: 'Mother',
      // G12
      g12AcademicStrand: STRANDS[i % STRANDS.length],
      g12ProgramName: 'Science, Technology, Engineering and Mathematics',
      g12AwardHonor: AWARDS[i % AWARDS.length],
      g12Organization: 'Science Club',
      g12YearOfGraduation: 2021,
      g12SchoolName: 'Iligan City National High School',
      // College
      collegeProgramName: 'BS Computer Science',
      collegeYearLevel: (i % 4) + 1,
      collegeAwardHonor: AWARDS[i % AWARDS.length],
      collegeOrganization: 'Computer Studies Society',
      collegeSchoolId: addr.schoolId,
      // Father
      fatherFirstName: 'Juan',
      fatherMiddleName: 'Reyes',
      fatherLastName: 'Dela Cruz',
      fatherExtension: 'Sr.',
      fatherOccupation: 'Farmer',
      fatherIncome: 12000,
      fatherMobileNumber: '09191234567',
      // Mother
      motherFirstName: 'Maria',
      motherMiddleName: 'Lopez',
      motherLastName: 'Santos',
      motherOccupation: 'Vendor',
      motherIncome: 8000,
      motherMobileNumber: '09201234567',
      // Guardian
      guardianFirstName: 'Ana',
      guardianMiddleName: 'Cruz',
      guardianLastName: 'Reyes',
      guardianExtension: 'N/A',
      guardianOccupation: 'Teacher',
      guardianIncome: 20000,
      guardianMobileNumber: '09211234567',
      // Academic
      numberOfSiblings: 2,
      gwa: 1.75,
      // Siblings (populates the siblings table too)
      siblings: [
        { name: 'Pedro Dela Cruz', birthdate: '2008-01-10', age: 17, status: 'Single', livingWithParents: true, ownHouse: false },
        { name: 'Rosa Dela Cruz', birthdate: '2010-09-22', age: 14, status: 'Single', livingWithParents: true, ownHouse: false },
      ],
    };

    const res = await request(app)
      .put(`/api/v1/students/${studentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    if (res.status === 200) {
      ok++;
    } else {
      failures.push(`${email} [${studentId}] -> ${res.status}: ${res.text?.slice(0, 200)}`);
    }
    if (n % 10 === 0) console.log(`  ...${n}/${students.length} updated`);
  }

  console.log(`\n=== DONE: ${ok}/${students.length} updated, ${failures.length} failed ===`);
  failures.slice(0, 10).forEach((f) => console.log('  FAIL:', f));

  // Verify: count NULLs per column across the students table.
  const cols: Array<{ COLUMN_NAME: string }> = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema='faa-db' AND table_name='students'",
  );
  const sumParts = cols.map((c) => `SUM(\`${c.COLUMN_NAME}\` IS NULL) AS \`${c.COLUMN_NAME}\``).join(', ');
  const nullRows: any[] = await prisma.$queryRawUnsafe(`SELECT ${sumParts} FROM students`);
  const nullCounts = nullRows[0];
  const stillNull = Object.entries(nullCounts)
    .filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => `${k}=${Number(v)}`);

  console.log('\n=== NULL COLUMN AUDIT (students table) ===');
  if (stillNull.length === 0) {
    console.log('  No null columns remain. 🎉');
  } else {
    console.log('  Columns still containing NULLs (rows out of', students.length, '):');
    stillNull.forEach((s) => console.log('   ', s));
  }
}

main()
  .catch((e) => {
    console.error('\nFATAL:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    setTimeout(() => process.exit(process.exitCode ?? 0), 500);
  });
