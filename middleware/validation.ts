import { ACADEMIC_STRANDS, APPLICATION_STAGE, APPLICATION_STATUS, AuthPayload, AWARD_HONORS, ColumnEnum, error, EvaluationStatus, extractUserFromToken, LoginRequest, RegisterRequest, STATUSES_REQUIRING_REMARKS, TableColumnMap, TableEnum, VALIDATION_MESSAGES } from "../utils";
import { NextFunction, Request, RequestHandler, Response } from "express";
import ResponseHandler from "../response/response";
import { validationResult, body, param } from "express-validator";
import { checkEmailExists, checkRole, checkUsernameExists, getUserRole } from "../authentication/service";
import { doesStudentExist, getOneStudent, getOneStudentUsingUserId, isEmailTakenByAnotherStudent } from "../student/service";
import { query } from "express-validator";
import { checkBarangayExist, checkCityMunExist, checkProvinceExist, checkRegionExist } from "../address/service";
import { checkIfNotSponsor, doesUserExist } from "../user/service";
import { checkIfInvalidSchoolId, checkSchoolExist, checkSchoolNameExist } from "../school/service";
import { checkAcademicYearId, checkExistingAcademicYear } from "../academicYear/service";
import { checkBatch, checkCriterionCategoryId, checkIfSponsorshipExist, checkSponsorshipCriterionCategoryId, checkSponsorshipId, doesStudentAlreadyApplied } from "../sponsorship/service";
import { checkIfInvalidFileTypeId, doesFileExist } from "../file/service";
import { doesAnnExist, doesAnnExistGet } from "../announcement/service";
import { findIfExists } from "../schedule/service";
import { checkCriterionCategoryIdRepo } from "../sponsorship/repository";

const stageStatusMap: Record<APPLICATION_STAGE, APPLICATION_STATUS[]> = {
  [APPLICATION_STAGE.POOLING]: [
    APPLICATION_STATUS.PENDING_POOLING,
    APPLICATION_STATUS.FOLLOW_UP,
    APPLICATION_STATUS.COMPLETE,
    APPLICATION_STATUS.REJECTED
  ],
  [APPLICATION_STAGE.APPLICATION_LIST]: [
    APPLICATION_STATUS.PENDING_APPLICATION_LIST,
    APPLICATION_STATUS.APPROVED,
    APPLICATION_STATUS.REJECTED
  ],
  [APPLICATION_STAGE.RANKING_SELECTION]: [
    APPLICATION_STATUS.PENDING_RANKING_SELECTION,
    APPLICATION_STATUS.RANKED,
    APPLICATION_STATUS.NOT_QUALIFIED
  ],
  [APPLICATION_STAGE.FINAS_PROPER]: [
    APPLICATION_STATUS.AWARDED,
  ]
};


export const validateLoginInput = async (req: Request, res: Response, next: NextFunction) => {
  const data: LoginRequest = req.body;
  const errors: error[] = [];

  // Validate email
  if (!data.username) {
    errors.push({ field: "username", message: VALIDATION_MESSAGES.USERNAME_INVALID });
  }

  // Validate password
  if (!data.password || data.password.trim().length === 0) {
    errors.push({ field: "password", message: VALIDATION_MESSAGES.PASSWORD_EMPTY });
  }

  if (errors.length > 0) {
    ResponseHandler.invalidRequest(req, res, errors);
  } else {
    console.log('Login validation passed, proceeding to next middleware');
    return next();
  }
};

const registerUserCommonValidation =  [
  body("username")
    .notEmpty().withMessage(VALIDATION_MESSAGES.USERNAME_INVALID)
    .custom(async value => {
      const exists = await checkUsernameExists(value);
      if (exists) {
        return Promise.reject(VALIDATION_MESSAGES.USERNAME_IN_USE);
      }
    }),
  body("email")
    .notEmpty().withMessage(VALIDATION_MESSAGES.EMAIL_INVALID)
    .isEmail().withMessage(VALIDATION_MESSAGES.EMAIL_INVALID)
    .custom(async value => {
      const exists = await checkEmailExists(value);
      if (exists) {
        return Promise.reject(VALIDATION_MESSAGES.EMAIL_IN_USE);
      }
    }),
  body('password')
    .notEmpty().withMessage(VALIDATION_MESSAGES.PASSWORD_REQUIRED)
    .isLength({ min: 6 }).withMessage(VALIDATION_MESSAGES.PASSWORD_LENGTH),
  body('repassword')
    .notEmpty().withMessage(VALIDATION_MESSAGES.PASSWORD_REQUIRED)
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error(VALIDATION_MESSAGES.PASSWORD_MISMATCH);
      }
      return true;
    }),
  body("firstName").notEmpty().withMessage(VALIDATION_MESSAGES.FIRST_NAME_REQUIRED),
  body("lastName").notEmpty().withMessage(VALIDATION_MESSAGES.LAST_NAME_REQUIRED),
  body("mobileNumber").notEmpty().withMessage(VALIDATION_MESSAGES.INVALID_MOBILE_NUMBER),
];

const validateErrors = async (req: Request, res: Response, next: NextFunction) => {
  const errors: any = validationResult(req);
  if (!errors.isEmpty()) {
    ResponseHandler.invalidRequest(req, res, errors);
  } else {
    next();
  }
};

export const validateRegisterInput = [
  ...registerUserCommonValidation,
  body('roleId')
    .notEmpty().withMessage(VALIDATION_MESSAGES.INVALID_ROLE)
    .custom(async value => {

      const validRoles = await checkRole(value);
     
      if (!validRoles) {
        throw new Error(VALIDATION_MESSAGES.INVALID_ROLE);
      }
      return true;
    }),
    validateErrors
];

