import { Router } from "express";
import { ResponseHandler } from "../response";
import { getQueryParams, QueryParams } from "../utils";
import { getAllPublicSponsorship } from "../sponsorship/service";
import { getAllPublicAnnouncement } from "../announcement/service";

export default () => {

    const publicAPI = Router();

    publicAPI.get('/sponsorships', async (req, res) => {
        try {
            const params: QueryParams = getQueryParams(req);
            const data = await getAllPublicSponsorship(params);
            ResponseHandler.ok(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    publicAPI.get('/announcements', async (req, res) => {
        try {
            const params: QueryParams = getQueryParams(req);
            const data = await getAllPublicAnnouncement(params);
            ResponseHandler.ok(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req, res, err.message);
        }
    });

    return publicAPI;
}
