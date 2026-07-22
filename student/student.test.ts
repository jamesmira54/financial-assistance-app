// Ensure a deterministic JWT secret BEFORE the app is required (require, not
// import, so this assignment runs before app.ts calls dotenv.config()).
process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret';

import request from 'supertest';
import jwt from 'jsonwebtoken';
const app = require('../app').default;

const token = jwt.sign(
  { email: 'tester@example.com', userId: 'test-user-id' },
  process.env.SECRET_KEY as string,
  { expiresIn: '1h' },
);

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

describe('GET /api/v1/students/academic-strands', () => {
  it('returns the five predefined senior-high academic strands', async () => {
    const res = await auth(request(app).get('/api/v1/students/academic-strands'));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(['ABM', 'STEM', 'HUMSS', 'GAS', 'TVL']);
  });
});

describe('GET /api/v1/students/award-honors', () => {
  it('returns the predefined award/honor values', async () => {
    const res = await auth(request(app).get('/api/v1/students/award-honors'));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      'With Highest Honor',
      'With High Honor',
      'With Honor',
      'Sports Excellence Award',
    ]);
  });
});

const STRAND_ERROR = 'G12 academic strand must be one of';
const AWARD_ERROR = 'award/honor must be one of';
const MOBILE_ERROR = 'Mobile number must be 11 digits';
const RELATIONSHIP_ERROR = 'Emergency contact relationship';
const G12_SCHOOL_NAME_ERROR = 'G12 school name';

describe('g12SchoolName validation on student create', () => {
  const post = (body: Record<string, unknown>) =>
    auth(request(app).post('/api/v1/students')).send({
      email: 'newstudent@example.com',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      mobileNumber: '09171234567',
      ...body,
    });

  it('rejects a g12SchoolName that is not a string', async () => {
    const res = await post({ g12SchoolName: 12345 });

    expect(res.text).toContain(G12_SCHOOL_NAME_ERROR);
  });

  it('accepts a free-text school name that is not a registered school (no existence check)', async () => {
    const res = await post({ g12SchoolName: 'Some Unlisted Provincial High School' });

    expect(res.text).not.toContain(G12_SCHOOL_NAME_ERROR);
    expect(res.text).not.toContain('not found in the system');
  });

  it('treats g12SchoolName as optional (no error when omitted)', async () => {
    const res = await post({});

    expect(res.text).not.toContain(G12_SCHOOL_NAME_ERROR);
  });
});

describe('emergencyContactRelationship validation on student create', () => {
  const post = (body: Record<string, unknown>) =>
    auth(request(app).post('/api/v1/students')).send({
      email: 'newstudent@example.com',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      mobileNumber: '09171234567',
      ...body,
    });

  it('rejects a relationship that is not a string', async () => {
    const res = await post({ emergencyContactRelationship: 12345 });

    expect(res.text).toContain(RELATIONSHIP_ERROR);
  });

  it('accepts a valid string relationship (no relationship error)', async () => {
    const res = await post({ emergencyContactRelationship: 'Mother' });

    expect(res.text).not.toContain(RELATIONSHIP_ERROR);
  });

  it('treats emergencyContactRelationship as optional (no error when omitted)', async () => {
    const res = await post({});

    expect(res.text).not.toContain(RELATIONSHIP_ERROR);
  });
});

describe('mobileNumber validation on student create', () => {
  const post = (mobileNumber: unknown) =>
    auth(request(app).post('/api/v1/students')).send({
      email: 'newstudent@example.com',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      mobileNumber,
    });

  it.each([
    ['0917123456', 'too short (10 digits)'],
    ['091712345678', 'too long (12 digits)'],
    ['0917123456a', 'contains a non-digit'],
    ['08171234567', 'wrong prefix (not 09)'],
  ])('rejects %j — %s', async (value) => {
    const res = await post(value);

    expect(res.text).toContain(MOBILE_ERROR);
  });

  it('accepts a valid 11-digit 09 number', async () => {
    const res = await post('09171234567');

    expect(res.text).not.toContain(MOBILE_ERROR);
  });

  it('accepts a valid number with surrounding whitespace (trimmed)', async () => {
    const res = await post('  09171234567  ');

    expect(res.text).not.toContain(MOBILE_ERROR);
  });
});

describe('g12AcademicStrand validation on student create', () => {
  const post = (body: Record<string, unknown>) =>
    auth(request(app).post('/api/v1/students')).send({
      email: 'newstudent@example.com',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      mobileNumber: '09171234567',
      ...body,
    });

  it('rejects a strand that is not one of the predefined values', async () => {
    const res = await post({ g12AcademicStrand: 'NOT_A_STRAND' });

    expect(res.text).toContain(STRAND_ERROR);
  });

  it.each(['ABM', 'STEM', 'HUMSS', 'GAS', 'TVL'])(
    'accepts the valid strand %s (no strand error)',
    async (strand) => {
      const res = await post({ g12AcademicStrand: strand });

      expect(res.text).not.toContain(STRAND_ERROR);
    },
  );

  it('treats g12AcademicStrand as optional (no strand error when omitted)', async () => {
    const res = await post({});

    expect(res.text).not.toContain(STRAND_ERROR);
  });

  it.each(['stem', 'Stem', '  humss  ', 'tVl'])(
    'accepts strand %j case-insensitively (whitespace trimmed)',
    async (strand) => {
      const res = await post({ g12AcademicStrand: strand });

      expect(res.text).not.toContain(STRAND_ERROR);
    },
  );
});

describe('award/honor validation on student create', () => {
  const post = (body: Record<string, unknown>) =>
    auth(request(app).post('/api/v1/students')).send({
      email: 'newstudent@example.com',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      mobileNumber: '09171234567',
      ...body,
    });

  it('rejects a g12AwardHonor outside the predefined values', async () => {
    const res = await post({ g12AwardHonor: 'Best in Math' });

    expect(res.text).toContain(AWARD_ERROR);
  });

  it('rejects a collegeAwardHonor outside the predefined values', async () => {
    const res = await post({ collegeAwardHonor: 'Cum Laude' });

    expect(res.text).toContain(AWARD_ERROR);
  });

  it.each(['With Highest Honor', 'With High Honor', 'With Honor', 'Sports Excellence Award'])(
    'accepts the valid award %j',
    async (award) => {
      const res = await post({ g12AwardHonor: award, collegeAwardHonor: award });

      expect(res.text).not.toContain(AWARD_ERROR);
    },
  );

  it.each(['with honor', '  WITH HIGHEST HONOR  ', 'sports excellence award'])(
    'accepts award %j case-insensitively (whitespace trimmed)',
    async (award) => {
      const res = await post({ g12AwardHonor: award });

      expect(res.text).not.toContain(AWARD_ERROR);
    },
  );

  it('treats award/honor fields as optional (no error when omitted)', async () => {
    const res = await post({});

    expect(res.text).not.toContain(AWARD_ERROR);
  });
});