export const validateUpdateUserInput = [
  param("userId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.STUDENT_ID_REQUIRED)
    .custom(async (userId) => {
      const userExist = await doesUserExist(userId);
      if (!userExist) {
        return Promise.reject(VALIDATION_MESSAGES.USER_NOT_FOUND);
      }
  }),
  body("username")
    .notEmpty().withMessage(VALIDATION_MESSAGES.USERNAME_INVALID)
    .custom(async (value, {req}) => {
      const userId = req.params.userId
      const exists = await checkUsernameExists(value, userId);
      if (exists) {
        return Promise.reject(VALIDATION_MESSAGES.USERNAME_IN_USE);
      }
    }),
  body("email")
    .notEmpty().withMessage(VALIDATION_MESSAGES.EMAIL_INVALID)
    .isEmail().withMessage(VALIDATION_MESSAGES.EMAIL_INVALID)
    .custom(async (value, {req}) => {
      const userId = req.params.userId
      const exists = await checkEmailExists(value, userId);
      if (exists) {
        return Promise.reject(VALIDATION_MESSAGES.EMAIL_IN_USE);
      }
    }),
  body("firstName").notEmpty().withMessage(VALIDATION_MESSAGES.FIRST_NAME_REQUIRED),
  body("lastName").notEmpty().withMessage(VALIDATION_MESSAGES.LAST_NAME_REQUIRED),
  body("mobileNumber").notEmpty().withMessage(VALIDATION_MESSAGES.INVALID_MOBILE_NUMBER),
  body('roleId')
    .notEmpty().withMessage(VALIDATION_MESSAGES.INVALID_ROLE)
    .custom(async value => {

      const validRoles = await checkRole(value);
     
      if (!validRoles) {
        throw new Error(VALIDATION_MESSAGES.INVALID_ROLE);
      }
      return true;
    }),
    validateErrors
];

export const validateStudentRegisterInput = [
  ...registerUserCommonValidation,
    validateErrors
];


// Case-insensitive match against AWARD_HONORS that returns the canonical
// (title-cased) value so it is stored consistently. Non-matches are returned
// unchanged so the following .isIn() check reports the error.
const normalizeAwardHonor = (value: any) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const match = AWARD_HONORS.find(award => award.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
};

const commonValidationMiddleware = [
  body('firstName').isString().withMessage(VALIDATION_MESSAGES.FIRST_NAME_REQUIRED),
  body('lastName').isString().withMessage(VALIDATION_MESSAGES.LAST_NAME_REQUIRED),
  body('mobileNumber')
    .trim()
    .notEmpty().withMessage(VALIDATION_MESSAGES.MOBILE_NUMBER_INVALID)
    .matches(/^09\d{9}$/).withMessage(VALIDATION_MESSAGES.MOBILE_NUMBER_INVALID),
  body('sex').optional({ nullable: true, checkFalsy: true }).isIn(['Male', 'Female', 'Other']).withMessage(VALIDATION_MESSAGES.SEX_INVALID),
  body('birthdate').optional({ nullable: true, checkFalsy: true }).isDate().withMessage(VALIDATION_MESSAGES.BIRTHDATE_INVALID),
  body('height').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage(VALIDATION_MESSAGES.HEIGHT_INVALID),
  body('weight').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage(VALIDATION_MESSAGES.WEIGHT_INVALID),
  body('permanentStreet').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.PERMANENT_ADDRESS_REQUIRED),

  // Current address fields
  body('currentStreet').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.CURRENT_ADDRESS_REQUIRED),

  // Emergency contact fields
  body('emergencyContactName').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.EMERGENCY_CONTACT_NAME_REQUIRED),
  body('emergencyContactNumber').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.EMERGENCY_CONTACT_NUMBER_INVALID),
  body('emergencyContactRelationship').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.EMERGENCY_CONTACT_RELATIONSHIP_INVALID),

  // G12 Information
  body('g12AcademicStrand')
    .optional({ nullable: true, checkFalsy: true })
    .customSanitizer(value => (typeof value === 'string' ? value.trim().toUpperCase() : value))
    .isIn(ACADEMIC_STRANDS).withMessage(VALIDATION_MESSAGES.G12_ACADEMIC_STRAND_INVALID),
  body('g12ProgramName').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.G12_PROGRAM_NAME_REQUIRED),
  // G12 school is a free-text value typed by the student, not a dropdown/FK. No existence check.
  body('g12SchoolName').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.G12_SCHOOL_NAME_INVALID),
  body('g12YearOfGraduation').optional({ nullable: true, checkFalsy: true }).isInt().withMessage(VALIDATION_MESSAGES.G12_YEAR_OF_GRADUATION_INVALID).toInt(),
  body('g12AwardHonor')
    .optional({ nullable: true, checkFalsy: true })
    .customSanitizer(normalizeAwardHonor)
    .isIn(AWARD_HONORS).withMessage(VALIDATION_MESSAGES.AWARD_HONOR_INVALID),

  // College Information
  body('collegeProgramName').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.COLLEGE_PROGRAM_NAME_REQUIRED),
  body('collegeYearLevel').optional({ nullable: true, checkFalsy: true }).isInt().withMessage(VALIDATION_MESSAGES.COLLEGE_YEAR_LEVEL_INVALID),
  body('collegeAwardHonor')
    .optional({ nullable: true, checkFalsy: true })
    .customSanitizer(normalizeAwardHonor)
    .isIn(AWARD_HONORS).withMessage(VALIDATION_MESSAGES.AWARD_HONOR_INVALID),

  // Father details
  body('fatherFirstName').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.FATHER_FIRST_NAME_REQUIRED),
  body('fatherLastName').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.FATHER_LAST_NAME_REQUIRED),
  body('fatherOccupation').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.FATHER_OCCUPATION_REQUIRED),
  body('fatherMobileNumber').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.FATHER_MOBILE_NUMBER_INVALID),

  // Mother details
  body('motherFirstName').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.MOTHER_FIRST_NAME_REQUIRED),
  body('motherLastName').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.MOTHER_LAST_NAME_REQUIRED),
  body('motherOccupation').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.MOTHER_OCCUPATION_REQUIRED),
  body('motherMobileNumber').optional({ nullable: true, checkFalsy: true }).notEmpty().withMessage(VALIDATION_MESSAGES.MOTHER_MOBILE_NUMBER_INVALID),

  // Guardian details
  body('guardianFirstName').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.GUARDIAN_FIRST_NAME_REQUIRED),
  body('guardianLastName').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.GUARDIAN_LAST_NAME_REQUIRED),
  body('guardianOccupation').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.GUARDIAN_OCCUPATION_REQUIRED),
  body('guardianMobileNumber').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.GUARDIAN_MOBILE_NUMBER_INVALID),

  // Siblings
  body('siblings').isArray().optional({ nullable: true, checkFalsy: true }).withMessage(VALIDATION_MESSAGES.SIBLINGS_REQUIRED),
  body('siblings.*.name').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.SIBLING_NAME_REQUIRED),
  body('siblings.*.birthdate').optional({ nullable: true, checkFalsy: true }).isDate().withMessage(VALIDATION_MESSAGES.SIBLING_BIRTHDATE_INVALID),
  body('siblings.*.age').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).withMessage(VALIDATION_MESSAGES.SIBLING_AGE_INVALID),
  body('siblings.*.status').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.SIBLING_STATUS_REQUIRED),
  body('siblings.*.livingWithParents').optional({ nullable: true, checkFalsy: true }).isBoolean().withMessage(VALIDATION_MESSAGES.SIBLING_LIVING_WITH_PARENTS_INVALID),
  body('siblings.*.ownHouse').optional({ nullable: true, checkFalsy: true }).isBoolean().withMessage(VALIDATION_MESSAGES.SIBLING_OWN_HOUSE_INVALID)
]


