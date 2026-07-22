import { NextFunction, Request, Response } from "express";
import ResponseHandler from "../response/response";
import { AuthPayload, ERROR_MESSAGES, extractUserFromToken } from "../utils";
import jwt from 'jsonwebtoken';
import { getPermission, isAdmin } from "../user/service";
import { checkStudent } from "../student/service";
import { getUserRole } from "../authentication/service";

export async function authentication(req: Request, res: Response, next:NextFunction ) {

   const token = await auth(req, res);

    if(token !== null) {
        console.log('General authentication passed, proceeding to next middleware')
        next()
    } else {
        ResponseHandler.forbidden(req, res, ERROR_MESSAGES.INVALID_TOKEN );
    }
}

export const allowRoles = (...allowedRoles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {

        const authHeader: string = req.headers.authorization;
        const userDetails: AuthPayload = extractUserFromToken(authHeader);

        // A validly-signed token can still omit/mangle the userId claim. Guard here so a
        // missing/invalid userId is treated as unauthorized (403) instead of throwing
        // downstream in uuidToBinary and surfacing as a 500. See scripts/stress-500.ts.
        if (!userDetails?.userId || typeof userDetails.userId !== 'string') {
            ResponseHandler.forbidden(req, res, ERROR_MESSAGES.UNAUTHORIZED);
            return;
        }

        const userRole: string = await getUserRole(userDetails.userId);

        if (userRole === null) {
            ResponseHandler.forbidden(req, res, ERROR_MESSAGES.UNAUTHORIZED);
        } else if (!allowedRoles.includes(userRole)) {
            ResponseHandler.forbidden(req, res, ERROR_MESSAGES.UNAUTHORIZED);
        } else {
            console.log("User is Allowed to access the API");
            next();
        }
      } catch (error) {
        console.error("Error in allowRoles middleware:", error);
        ResponseHandler.internalServerError(req, res, ERROR_MESSAGES.SERVER_ERROR);
      }
    };
};
  




async function auth(req: Request, res: Response ) {

    try {
        const authHeader = req.headers.authorization; 
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.SECRET_KEY);

        const decoded = jwt.verify(token, process.env.SECRET_KEY!) as jwt.JwtPayload;

        if (!decoded.exp) return null;

        const currentTime = Math.floor(Date.now() / 1000); 
        const timeLeftInSeconds = decoded.exp - currentTime;
        const timeLeftInHours = timeLeftInSeconds / 3600;
        console.log(`Token expires in ~${timeLeftInHours.toFixed(2)} hours`);

        return token;
    } catch (err) {
        return null;
    }
}

export async function permission(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const userDetails = extractUserFromToken(authHeader);
    const admin = await getPermission(userDetails.userId);

    if (admin) {
        next();
    } else {
        ResponseHandler.forbidden(req, res, ERROR_MESSAGES.UNAUTHORIZED);
    }
}