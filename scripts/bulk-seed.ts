/**
 * BULK DATA SEEDER — drives the real system API (in-process, via supertest) to create:
 *
 *   - 10 Financial Assistance Coordinator users          POST /auth/register
 *   - 10 Sponsorships (one per coordinator, owned by them) POST /sponsorships/coordinator
 *   - 50 Students (user + student record)                POST /auth/student/register
 *   - 500 Applications (every student applies to every sponsorship) POST /sponsorships/student
 *   - Accept/reject decisions on all 500                 PUT  .../students/:id/status
 *
 * Everything goes through the actual Express routes → middleware → controllers → services,
 * so it is persisted to the real local MySQL DB (faa-db). No mocks. Nothing is cleaned up.
 *
 * RUN:  npx ts-node scripts/bulk-seed.ts
 *
 * DECISION POLICY (deterministic; rotated per-sponsorship so different students win each one):
 *   For each application a "rank" v = (studentIndex + 7*sponsorshipIndex) % 50 buckets it:
 *     v <10 -> REJECTED at POOLING
 *     v <20 -> COMPLETE(pooling) then REJECTED at APPLICATION_LIST
 *     v <40 -> COMPLETE -> APPROVED, left PENDING in RANKING_SELECTION
 *     v <50 -> COMPLETE -> APPROVED -> RANKED, ends AWARDED (FINAS_PROPER)
 *   => per sponsorship: 10 rejected(pooling), 10 rejected(app-list), 20 in ranking, 10 awarded.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
const app = require('../app').default;
import { binaryToUuid, APPLICATION_STAGE, APPLICATION_STATUS } from '../utils';

const prisma = new PrismaClient();
const SECRET = process.env.SECRET_KEY as string;
const STAMP = Date.now();

const NUM_COORDINATORS = 10;
const NUM_STUDENTS = 50;
const COORDINATOR_ROLE_ID = '49ce0be7-47b6-11f1-be6c-f4b520508eb0';

const token = (email: string, userId: string) =>
  jwt.sign({ email, userId }, SECRET, { expiresIn: '12h' });

const P = (url: string, tok?: string) => {
  const r = request(app).post(url);
  return tok ? r.set('Authorization', `Bearer ${tok}`) : r;
};
const PUT = (url: string, tok: string) =>
  request(app).put(url).set('Authorization', `Bearer ${tok}`);

type Coordinator = { email: string; userId: string; token: string; sponsorshipId?: string };
type Student = { index: number; email: string; userId: string; studentId: string; token: string };

const outcomes = {
  REJECTED_POOLING: 0,
  REJECTED_APPLICATION_LIST: 0,
  IN_RANKING: 0,
  AWARDED: 0,
  applyFailures: 0,
  decisionFailures: 0,
};

async function main() {
  if (!SECRET) throw new Error('SECRET_KEY not loaded from .env.');
  console.log(`\n=== BULK SEED (stamp ${STAMP}) ===`);

  // ---- Resolve seed references -------------------------------------------
  const admin = await prisma.user.findFirst({ where: { email: 'admin@gmail.com' } });
  const sponsor = await prisma.user.findFirst({ where: { email: 'sponsor1@gmail.com' } });
  const academicYear = await prisma.academicYear.findFirst();
  const fileTypes = await prisma.fileType.findMany({ take: 3 });
  if (!admin || !sponsor || !academicYear || !fileTypes.length) {
    throw new Error('Missing seed refs (admin/sponsor/academicYear/fileType). Run the seeders.');
  }
  const adminToken = token(admin.email, binaryToUuid(admin.id));
  const sponsorId = binaryToUuid(sponsor.id);
  const academicYearId = binaryToUuid(academicYear.id);
  const requirementIds = fileTypes.map((f) => binaryToUuid(f.id));

  // ---- 1) Create 10 coordinators -----------------------------------------
  console.log(`\n[1/5] Creating ${NUM_COORDINATORS} coordinators...`);
  const coordEmails: string[] = [];
  for (let i = 0; i < NUM_COORDINATORS; i++) {
    const email = `coord.${STAMP}.${i}@example.com`;
    const res = await P('/api/v1/auth/register', adminToken).send({
      username: `coord_${STAMP}_${i}`,
      email,
      password: 'secret123',
      repassword: 'secret123',
      firstName: `Coordinator${i}`,
      lastName: `Batch${STAMP}`,
      mobileNumber: '09170000001',
      roleId: COORDINATOR_ROLE_ID,
    });
    if (res.status !== 201) throw new Error(`Coordinator ${i} failed: ${res.status} ${res.text}`);
    coordEmails.push(email);
  }
  const coordRows = await prisma.user.findMany({ where: { email: { in: coordEmails } } });
  const coordinators: Coordinator[] = coordRows.map((u) => ({
    email: u.email,
    userId: binaryToUuid(u.id),
    token: token(u.email, binaryToUuid(u.id)),
  }));
  console.log(`      created ${coordinators.length} coordinators.`);

  // ---- 2) Each coordinator creates a sponsorship -------------------------
  console.log(`\n[2/5] Each coordinator creates a sponsorship...`);
  const from = new Date();
  const to = new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000);
  for (let i = 0; i < coordinators.length; i++) {
    const c = coordinators[i];
    const res = await P('/api/v1/sponsorships/coordinator', c.token).send({
      name: `Bulk Sponsorship ${STAMP}-${i}`,
      sponsorId,
      academicYearId,
      durationFrom: from.toISOString(),
      durationTo: to.toISOString(),
      batchNumber: (STAMP % 10000) + i,
      limit: 100,
      slot: 100,
      fundAllocation: 2_000_000,
      allowancePerStudent: 20_000,
      sponsorshipSchool: [],
      sponsorshipRequirements: requirementIds,
    });
    if (res.status !== 201) throw new Error(`Sponsorship ${i} failed: ${res.status} ${res.text}`);
    c.sponsorshipId = res.body.data.id;
  }
  console.log(`      created ${coordinators.length} sponsorships.`);

  // ---- 3) Create 50 students ---------------------------------------------
  console.log(`\n[3/5] Creating ${NUM_STUDENTS} students...`);
  const studentEmails: string[] = [];
  for (let i = 0; i < NUM_STUDENTS; i++) {
    const email = `student.${STAMP}.${i}@example.com`;
    const res = await P('/api/v1/auth/student/register').send({
      username: `student_${STAMP}_${i}`,
      email,
      password: 'secret123',
      repassword: 'secret123',
      firstName: `Student${i}`,
      lastName: `Batch${STAMP}`,
      mobileNumber: '09170000002',
    });
    if (res.status !== 201) throw new Error(`Student ${i} failed: ${res.status} ${res.text}`);
    studentEmails.push(email);
  }
  const userRows = await prisma.user.findMany({ where: { email: { in: studentEmails } } });
  const userByEmail = new Map(userRows.map((u) => [u.email, u]));
  const students: Student[] = [];
  for (let i = 0; i < NUM_STUDENTS; i++) {
    const email = studentEmails[i];
    const u = userByEmail.get(email)!;
    const st = await prisma.student.findFirst({ where: { user_id: u.id } });
    if (!st) throw new Error(`Student record not created for ${email}`);
    students.push({
      index: i,
      email,
      userId: binaryToUuid(u.id),
      studentId: binaryToUuid(st.id),
      token: token(email, binaryToUuid(u.id)),
    });
  }
  console.log(`      created ${students.length} students.`);

  // ---- 4) & 5) Apply to every sponsorship + decide -----------------------
  const totalApps = coordinators.length * students.length;
  console.log(`\n[4/5] ${students.length} students apply to ${coordinators.length} sponsorships (${totalApps} applications)...`);
  console.log(`[5/5] Deciding accept/reject on each application...`);

  let done = 0;
  const report: string[] = [];
  for (let s = 0; s < coordinators.length; s++) {
    const c = coordinators[s];
    const sid = c.sponsorshipId!;
    for (const stu of students) {
      // Apply (as the student).
      const applyRes = await P('/api/v1/sponsorships/student', stu.token).send({
        studentId: stu.studentId,
        sponsorshipId: sid,
      });
      if (applyRes.status !== 200) {
        outcomes.applyFailures++;
        report.push(`APPLY_FAIL,${stu.email},${sid},${applyRes.status}`);
        continue;
      }

      // Decide bucket (rotated per sponsorship).
      const v = (stu.index + 7 * s) % 50;
      let final: string;
      try {
        if (v < 10) {
          await decide(c, stu, sid, APPLICATION_STAGE.POOLING, APPLICATION_STATUS.REJECTED, 'Incomplete requirements at pooling.');
          outcomes.REJECTED_POOLING++; final = 'REJECTED_POOLING';
        } else if (v < 20) {
          await decide(c, stu, sid, APPLICATION_STAGE.POOLING, APPLICATION_STATUS.COMPLETE);
          await decide(c, stu, sid, APPLICATION_STAGE.APPLICATION_LIST, APPLICATION_STATUS.REJECTED, 'Did not meet application-list criteria.');
          outcomes.REJECTED_APPLICATION_LIST++; final = 'REJECTED_APPLICATION_LIST';
        } else if (v < 40) {
          await decide(c, stu, sid, APPLICATION_STAGE.POOLING, APPLICATION_STATUS.COMPLETE);
          await decide(c, stu, sid, APPLICATION_STAGE.APPLICATION_LIST, APPLICATION_STATUS.APPROVED);
          outcomes.IN_RANKING++; final = 'IN_RANKING (PENDING_RANKING_SELECTION)';
        } else {
          await decide(c, stu, sid, APPLICATION_STAGE.POOLING, APPLICATION_STATUS.COMPLETE);
          await decide(c, stu, sid, APPLICATION_STAGE.APPLICATION_LIST, APPLICATION_STATUS.APPROVED);
          await decide(c, stu, sid, APPLICATION_STAGE.RANKING_SELECTION, APPLICATION_STATUS.RANKED);
          outcomes.AWARDED++; final = 'AWARDED';
        }
      } catch (e: any) {
        outcomes.decisionFailures++;
        final = `DECISION_FAIL: ${e.message}`;
      }
      report.push(`${final},${stu.email},Bulk Sponsorship ${STAMP}-${s}`);

      done++;
      if (done % 50 === 0) console.log(`      ...${done}/${totalApps} applications processed`);
    }
  }

  // ---- Summary + report file ---------------------------------------------
  console.log(`\n=== SUMMARY ===`);
  console.table({
    coordinators: coordinators.length,
    sponsorships: coordinators.length,
    students: students.length,
    applications: totalApps,
    ...outcomes,
  });

  const reportDir = path.join(__dirname, '..', 'docs', 'sessions', 'be');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `bulk-seed-${STAMP}.csv`);
  fs.writeFileSync(reportPath, 'outcome,studentEmail,sponsorship\n' + report.join('\n') + '\n');
  console.log(`\nPer-application outcomes written to: ${reportPath}`);
}

async function decide(
  c: Coordinator,
  stu: Student,
  sponsorshipId: string,
  appStage: APPLICATION_STAGE,
  appStatus: APPLICATION_STATUS,
  remarks?: string,
) {
  const res = await PUT(
    `/api/v1/sponsorships/coordinator/students/${stu.studentId}/status`,
    c.token,
  ).send({ sponsorshipId, appStage, appStatus, ...(remarks ? { remarks } : {}) });
  if (res.status !== 200) {
    throw new Error(`status ${res.status} @${appStage}/${appStatus}: ${res.text?.slice(0, 120)}`);
  }
}

main()
  .catch((e) => {
    console.error('\nFATAL:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // The app's per-module PrismaClients keep the pool open; exit explicitly.
    setTimeout(() => process.exit(process.exitCode ?? 0), 500);
  });