export const validateUpdateStudent = [
  param("studentId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.STUDENT_ID_REQUIRED)
    .custom(async (studentId) => {
      const studentExists = await doesStudentExist(studentId);
      if (!studentExists) {
        return Promise.reject(VALIDATION_MESSAGES.STUDENT_NOT_FOUND);
      }
  }),
  body("userId")
  .notEmpty().withMessage(VALIDATION_MESSAGES.USER_ID_REQUIRED)
  .custom(async (userId) => {
    console.log("params", userId);
    const studentExists = await doesUserExist(userId);
    if (!studentExists) {
      return Promise.reject(VALIDATION_MESSAGES.USER_NOT_FOUND);
    }
  })
  .custom(async (userId) => {
    const haveData = await getOneStudentUsingUserId( userId );
    if( haveData === null ) {
      return Promise.reject(VALIDATION_MESSAGES.USER_NO_STUDENT_INFO); 
    }
  }),
  body("email")
  .notEmpty().withMessage(VALIDATION_MESSAGES.EMAIL_INVALID)
  .isEmail().withMessage(VALIDATION_MESSAGES.EMAIL_INVALID)
    .custom(async (value, { req }) => {

      const studentId = req.params.studentId;
      const exists = await isEmailTakenByAnotherStudent(value, studentId);
      if (exists) {
        return Promise.reject(VALIDATION_MESSAGES.EMAIL_IN_USE);
      }
    }),
  body('permanentBrgId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage(VALIDATION_MESSAGES.PERMANENT_BRG_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkBarangayExist("", value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.PERMANENT_BRG_ID_NOT_FOUND);
      }
    }),
  body('permanentCitymunId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage(VALIDATION_MESSAGES.PERMANENT_CITYMUN_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkCityMunExist("", value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.PERMANENT_CITYMUN_ID_NOT_FOUND);
      }
    }),
  body('permanentProvinceId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage(VALIDATION_MESSAGES.PERMANENT_PROVINCE_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkProvinceExist("", value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.PERMANENT_PROVINCE_ID_NOT_FOUND);
      }
    }),
  body('permanentRegionId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage(VALIDATION_MESSAGES.PERMANENT_REGION_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkRegionExist("", value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.PERMANENT_REGION_ID_NOT_FOUND);
      }
    }),
  body('currentBrgId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage(VALIDATION_MESSAGES.CURRENT_BRG_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkBarangayExist("", value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.CURRENT_BRG_ID_NOT_FOUND);
      }
    }),
  body('currentCitymunId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage(VALIDATION_MESSAGES.CURRENT_CITYMUN_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkCityMunExist("", value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.CURRENT_CITYMUN_ID_NOT_FOUND);
      }
    }),
  body('currentProvinceId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage(VALIDATION_MESSAGES.CURRENT_PROVINCE_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkProvinceExist("", value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.CURRENT_PROVINCE_ID_NOT_FOUND);
      }
    }),
  body('currentRegionId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage(VALIDATION_MESSAGES.CURRENT_REGION_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkRegionExist("", value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.CURRENT_REGION_ID_NOT_FOUND);
      }
    }),
  body('collegeSchoolId').optional({ nullable: true, checkFalsy: true }).isString().withMessage(VALIDATION_MESSAGES.COLLEGE_SCHOOL_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkSchoolExist(value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.COLLEGE_SCHOOL_ID_NOT_FOUND);
      }
    }),
  body('gwa').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 1, max: 5 }).withMessage(VALIDATION_MESSAGES.GWA_INVALID)
    .custom(value => {
        if (value < 1 || value > 5) {
            throw new Error(VALIDATION_MESSAGES.GWA_OUT_OF_BOUNDS);
        }
        return true;
    }),
  ...commonValidationMiddleware,
  validateErrors
];

export const validateStudentRegistration = [
  body("email")
  .notEmpty().withMessage(VALIDATION_MESSAGES.EMAIL_INVALID)
  .isEmail().withMessage(VALIDATION_MESSAGES.EMAIL_INVALID)
  .custom(async value => {
    const exists = await checkEmailExists(value);
    if (exists) {
      return Promise.reject(VALIDATION_MESSAGES.EMAIL_IN_USE);
    }
  }),
  ...commonValidationMiddleware,
  validateErrors
];

export const validateRegionCode = [
  query("regCode")
    .notEmpty()
    .withMessage(VALIDATION_MESSAGES.MISSING_REGION)
    .isString()
    .withMessage(VALIDATION_MESSAGES.INVALID_REGION)
    .custom(async value => {
      const exists = await checkRegionExist(value);
      if (exists) {
        return Promise.reject(VALIDATION_MESSAGES.NOT_FOUND_REGION);
      }
    }),
  validateErrors
];

export const validateProvinceCode = [
  query("provinceCode")
    .notEmpty()
    .withMessage(VALIDATION_MESSAGES.MISSING_PROVINCE)
    .isString()
    .withMessage(VALIDATION_MESSAGES.INVALID_PROVINCE)
    .custom(async value => {
      const exists = await checkProvinceExist(value);
      if (exists) {
        return Promise.reject(VALIDATION_MESSAGES.NOT_FOUND_PROVINCE);
      }
    }),
  validateErrors
];

export const validateCityMunCode = [
  query("citymunCode")
    .notEmpty()
    .withMessage(VALIDATION_MESSAGES.MISSING_CITYMUN)
    .isString()
    .withMessage(VALIDATION_MESSAGES.INVALID_CITYMUN)
    .custom(async value => {
      const exists = await checkCityMunExist(value);
      if (exists) {
        return Promise.reject(VALIDATION_MESSAGES.NOT_FOUND_CITYMUN);
      }
    }),
  validateErrors
];

