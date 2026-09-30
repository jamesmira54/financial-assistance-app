// Manual mock for @prisma/client.
//
// We keep every real export (enums, the `Prisma` namespace, generated types)
// via requireActual, and swap ONLY the PrismaClient constructor for a stub.
// Services instantiate `new PrismaClient()` at module load; this makes that a
// no-op object whose model methods are jest mocks we control from tests.
// No real database connection is ever opened.
const actual = jest.requireActual('@prisma/client');

const mockPrisma = {
  sponsorship: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
  announcement: { findMany: jest.fn(), count: jest.fn() },
  student: { findFirst: jest.fn() },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  notification: { create: jest.fn(), createMany: jest.fn() },
  // Document Tracking System. documentTracking.test.ts backs these with an
  // in-memory store.
  dtsProcessType: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  dtsPurpose: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  dtsOffice: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  dtsSequence: { upsert: jest.fn() },
  dtsTrack: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  dtsTrackHistory: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  sponsorshipApplication: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  schedule: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  // Callback form runs the callback with the same mock instance; array form
  // resolves each promise. Mirrors how prisma.$transaction is used in services.
  $transaction: jest.fn(async (arg) =>
    typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg),
  ),
};

module.exports = {
  ...actual,
  PrismaClient: jest.fn(() => mockPrisma),
  __mockPrisma: mockPrisma,
};
