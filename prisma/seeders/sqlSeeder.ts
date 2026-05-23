import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const sqlFiles = [
    { label: 'Region', file: '../locations/regions.sql' },
    { label: 'Province', file: '../locations/provinces.sql' },
    { label: 'City mun', file: '../locations/citymuns.sql' },
    { label: 'Barangay', file: '../locations/barangays.sql' },
    { label: 'School', file: '../locations/schools.sql' },
];

async function executeSqlFile(label: string, relativePath: string) {
    const fullPath = path.join(__dirname, relativePath);
    const sql = fs.readFileSync(fullPath, 'utf8');
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
    }
    console.log(`✅ SQL ${label} file executed successfully.`);
}

async function seedFromSqlFile() {
    try {
        for (const { label, file } of sqlFiles) {
        await executeSqlFile(label, file);
        }
    } catch (error) {
        console.error('❌ Failed to execute SQL file:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedFromSqlFile();
