/**
 * DTS MANUAL-TEST SETUP — one command to skip every prerequisite before testing
 * the Document Tracking System in Postman.
 *
 * It (idempotently):
 *   1. creates/updates fixed test accounts and assigns each to its DTS office
 *        dts.coordinator  Financial Assistance Coordinator  Scholarship Office  (creates tracks)
 *        dts.accounting   DTS Officer                       Accounting Office
 *        dts.treasury     DTS Officer                       Treasury Office
 *        dts.budget       DTS Officer                       Budget Office       (outsider)
 *        dts.student      Student                           (none)              (grantee: read-only view)
 *      all with password "password123"
 *   2. prints a ready-to-use bearer token for each (plus the seeded admin), valid 30 days
 *   3. creates/reuses a "DTS Test Sponsorship" with dts.student as an AWARDED grantee,
 *      so completing test tracks notifies only the test student, never real grantees
 *   4. prints the IDs you need in request bodies: offices, a process type, a purpose,
 *      and the test sponsorship
 *
 * RUN:           npm run dts-test-setup
 * RESET TRACKS:  npm run dts-test-setup -- --reset
 *                (also deletes tracks + history created by dts.coordinator, for a clean re-test)
 *
 * Requires the DTS migration and `npm run prisma-dts`. Refuses to run with
 * NODE_ENV=production. Uses DATABASE_URL and SECRET_KEY from .env.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { binaryToUuid } from "../utils";

const prisma = new PrismaClient();
const RESET = process.argv.includes("--reset");
const PASSWORD = "password123";
const TOKEN_TTL = "30d";

const ACCOUNTS = [
  { key: "coordinator", role: "Financial Assistance Coordinator", office: "Scholarship Office", first: "Carla", last: "Coordinator" },
  { key: "accounting", role: "DTS Officer", office: "Accounting Office", first: "Ana", last: "Accounting" },
  { key: "treasury", role: "DTS Officer", office: "Treasury Office", first: "Tomas", last: "Treasury" },
  { key: "budget", role: "DTS Officer", office: "Budget Office", first: "Bea", last: "Budget" },
  { key: "student", role: "Student", office: null, first: "Sofia", last: "Student" },
];
const TEST_SPONSORSHIP = "DTS Test Sponsorship";

const fail = (msg: string): never => {
  throw new Error(msg);
};

async function main() {
  if (process.env.NODE_ENV === "production") fail("Refusing to run with NODE_ENV=production.");
  const secret = process.env.SECRET_KEY || fail("SECRET_KEY missing from .env.");
  const sign = (email: string, userId: string) => jwt.sign({ email, userId }, secret, { expiresIn: TOKEN_TTL });

  const offices = await prisma.dtsOffice.findMany({ where: { record_status: true }, orderBy: { sort_order: "asc" } });
  if (!offices.length) fail("No DTS offices found — run `npm run prisma-dts` first.");
  const officeByName = new Map(offices.map((o) => [o.name, o]));

  const processType = await prisma.dtsProcessType.findFirst({ where: { record_status: true, is_active: true }, orderBy: { sort_order: "asc" } });
  const purpose = await prisma.dtsPurpose.findFirst({ where: { record_status: true, is_active: true }, orderBy: { sort_order: "asc" } });
  if (!processType || !purpose) fail("No DTS process types/purposes — run `npm run prisma-dts` first.");

  const admin = (await prisma.user.findFirst({ where: { email: "admin@gmail.com" } })) || fail("Seed user admin@gmail.com not found.");
  const hash = await bcrypt.hash(PASSWORD, 10);

  // A dedicated sponsorship, so marking test tracks Done notifies only dts.student.
  let sponsorship = await prisma.sponsorship.findFirst({ where: { name: TEST_SPONSORSHIP, record_status: true } });
  if (!sponsorship) {
    const academicYear = (await prisma.academicYear.findFirst()) || fail("No academic year found — run `npm run prisma-seed`.");
    const now = new Date();
    sponsorship = await prisma.sponsorship.create({
      data: {
        name: TEST_SPONSORSHIP,
        sponsor_id: admin.id, coordinator_id: admin.id, academic_year_id: academicYear.id,
        duration_from: now, duration_to: new Date(now.getTime() + 365 * 86400000),
        batch_number: 1, limit: 10, slot: 10, fund_allocation: 100000,
        status: "active", created_by: admin.id, updated_by: admin.id,
      },
    });
  }

  const results: { key: string; username: string; userId: string; office: string; token: string }[] = [];
  let studentUserId: Uint8Array<ArrayBuffer> | null = null;
  for (const a of ACCOUNTS) {
    const role = (await prisma.role.findUnique({ where: { name: a.role } })) || fail(`Role "${a.role}" not found — run the seeders.`);
    const office = a.office
      ? officeByName.get(a.office) || fail(`DTS office "${a.office}" not found — run \`npm run prisma-dts\`.`)
      : null;
    const email = `dts.${a.key}@example.com`;
    const username = `dts.${a.key}`;

    const data = {
      role_id: role.id,
      first_name: a.first,
      last_name: a.last,
      username,
      mobile_number: "09170000000",
      password: hash,
      record_status: true,
      dts_office_id: office?.id ?? null,
    };
    const existing = await prisma.user.findFirst({ where: { email } });
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data })
      : await prisma.user.create({ data: { ...data, email } });

    const userId = binaryToUuid(user.id);
    if (a.key === "student") studentUserId = user.id;
    results.push({ key: a.key, username, userId, office: a.office ?? `grantee of ${TEST_SPONSORSHIP}`, token: sign(email, userId) });
  }

  // dts.student: a student record with an AWARDED application in the test sponsorship.
  const student =
    (await prisma.student.findFirst({ where: { user_id: studentUserId! } })) ||
    (await prisma.student.create({ data: { user_id: studentUserId!, first_name: "Sofia", last_name: "Student" } }));
  const application = await prisma.sponsorshipApplication.findFirst({
    where: { student_id: student.id, sponsorship_id: sponsorship.id },
  });
  if (application) {
    await prisma.sponsorshipApplication.update({
      where: { id: application.id },
      data: { application_stage: "FINAS_PROPER", application_status: "AWARDED", record_status: true },
    });
  } else {
    await prisma.sponsorshipApplication.create({
      data: {
        app_id: "DTS-TEST-STUDENT", student_id: student.id, sponsorship_id: sponsorship.id,
        application_stage: "FINAS_PROPER", application_status: "AWARDED",
        created_by: admin.id, updated_by: admin.id,
      },
    });
  }

  if (RESET) {
    const coordinator = results.find((r) => r.key === "coordinator")!;
    const creator = await prisma.user.findFirst({ where: { username: coordinator.username } });
    const tracks = await prisma.dtsTrack.findMany({ where: { created_by: creator!.id }, select: { id: true } });
    const ids = tracks.map((t) => t.id);
    // Test-data reset only; the application itself never deletes history.
    await prisma.dtsTrackHistory.deleteMany({ where: { track_id: { in: ids } } });
    await prisma.dtsTrack.deleteMany({ where: { id: { in: ids } } });
    console.log(`\n🧹 Reset: deleted ${ids.length} track(s) created by ${coordinator.username}.`);
  }

  // ------------------------------------------------------------------ output
  const line = "─".repeat(78);
  console.log(`\n${line}\nDTS TEST SETUP READY   base URL: http://localhost:${process.env.PORT || 8000}/api/v1\n${line}`);

  console.log("\nACCOUNTS (password for all: password123)\n");
  for (const r of results) console.log(`  ${r.username.padEnd(17)} ${r.office.padEnd(34)} userId ${r.userId}`);

  console.log(`\nIDS FOR REQUEST BODIES\n`);
  console.log(`  processTypeId   ${binaryToUuid(processType!.id)}   (${processType!.name})`);
  console.log(`  purposeId       ${binaryToUuid(purpose!.id)}   (${purpose!.name})`);
  console.log(`  sponsorshipId   ${binaryToUuid(sponsorship!.id)}   (${sponsorship!.name})`);
  console.log(`\n  destination offices (destinationId):`);
  for (const o of offices) console.log(`    ${binaryToUuid(o.id)}   ${o.name}`);

  console.log(`\nBEARER TOKENS (valid ${TOKEN_TTL}) — Authorization: Bearer <token>\n`);
  for (const r of results) console.log(`  ${r.key}:\n  ${r.token}\n`);
  if (admin) console.log(`  admin (admin@gmail.com, no office — setup manager):\n  ${sign(admin.email, binaryToUuid(admin.id))}\n`);

  console.log(`${line}\nSample Create & Submit body (POST /document-tracks as coordinator):\n`);
  console.log(JSON.stringify({
    title: "Batch 1 Scholarship Voucher Processing",
    particulars: "Scholarship vouchers and supporting documents for Batch 1 grantees",
    processTypeId: binaryToUuid(processType!.id),
    purposeId: binaryToUuid(purpose!.id),
    sponsorshipId: binaryToUuid(sponsorship!.id),
    destinationId: binaryToUuid(officeByName.get("Accounting Office")!.id),
    submit: true,
  }, null, 2));
  console.log(line);
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