export const validateGetOneStudent = [
  param("userId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.STUDENT_ID_REQUIRED)
    .custom(async (userId) => {
      console.log("params", userId);
      const studentExists = await doesUserExist(userId);
      if (!studentExists) {
        return Promise.reject(VALIDATION_MESSAGES.USER_NOT_FOUND);
      }
    })
    .custom(async (userId) => {
      const haveData = await getOneStudent( userId );
      if( haveData === null ) {
        return Promise.reject(VALIDATION_MESSAGES.USER_NO_STUDENT_INFO); 
      }
    }),
  validateErrors
];

export const validateUserId = [
  param("userId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.STUDENT_ID_REQUIRED)
    .custom(async (userId) => {
      console.log("params", userId);
      const userExist = await doesUserExist(userId);
      if (!userExist) {
        return Promise.reject(VALIDATION_MESSAGES.USER_NOT_FOUND);
      }
  }),
  validateErrors
];

export const validateSchoolId = [
  param("schoolId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.SCHOOL_ID_REQUIRED)
    .custom(async (schoolId) => {
      console.log("params", schoolId);
      const dontExist = await checkSchoolExist(schoolId);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.SCHOOL_ID_NOT_FOUND);
      }
  }),
  validateErrors
];

export const validatePassword = [
  body('password')
    .notEmpty().withMessage(VALIDATION_MESSAGES.PASSWORD_REQUIRED)
    .isLength({ min: 6 }).withMessage(VALIDATION_MESSAGES.PASSWORD_LENGTH),
  body('repassword')
    .notEmpty().withMessage(VALIDATION_MESSAGES.PASSWORD_REQUIRED)
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error(VALIDATION_MESSAGES.PASSWORD_MISMATCH);
      }
      return true;
    }),
  validateErrors
]

export const validateSchool = [
  body("name")
    .notEmpty().withMessage(VALIDATION_MESSAGES.SCHOOL_NAME_INVALID)
    .custom(async ( value, {req} ) => {
      const schoolId  = req.params.schoolId || null;
      const dontExist = await checkSchoolNameExist( value, schoolId );
      if (!dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.SCHOOL_NAME_ALREADY_EXIST);
      }
    }),
  body('schoolType')
    .isString()
    .trim()
    .toLowerCase()
    .isIn(['private', 'public'])
    .withMessage(VALIDATION_MESSAGES.SCHOOL_TYPE_INVALID),
  body('brgyId').isInt().withMessage(VALIDATION_MESSAGES.PERMANENT_BRG_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkBarangayExist("", value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.BRG_ID_NOT_FOUND);
      }
    }),
  body('cityMunId').isInt().withMessage(VALIDATION_MESSAGES.CITYMUN_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkCityMunExist("", value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.CITYMUN_ID_NOT_FOUND);
      }
    }),
  body('provinceId').isInt().withMessage(VALIDATION_MESSAGES.PROVINCE_ID_INVALID)
    .custom(async ( value ) => {

      const dontExist = await checkProvinceExist("", value);
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.PROVINCE_ID_NOT_FOUND);
      }
    }),
  validateErrors
]

export const validateAcademicYear = [
  body("academicYearStart").isInt().withMessage(VALIDATION_MESSAGES.ACADEMIC_YEAR_START_REQUIRED),
  body("academicYearEnd").isInt().withMessage(VALIDATION_MESSAGES.ACADEMIC_YEAR_END_REQUIRED),
  body("schoolTerm").isInt().withMessage(VALIDATION_MESSAGES.ACADEMIC_YEAR_TERM_REQUIRED)
    .custom(async (value, { req }) => {
      const { academicYearStart, academicYearEnd } = req.body;
      const academicYearId  = req.params.academicYearId || null;
      const existingAcademicYear = await checkExistingAcademicYear( academicYearStart, academicYearEnd, value, academicYearId );

      if (existingAcademicYear) {
        throw new Error(VALIDATION_MESSAGES.ACADEMIC_YEAR_ALREADY_EXISTS);
      }
    }),
  body("dateFrom").isISO8601().withMessage(VALIDATION_MESSAGES.ACADEMIC_YEAR_DATE_FROM_REQUIRED),
  body("dateTo").isISO8601().withMessage(VALIDATION_MESSAGES.ACADEMIC_YEAR_DATE_TO_REQUIRED),
  validateErrors
];

export const validateAcademicYearId = [
  param("academicYearId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.ACADEMIC_YEAR_ID_REQUIRED)
    .custom(async ( academicYearId ) => {
      console.log("params", academicYearId);
      const dontExist = await checkAcademicYearId( academicYearId );
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.ACADEMIC_YEAR_ID_NOT_FOUND);
      }
  }),
  validateErrors
];

export const validateSponsorshipId = [
  param("sponsorshipId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.SPONSORSHIP_ID_REQUIRED)
    .custom(async ( sponsorshipId ) => {
      console.log("params", sponsorshipId);
      const dontExist = await checkSponsorshipId( sponsorshipId );
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.SPONSORSHIP_ID_NOT_FOUND);
      }
  }),
  validateErrors
];

