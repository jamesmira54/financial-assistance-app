import { validationResult } from 'express-validator';
import { validateSponsorship } from '../middleware/validation';

// HTML form inputs hand back strings, so a sponsorship payload can arrive with
// "1" where the schema wants an Int. isInt()/isFloat() accept those strings, and
// the uncoerced value used to reach Prisma and blow up on the Int columns
// (batch_number, limit, slot) with an opaque 400. The chains now sanitize.
const runChains = async (body: Record<string, unknown>) => {
  const req: any = { body, params: {}, query: {}, headers: {}, cookies: {} };
  for (const chain of validateSponsorship as any[]) {
    if (typeof chain.run === 'function') {
      await chain.run(req);
    }
  }
  return req;
};

const numericBody = {
  batchNumber: '1',
  limit: '10',
  slot: '5',
  fundAllocation: '100000',
  allowancePerStudent: '1500',
};

describe('sponsorship numeric fields sent as strings', () => {
  it('passes validation', async () => {
    const req = await runChains({ ...numericBody });
    const failed = validationResult(req)
      .array()
      .map((e: any) => e.path);

    expect(failed).not.toContain('batchNumber');
    expect(failed).not.toContain('limit');
    expect(failed).not.toContain('slot');
    expect(failed).not.toContain('fundAllocation');
    expect(failed).not.toContain('allowancePerStudent');
  });

  it('is coerced to numbers before the handler writes to Prisma', async () => {
    const req = await runChains({ ...numericBody });

    expect(req.body.batchNumber).toBe(1);
    expect(req.body.limit).toBe(10);
    expect(req.body.slot).toBe(5);
    expect(req.body.fundAllocation).toBe(100000);
    expect(req.body.allowancePerStudent).toBe(1500);
  });

  it('leaves numbers untouched', async () => {
    const req = await runChains({
      batchNumber: 2,
      limit: 20,
      slot: 8,
      fundAllocation: 250000.5,
      allowancePerStudent: 1500.25,
    });

    expect(req.body.batchNumber).toBe(2);
    expect(req.body.limit).toBe(20);
    expect(req.body.slot).toBe(8);
    expect(req.body.fundAllocation).toBe(250000.5);
    expect(req.body.allowancePerStudent).toBe(1500.25);
  });

  it('still rejects a non-numeric value', async () => {
    const req = await runChains({ ...numericBody, limit: 'ten' });
    const failed = validationResult(req)
      .array()
      .map((e: any) => e.path);

    expect(failed).toContain('limit');
  });
});
