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
};

module.exports = {
  ...actual,
  PrismaClient: jest.fn(() => mockPrisma),
  __mockPrisma: mockPrisma,
};