export const validateStudentId = [
  param("studentId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.STUDENT_ID_REQUIRED)
    .custom(async (studentId) => {
      const studentExists = await doesStudentExist(studentId);
      if (!studentExists) {
        return Promise.reject(VALIDATION_MESSAGES.STUDENT_NOT_FOUND);
      }
  }),
  validateErrors
]

export const validateChangeStudentStatus = [
  // remarks is required only for negative / needs-action statuses
  // (REJECTED, FOLLOW_UP, NOT_QUALIFIED); accepted/positive statuses do not need one.
  body("remarks")
    .if((value, { req }) => STATUSES_REQUIRING_REMARKS.includes(req.body.appStatus))
    .notEmpty().withMessage(VALIDATION_MESSAGES.REMARKS_REQUIRED),
  // check if sponsorship is on the system
  body("sponsorshipId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.SPONSORSHIP_ID_REQUIRED)
    .custom(async ( sponsorshipId, { req } ) => {
      const { studentId } = req.params;
      const dontExist = await checkSponsorshipId( sponsorshipId );
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.SPONSORSHIP_ID_NOT_FOUND);
      }

      // check if student is on that sponsorship
      const studentAlreadyApplied = await doesStudentAlreadyApplied( studentId, sponsorshipId );
      if(!studentAlreadyApplied) {
        return Promise.reject(VALIDATION_MESSAGES.STUDENT_NOT_APPLIED);
      }
    }),
  body("appStage") 
    .notEmpty().withMessage(VALIDATION_MESSAGES.APP_STAGE_REQUIRED)
    .custom( async data => {
        // check if appStage is in the ENUM
        const validStages = Object.values(APPLICATION_STAGE);
        if (!validStages.includes(data)) {
          return Promise.reject(VALIDATION_MESSAGES.APP_STAGE_INVALID);
        } 
    }),
  body("appStatus")
    .notEmpty().withMessage(VALIDATION_MESSAGES.APP_STATUS_REQUIRED)
    .custom( async (data, {req} ) => {
      // chceck if appStatus is in the ENUM
      const validStatus = Object.values(APPLICATION_STATUS);
      const appStage = req.body.appStage;
      if (!validStatus.includes(data)) {
        return Promise.reject(VALIDATION_MESSAGES.APP_STATUS_INVALID + " " + validStatus.join(', '));
      }
      // check if appStatus belongs to the appStage
      const validStatusesForStage = stageStatusMap[appStage];
      console.log(validStatusesForStage, data, appStage);
      if (!validStatusesForStage.includes(data)) { 
        return Promise.reject(VALIDATION_MESSAGES.INVALID_STATUS_FOR_STAGE + " " + appStage + " Allowed statuses: " + validStatusesForStage.join(', ') )
      }
    }),
  body("interviewStatus")
    .optional({ nullable: true, checkFalsy: true })
    .custom( async (data, {req}) => {

      const appStage = req.body.appStage;

      const validStatus = Object.values(EvaluationStatus);
      if (!validStatus.includes(data)) {
        return Promise.reject(VALIDATION_MESSAGES.INTERVIEW_STATUS_INVALID + " " + validStatus.join(', '));
      }

      if( appStage != APPLICATION_STAGE.APPLICATION_LIST) {
        return Promise.reject(VALIDATION_MESSAGES.FORBIDDEN_INTERVIEW_EXAM_CHANGES)
      }
    }),
  body("examStatus")
    .optional({ nullable: true, checkFalsy: true })
    .custom( async (data, {req}) => {

      const appStage = req.body.appStage;

      const validStatus = Object.values(EvaluationStatus);
      if (!validStatus.includes(data)) {
        return Promise.reject(VALIDATION_MESSAGES.EXAM_STATUS_INVALID + " " + validStatus.join(', '));
      }

      if( appStage !== APPLICATION_STAGE.APPLICATION_LIST) {
        return Promise.reject(VALIDATION_MESSAGES.FORBIDDEN_INTERVIEW_EXAM_CHANGES)
      }
    }),

  validateErrors
]

export const validateApplyScholarship = [
  body("studentId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.STUDENT_ID_REQUIRED)
    .custom(async (studentId) => {
      const studentExists = await doesStudentExist(studentId);
      if (!studentExists) {
        return Promise.reject(VALIDATION_MESSAGES.STUDENT_NOT_FOUND);
      }
  }),
  body("sponsorshipId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.SPONSORSHIP_ID_REQUIRED)
    .custom(async ( academicYearId ) => {
      console.log("params", academicYearId);
      const dontExist = await checkSponsorshipId( academicYearId );
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.SPONSORSHIP_ID_NOT_FOUND);
      }
  }),
  body("studentId")
    .custom(async (studentId, { req }) => {

      const { sponsorshipId } = req.body;
      const studentAlreadyApplied = await doesStudentAlreadyApplied( studentId, sponsorshipId );
      if (studentAlreadyApplied) {
        return Promise.reject(VALIDATION_MESSAGES.STUDENT_ALREADY_APPLIED);
      }
  }),
  validateErrors
]

export const validateSponsorship =  [
  body("batchNumber").isInt().withMessage(VALIDATION_MESSAGES.SPONSORSHIP_BATCH_NUMBER_REQUIRED),
  body("durationFrom").isISO8601().withMessage(VALIDATION_MESSAGES.SPONSORSHIP_DURATION_FROM_REQUIRED),
  body("limit").isInt({min: 1}).withMessage(VALIDATION_MESSAGES.SPONSORSHIP_LIMIT_REQUIRED),
  body("slot").isInt({min: 1}).withMessage(VALIDATION_MESSAGES.SPONSORSHIP_SLOT_REQUIRED),
  body("fundAllocation").isFloat({ min: 0.01 }).withMessage(VALIDATION_MESSAGES.SPONSORSHIP_FUND_ALLOCATION_INVALID),
  body("allowancePerStudent").isFloat({ min: 0.01 }).withMessage(VALIDATION_MESSAGES.SPONSORSHIP_ALLOWANCE_PER_STUDENT_INVALID),
  body('name').isString().withMessage(VALIDATION_MESSAGES.SPONSORSHIP_NAME_REQUIRED)
    .custom( async (value, {req}) => {
      const batchNumber: number = req.body.batchNumber;
      const sponsorshipId  = req.params.sponsorshipId || null;
      const alreadyExist = await checkIfSponsorshipExist( value, batchNumber, sponsorshipId );

      if(alreadyExist) {
        throw new Error(VALIDATION_MESSAGES.SPONSORSHIP_NAME_INVALID);
      }
    }),
  body('sponsorId').isString().withMessage(VALIDATION_MESSAGES.SPONSORSHIP_SPONSOR_ID_REQUIRED)
    .custom( async (value) => {
      const notSponsor:boolean = await checkIfNotSponsor( value );
      if(notSponsor) {
        throw new Error(VALIDATION_MESSAGES.SPONSORSHIP_SPONSOR_ID_INVALID);
      }

    }),
  body('academicYearId').isString().withMessage(VALIDATION_MESSAGES.SPONSORSHIP_ACADEMIC_YEAR_ID_REQUIRED)
    .custom( async (value) => {
      const notAcademicYear = await checkAcademicYearId( value );

        if(notAcademicYear) {
          throw new Error(VALIDATION_MESSAGES.SPONSORSHIP_ACADEMIC_YEAR_ID_INVALID);
        }

    }),
  body("durationTo").isISO8601().withMessage(VALIDATION_MESSAGES.SPONSORSHIP_DURATION_TO_REQUIRED)
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.durationFrom)) {
        throw new Error(VALIDATION_MESSAGES.SPONSORSHIP_DURATION_INVALID);
      }
      return true;
    }),
  // An empty or omitted list means the sponsorship applies to ALL schools.
  body("sponsorshipSchool")
    .optional({ nullable: true })
    .isArray()
    .withMessage(VALIDATION_MESSAGES.SPONSORSHIP_SCHOOL_INVALID)
    .custom( async (value) => {
      if (value.length === 0) {
        return true; // all schools
      }

      if (!value.every((item) => typeof item === "string" && item.trim() !== "")) {
        throw new Error(VALIDATION_MESSAGES.SPONSORSHIP_SCHOOL_INVALID);
      }

      const invalidSchoolId: boolean = await checkIfInvalidSchoolId( value );
      if (invalidSchoolId) {
        console.log("Invalid school here");
        throw new Error(VALIDATION_MESSAGES.SPONSORSHIP_SCHOOL_INVALID);
      }
    }),

  body("sponsorshipRequirements")
    .isArray({ min: 1 })
    .withMessage(VALIDATION_MESSAGES.SPONSORSHIP_REQUIREMENTS_REQUIRED)
    .custom( async (value) => {
      if (!value.every((item) => typeof item === "string" && item.trim() !== "")) {
        throw new Error(VALIDATION_MESSAGES.SPONSORSHIP_REQUIREMENTS_INVALID);
      }

      const invalidFileTypeId: boolean = await checkIfInvalidFileTypeId( value ); 
      if (invalidFileTypeId) {
        throw new Error(VALIDATION_MESSAGES.SPONSORSHIP_REQUIREMENTS_INVALID);
      }
    }),
  validateErrors
]

