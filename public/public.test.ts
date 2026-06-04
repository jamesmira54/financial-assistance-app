import request from 'supertest';
import app from '../app';

// The manual mock (__mocks__/@prisma/client.js) exposes the shared instance
// returned by every `new PrismaClient()` so we can drive query results.
const { __mockPrisma } = require('@prisma/client');

beforeEach(() => {
  jest.clearAllMocks();
  __mockPrisma.sponsorship.findMany.mockResolvedValue([]);
  __mockPrisma.sponsorship.count.mockResolvedValue(0);
  __mockPrisma.announcement.findMany.mockResolvedValue([]);
  __mockPrisma.announcement.count.mockResolvedValue(0);
});

describe('GET /api/v1/public/sponsorships', () => {
  it('responds 200 without any Authorization header and queries sponsorships', async () => {
    const res = await request(app).get('/api/v1/public/sponsorships');

    expect(res.status).toBe(200);
    expect(__mockPrisma.sponsorship.findMany).toHaveBeenCalledTimes(1);
  });

  it('only ever queries ACTIVE sponsorships (no soft-deleted records leak publicly)', async () => {
    await request(app).get('/api/v1/public/sponsorships');

    const findArgs = __mockPrisma.sponsorship.findMany.mock.calls[0][0];
    const countArgs = __mockPrisma.sponsorship.count.mock.calls[0][0];
    // RecordStatus.ACTIVE === true
    expect(findArgs.where.record_status).toBe(true);
    expect(countArgs.where.record_status).toBe(true);
  });
});

describe('GET /api/v1/public/announcements', () => {
  it('responds 200 without any Authorization header and queries announcements', async () => {
    const res = await request(app).get('/api/v1/public/announcements');

    expect(res.status).toBe(200);
    expect(__mockPrisma.announcement.findMany).toHaveBeenCalledTimes(1);
  });

  it('only ever queries ACTIVE announcements (no soft-deleted records leak publicly)', async () => {
    await request(app).get('/api/v1/public/announcements');

    const findArgs = __mockPrisma.announcement.findMany.mock.calls[0][0];
    const countArgs = __mockPrisma.announcement.count.mock.calls[0][0];
    expect(findArgs.where.record_status).toBe(true);
    expect(countArgs.where.record_status).toBe(true);
  });
});

describe('public endpoints are exempt from authentication', () => {
  it('serves /public routes with no token while a protected route is rejected', async () => {
    const publicRes = await request(app).get('/api/v1/public/announcements');
    const protectedRes = await request(app).get('/api/v1/notifications');

    expect(publicRes.status).toBe(200);
    // authentication middleware -> ResponseHandler.forbidden -> 400 BAD_REQUEST
    expect(protectedRes.status).toBe(400);
  });
});

describe('public listing filters', () => {
  it('filters sponsorships by name when search is provided', async () => {
    await request(app).get('/api/v1/public/sponsorships').query({ search: 'scholarship' });

    const where = __mockPrisma.sponsorship.findMany.mock.calls[0][0].where;
    expect(where.name).toEqual({ contains: 'scholarship' });
  });

  it('searches announcements across title, caption and content', async () => {
    await request(app).get('/api/v1/public/announcements').query({ search: 'flood' });

    const where = __mockPrisma.announcement.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { title: { contains: 'flood' } },
      { caption: { contains: 'flood' } },
      { content: { contains: 'flood' } },
    ]);
  });

  it('filters announcements by city/municipality location', async () => {
    await request(app).get('/api/v1/public/announcements').query({ cityMunId: 42 });

    const where = __mockPrisma.announcement.findMany.mock.calls[0][0].where;
    expect(where.locations).toEqual({ some: { citymun_id: 42 } });
  });

  it('orders announcements ascending when sort=asc', async () => {
    await request(app).get('/api/v1/public/announcements').query({ sort: 'asc' });

    const orderBy = __mockPrisma.announcement.findMany.mock.calls[0][0].orderBy;
    expect(orderBy.created_at).toBe('asc');
  });
});
