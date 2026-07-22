// Manual mock for @prisma/client.
//
// We keep every real export (enums, the `Prisma` namespace, generated types)
// via requireActual, and swap ONLY the PrismaClient constructor for a stub.
// Services instantiate `new PrismaClient()` at module load; this makes that a
// no-op object whose model methods are jest mocks we control from tests.
// No real database connection is ever opened.
const actual = jest.requireActual('@prisma/client');

const mockPrisma = {
  sponsorship: { findMany: jest.fn(), count: jest.fn() },
  announcement: { findMany: jest.fn(), count: jest.fn() },
  student: { findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
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