export const validateQueryParams = [

  query('offset')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
    .toInt()
    .default(0),

  query('limit')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a positive integer between 1 and 100')
    .toInt()
    .default(50),

  query('search')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('Search must be a string')
    .trim()
    .escape()
    .default(''),

  query('sort')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[a-zA-Z0-9_]+:(asc|desc)$/)
    .withMessage('Sort format must be asc|desc')
    .default('desc'),

  query('status')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['active', 'full'])
    .withMessage(VALIDATION_MESSAGES.SPONSORSHIP_FILTER_STATUS_INVALID),

  query('academic_year_id')
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage(VALIDATION_MESSAGES.SPONSORSHIP_FILTER_ACADEMIC_YEAR_ID_INVALID),

  query('sponsor_id')
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage(VALIDATION_MESSAGES.SPONSORSHIP_FILTER_SPONSOR_ID_INVALID),

  query('duration_from')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage(VALIDATION_MESSAGES.SPONSORSHIP_FILTER_DURATION_FROM_INVALID),

  query('duration_to')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage(VALIDATION_MESSAGES.SPONSORSHIP_FILTER_DURATION_TO_INVALID),

  validateErrors
];


export const validatedAppStageParams = [

  query('applicationStage')
    .notEmpty()
    .withMessage(VALIDATION_MESSAGES.APP_STAGE_PARAM_REQUIRED)
    .custom( async data => {
      // check if appStage is in the ENUM
      const validStages = Object.values(APPLICATION_STAGE);
      if (!validStages.includes(data)) {
        return Promise.reject(VALIDATION_MESSAGES.APP_STAGE_PARAM_INVALID);
      } 
    }),
  validateErrors
]

export const createAnnouncementValidation = [
  body("title")
    .customSanitizer(value => String(value)) // Ensure it's a string
    .trim()
    .isString().withMessage(VALIDATION_MESSAGES.ANN_TITLE_INVALID)
    .notEmpty().withMessage(VALIDATION_MESSAGES.ANN_TITLE_REQUIRED),
  body("content")
    .customSanitizer(value => String(value)) // Ensure it's a string
    .trim()
    .isString().withMessage(VALIDATION_MESSAGES.ANN_CONTENT_INVALID)
    .notEmpty().withMessage(VALIDATION_MESSAGES.ANN_CONTENT_REQUIRED),
  body("caption")
    .customSanitizer(value => String(value)) // Ensure it's a string
    .trim()
    .isString().withMessage(VALIDATION_MESSAGES.ANN_CAPTION_INVALID)
    .notEmpty().withMessage(VALIDATION_MESSAGES.ANN_CAPTION_REQUIRED),
  body("targetMunicipalitys")
    .customSanitizer((value) => {
      if (typeof value === "string" || typeof value === "undefined") {
        try {
          return JSON.parse(value);
        } catch {
          throw new Error(VALIDATION_MESSAGES.ANN_MUN_INVALID_FORMAT);
        }
      }
      return value.map((num: any) => Number(num));
    })
    .trim()
    .isArray({ min: 1 }).withMessage(VALIDATION_MESSAGES.ANN_MUN_EMPTY)
    .custom((values) => values.every((v: number) => typeof Number(v) === "number"))
    .withMessage(VALIDATION_MESSAGES.ANN_MUN_INVALID_ITEMS)
    .custom(async (values: number[]) => {
      const results = await Promise.all(
        values.map(async (value) => {
          const doesNotExist = await checkCityMunExist("", Number(value));
          return doesNotExist ? Promise.reject(VALIDATION_MESSAGES.ANN_CITYMUN_ID_NOT_FOUND) : true;
        })
      );
      return results;
    }),
  body("sponsorshipId")
    .optional({ nullable: true, checkFalsy: true })
    .customSanitizer(value => String(value)) // Ensure it's a string
    .trim()
    .isUUID().withMessage(VALIDATION_MESSAGES.ANN_SPON_INVALID_ID)
    .custom( async ( sponsorshipId ) => {
      const dontExist = await checkSponsorshipId( sponsorshipId );
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.SPONSORSHIP_ID_NOT_FOUND);
      }
    }),
  validateErrors
]

