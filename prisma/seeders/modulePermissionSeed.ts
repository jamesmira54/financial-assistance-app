import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['query'] });

// Top-level (parent) modules
const PARENT_MODULES = [
  { name: 'Dashboard',         sorter: 1 },
  { name: 'Announcements',     sorter: 2 },
  { name: 'Finas Application', sorter: 3 },
  { name: 'Financing',         sorter: 4 },
  { name: 'Setup Manager',     sorter: 5 },
  { name: 'Settings',          sorter: 6 },
];

// Child modules keyed by their parent name
const CHILD_MODULES: Record<string, { name: string; sorter: number }[]> = {
  'Finas Application': [
    { name: 'Pooling',           sorter: 1 },
    { name: 'Application List',  sorter: 2 },
    { name: 'Ranking Selection', sorter: 3 },
    { name: 'Finas Proper',      sorter: 4 },
  ],
  'Financing': [
    { name: 'Budget Office',      sorter: 1 },
    { name: "Mayor's Office",     sorter: 2 },
    { name: "Treasurer's Office", sorter: 3 },
    { name: 'Cashiering',         sorter: 4 },
    { name: 'Accounting',         sorter: 5 },
  ],
  'Setup Manager': [
    { name: 'Academic Setup',  sorter: 1 },
    { name: 'Sponsorships',    sorter: 2 },
    { name: 'Schools',         sorter: 3 },
    { name: 'Schedules',       sorter: 4 },
    { name: 'Ranking Order',   sorter: 5 },
  ],
  'Settings': [
    { name: 'Profile',          sorter: 1 },
    { name: 'User Accounts',    sorter: 2 },
    { name: 'Student Accounts', sorter: 3 },
  ],
};

async function seedModules(): Promise<void> {
  console.log('🌱 Seeding modules...');

  // 1. Create parent modules first (parent_id = null)
  for (const mod of PARENT_MODULES) {
    const existing = await prisma.module.findFirst({
      where: { name: mod.name, parent_id: null },
    });

    if (existing) {
      console.log(`  ⏭️  Skipped (already exists): ${mod.name}`);
    } else {
      await prisma.module.create({
        data: { name: mod.name, sorter: mod.sorter, parent_id: null, record_status: true },
      });
      console.log(`  ✅ Created: ${mod.name}`);
    }
  }

  // 2. Fetch all parent modules to get their real IDs
  const parents = await prisma.module.findMany({
    where: { parent_id: null },
    select: { id: true, name: true },
  });

  const parentMap = new Map(parents.map((p) => [p.name, p.id]));

  // 3. Create child modules using the actual parent UUID (parent_id)
  for (const [parentName, children] of Object.entries(CHILD_MODULES)) {
    const parentId = parentMap.get(parentName);

    if (!parentId) {
      console.warn(`  ⚠️  Parent not found: ${parentName} — skipping its children`);
      continue;
    }

    for (const child of children) {
      const existing = await prisma.module.findFirst({
        where: { name: child.name, parent_id: parentId },
      });

      if (existing) {
        console.log(`  ⏭️  Skipped (already exists): ${parentName} > ${child.name}`);
      } else {
        await prisma.module.create({
          data: { name: child.name, sorter: child.sorter, parent_id: parentId, record_status: true },
        });
        console.log(`  ✅ Created: ${parentName} > ${child.name}`);
      }
    }
  }

  console.log('✅ Module seeding complete.\n');
}

async function seedPermissions(): Promise<void> {
  console.log('🌱 Seeding module permissions for all roles...');

  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const modules = await prisma.module.findMany({ select: { id: true, name: true } });

  if (roles.length === 0) throw new Error('No roles found. Run role seed first.');
  if (modules.length === 0) throw new Error('No modules found. Run module seed first.');

  let created = 0;
  let skipped = 0;

  for (const role of roles) {
    for (const mod of modules) {
      const existing = await prisma.modulePermission.findFirst({
        where: { role_id: role.id, module_id: mod.id },
      });

      if (existing) {
        skipped++;
      } else {
        await prisma.modulePermission.create({
          data: {
            role_id: role.id,
            module_id: mod.id,
            show: true,
            edit: true,
            save: true,
            delete: true,
          },
        });
        created++;
      }
    }
  }

  console.log(`  ✅ Created: ${created} permissions`);
  console.log(`  ⏭️  Skipped: ${skipped} (already exist)`);
  console.log('✅ Permission seeding complete.\n');
}

async function main(): Promise<void> {
  try {
    await seedModules();
    await seedPermissions();
    console.log('🎉 All done!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