export const checkIfAnnIdExist = [
  param("annId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.ANN_ID_REQUIRED)
    .custom(async (annId, {req}) => {
      const authHeader: string = req.headers.authorization;
      const userDetails: AuthPayload = extractUserFromToken(authHeader);
      const userRole: string = await getUserRole(userDetails.userId);
      let isAdmin = false;

      if(userRole.toLowerCase() === 'system admin' ) {
        isAdmin = true;
      }

      const annExist = await doesAnnExist(annId, userDetails.userId, isAdmin);
      if (!annExist) {
        return Promise.reject(VALIDATION_MESSAGES.ANN_NOT_FOUND);
      }
  }),
  validateErrors
]

export const checkIfAnnIdExistForGet = [
  param("annId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.ANN_ID_REQUIRED)
    .custom(async (annId, {req}) => {
      
      const annExist = await doesAnnExistGet( annId );
      if (!annExist) {
        return Promise.reject(VALIDATION_MESSAGES.ANN_NOT_FOUND);
      }
  }),
  validateErrors
]

export const validateSchedulePayload = [
  body("sponsorshipId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.SPONSORSHIP_ID_REQUIRED)
    .custom(async ( sponsorshipId, { req } ) => {
      const { studentId } = req.params;
      const dontExist = await checkSponsorshipId( sponsorshipId );
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.SPONSORSHIP_ID_NOT_FOUND);
      }
    }),
  body("batchNo")
    .notEmpty().withMessage(VALIDATION_MESSAGES.BATCH_NO_REQUIRED)
    .custom( async ( batchNo, { req } ) => {
      const sponsorshipId = req.body.sponsorshipId;
      const batchExist = await checkBatch( batchNo, sponsorshipId );

      if(!batchExist) {
        return Promise.reject(VALIDATION_MESSAGES.BATCH_NO_NOT_EXIST);
      }
    }),
  body('scheduleType')
    .notEmpty().withMessage(VALIDATION_MESSAGES.SCHEDULE_TYPE_REQUIRED)
    .isIn(['TEST', 'INTERVIEW']).withMessage(VALIDATION_MESSAGES.SCHEDULE_TYPE_INVALID),
  body('batchCode')
    .notEmpty().withMessage(VALIDATION_MESSAGES.BATCH_CODE_REQUIRED)
    .isString().withMessage(VALIDATION_MESSAGES.BATCH_CODE_REQUIRED),
  body('examinationType')
    .notEmpty().withMessage(VALIDATION_MESSAGES.EXAMINATION_TYPE_REQUIRED)
    .isIn(['ONSITE', 'ONLINE']).withMessage(VALIDATION_MESSAGES.EXAMINATION_TYPE_INVALID),
  body('proctorInterviewer')
    .notEmpty().withMessage(VALIDATION_MESSAGES.PROCTOR_INTERVIEWER_REQUIRED)
    .isString().withMessage(VALIDATION_MESSAGES.PROCTOR_INTERVIEWER_REQUIRED),
  body('location')
    .notEmpty().withMessage(VALIDATION_MESSAGES.LOCATION_REQUIRED),
  body('scheduleQuota')
    .notEmpty().withMessage(VALIDATION_MESSAGES.SCHEDULE_QUOTA_REQUIRED)
    .isInt({ min: 1 }).withMessage(VALIDATION_MESSAGES.SCHEDULE_QUOTA_INVALID),
  body('startDate')
    .notEmpty().withMessage(VALIDATION_MESSAGES.START_DATE_REQUIRED)
    .isISO8601().withMessage(VALIDATION_MESSAGES.START_DATE_INVALID),
  body('endDate')
    .notEmpty().withMessage(VALIDATION_MESSAGES.END_DATE_REQUIRED)
    .isISO8601().withMessage(VALIDATION_MESSAGES.END_DATE_INVALID)
    .custom((value, { req }) => {
      const start = new Date(req.body.startDate);
      const end = new Date(value);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return Promise.reject(VALIDATION_MESSAGES.END_DATE_INVALID_FORMAT);
      }
      if (end <= start) {
        return Promise.reject(VALIDATION_MESSAGES.END_DATE_BEFORE_START_DATE);
      }
      return true;
    }),
  validateErrors
]

export const validateScheduleId = [
  param("scheduleId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.SCHED_ID_REQUIRED)
    .custom(async ( scheduleId ) => {
      
      const schedExist = await findIfExists( scheduleId );
      if (!schedExist) {
        return Promise.reject(VALIDATION_MESSAGES.SCHED_NOT_FOUND);
      }
  }),
  validateErrors
]

export const validateUpdateCriterionPayload = [
  body("criterionCategoryId")
    .customSanitizer(value => String(value))
    .trim()
    .isUUID().withMessage(VALIDATION_MESSAGES.CRIT_CAT_INVALID_ID)
    .custom( async ( criterionCategoryId ) => {
      const dontExist = await checkCriterionCategoryId( criterionCategoryId );
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.CRIT_CAT_NOT_FOUND);
      }
    }),
  body('criteria')
    .isArray({ min: 1 })
    .withMessage(VALIDATION_MESSAGES.CRITERIA_ARRAY_EMPTY),
  body('criteria').custom((criteria) => {
      const names = criteria.map((c: any) => c.name);
      const nameSet = new Set(names);
  
      if (nameSet.size !== names.length) {
        return Promise.reject(VALIDATION_MESSAGES.CRITERION_DUPLICATE)
      }
  
      return true;
    }),
  body('criteria')
    .custom((criteria) => {
      if (!Array.isArray(criteria)) {
        return Promise.reject(VALIDATION_MESSAGES.CRITERIA_ARRAY_INVALID);
      }
  
      for (let i = 0; i < criteria.length; i++) {
        const c = criteria[i];

        if (typeof c.label !== 'string' || c.label.trim() === '') {
          return Promise.reject(VALIDATION_MESSAGES.CRITERIA_LABEL_INVALID);
        }

        if (typeof c.name !== 'string' || c.name.trim() === '') {
          return Promise.reject(VALIDATION_MESSAGES.CRITERIA_NAME_INVALID);
        }
        console.log("Validated criteria name");
  
  
        if (!['COLUMN', 'CUSTOM_INPUT', 'COMPUTED'].includes(c.dataSource)) {
          return Promise.reject(VALIDATION_MESSAGES.CRITERIA_DATASOURCE_INVALID);
        }
        console.log("Validated criteria data source");
        
        if (c.dataSource === 'COMPUTED') {
          if (!['SUM', 'AVG'].includes(c.formulaType)) {
            return Promise.reject(VALIDATION_MESSAGES.CRITERIA_FORMULATYPE_INVALID);
          }
          console.log("Validated criteria formulat ype");
        }
  
        if (!['MIN', 'MAX'].includes(c.preference)) {
          return Promise.reject(VALIDATION_MESSAGES.CRITERIA_PREFERENCE_INVALID);
          console.log("Validated criteria preference");
        }

        if(['COMPUTED', 'COLUMN'].includes(c.dataSource)) { 
          if (!Array.isArray(c.requiredColumns) || c.requiredColumns.length === 0) {
            return Promise.reject(VALIDATION_MESSAGES.CRITERIA_REQUIREDCOLUMN_INVALID);
          }
          console.log("Validated criteria required columns  1");

          for (const rc of c.requiredColumns) {
            if (!rc.table || typeof rc.table !== 'string') {
              return Promise.reject(VALIDATION_MESSAGES.CRITERIA_REQUIREDCOLUMN_TABLE_INVALID)
            }
            console.log("Validated criteria required columns table");
    
            if (!rc.column || typeof rc.column !== 'string') {
              return Promise.reject(VALIDATION_MESSAGES.CRITERIA_REQUIREDCOLUMN_COLUMN_INVALID)
            }
            console.log("Validated criteria required column column");

            const tableEnumValues = Object.values(TableEnum);
            if (!tableEnumValues.includes(rc.table)) {
              return Promise.reject(VALIDATION_MESSAGES.CRITERIA_REQUIREDCOLUMN_TABLE_INVALID);
            }
            console.log("Validated criteria column and table");

            const validColumns = TableColumnMap[rc.table as TableEnum];
            if (!validColumns) {
              return Promise.reject(VALIDATION_MESSAGES.CRITERIA_REQUIREDCOLUMN_TABLE_INVALID);
            }
            console.log("Validated criteria column and table")
          
            if (!validColumns.includes(rc.column as ColumnEnum)) {
              return Promise.reject(VALIDATION_MESSAGES.CRITERIA_REQUIREDCOLUMN_COLUMN_INVALID);
            }
            console.log("Validated criteria column and table")
          };
        }
      };

      return true;
    }),
  body('pairwise')
    .isArray({ min: 1})
    .withMessage(VALIDATION_MESSAGES.PAIRWISE_ARRAY_EMPTY)
    .custom((pairwise, {req}) => {
      // get all the criteria name
      const criteriaNames = (req.body.criteria || []).map((c: any) => c.name);

      // loop through pairise and check if criteriaNameA and B exist on the criteria name
      for (const pair of pairwise) { 
        if (
          !pair.criteriaNameA ||
          !criteriaNames.includes(pair.criteriaNameA)
        ) {
          return Promise.reject(VALIDATION_MESSAGES.PAIRWISE_CRITERIA_A_INVALID);
        }

        if (
          !pair.criteriaNameB ||
          !criteriaNames.includes(pair.criteriaNameB)
        ) {
          return Promise.reject(VALIDATION_MESSAGES.PAIRWISE_CRITERIA_B_INVALID);
        }

        if (
          typeof pair.value !== 'number' ||
          !Number.isInteger(pair.value) ||
          pair.value < 1 ||
          pair.value > 9
        ) {
          return Promise.reject(VALIDATION_MESSAGES.PAIRWISE_VALUE_INVALID);
        }
      }
      return true;
    }),
  validateErrors
]

export const validateBulkCustomInputPayload = [
  body()
    .isArray({ min: 1 })
    .withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_ARRAY_INVALID),
  body('*.sponsorshipCriterionId')
    .isUUID().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_SPON_CRIT_ID_INVALID)
    .bail()
    .custom( async (criterionId) => {
      const dontExist = await checkSponsorshipCriterionCategoryId( criterionId );
      if(dontExist) return Promise.reject(VALIDATION_MESSAGES.CUSTOM_INPUT_SPON_CRIT_ID_NOT_FOUND);
    }),
  body('*.sponsorshipId')
    .isUUID().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_SPON_ID_INVALID)
    .bail()
    .custom(async (sponsorshipId) => {
      const dontExist = await checkSponsorshipId( sponsorshipId );
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.SPONSORSHIP_ID_NOT_FOUND);
      }
    }),
  body('*.studentId')
    .isUUID().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_STUD_ID_INVALID)
    .bail()
    .custom(async (studentId) => {
      const studentExists = await doesStudentExist(studentId);
      if (!studentExists) {
        return Promise.reject(VALIDATION_MESSAGES.STUDENT_NOT_FOUND);
      }
    }),
  body('*.value')
    .isNumeric().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_VALUE_INVALID)
    .notEmpty().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_VALUE_EMPTY),
  validateErrors
];

export const validateCustomInputPayload = [
  body('sponsorshipCriterionId')
    .isUUID().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_SPON_CRIT_ID_INVALID)
    .custom( async (criterionId) => {
      const dontExist = await checkSponsorshipCriterionCategoryId( criterionId );
      if(dontExist) return Promise.reject(VALIDATION_MESSAGES.CUSTOM_INPUT_SPON_CRIT_ID_NOT_FOUND);
    }),
  body('sponsorshipId')
    .isUUID().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_SPON_ID_INVALID)
    .custom(async (sponsorshipId) => {
      const dontExist = await checkSponsorshipId( sponsorshipId );
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.SPONSORSHIP_ID_NOT_FOUND);
      }
    }),
  body('studentId')
    .isUUID().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_STUD_ID_INVALID)
    .custom(async (studentId) => {
      const studentExists = await doesStudentExist(studentId);
      if (!studentExists) {
        return Promise.reject(VALIDATION_MESSAGES.STUDENT_NOT_FOUND);
      }
    }),
  body('value')
    .isNumeric().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_VALUE_INVALID)
    .notEmpty().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_VALUE_EMPTY),
  validateErrors
];

export const validateGetAllCustomInput = [
  query('sponsorshipCriterionId')
    .optional({ nullable: true, checkFalsy: true })
    .isUUID().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_SPON_CRIT_ID_INVALID)
    .custom( async (criterionId) => {
      const dontExist = await checkSponsorshipCriterionCategoryId( criterionId );
      if(dontExist) return Promise.reject(VALIDATION_MESSAGES.CUSTOM_INPUT_SPON_CRIT_ID_NOT_FOUND);
    }),
  query('sponsorshipId')
    .optional({ nullable: true, checkFalsy: true })
    .isUUID().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_SPON_ID_INVALID)
    .custom(async (sponsorshipId) => {
      const dontExist = await checkSponsorshipId( sponsorshipId );
      if (dontExist) {
        return Promise.reject(VALIDATION_MESSAGES.SPONSORSHIP_ID_NOT_FOUND);
      }
    }),
  query('studentId')
    .optional({ nullable: true, checkFalsy: true })
    .isUUID().withMessage(VALIDATION_MESSAGES.CUSTOM_INPUT_STUD_ID_INVALID)
    .custom(async (studentId) => {
      const studentExists = await doesStudentExist(studentId);
      if (!studentExists) {
        return Promise.reject(VALIDATION_MESSAGES.STUDENT_NOT_FOUND);
      }
    }),
  validateErrors
];

export const validateFileId = [
  param("fileId")
    .notEmpty().withMessage(VALIDATION_MESSAGES.FILE_ID_REQUIRED)
    .custom(async (fileId) => {
      const fileExists = await doesFileExist(fileId);
      if (!fileExists) {
        return Promise.reject(VALIDATION_MESSAGES.FILE_ID_NOT_FOUND);
      }
  }),
  validateErrors
]