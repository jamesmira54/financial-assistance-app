import { Router } from "express";
import { ResponseHandler } from "../response";
import { allowRoles } from "../middleware/authentication";
import { QueryParams, getQueryParams } from "../utils";
import { changeGranteeStatus, getGrantees } from "./service";

export default () => {
  const monitoringAPI = Router();

  // Grantee Monitoring List. Coordinators/admins see every grantee; sponsors
  // are scoped to their own sponsorships (enforced in the service).
  monitoringAPI.get(
    "/grantees",
    allowRoles("system admin", "financial assistance coordinator", "sponsor"),
    async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const params: QueryParams = getQueryParams(req);
        const type = req.query.type ? String(req.query.type) : "all";
        const data = await getGrantees(authHeader, params, type);
        ResponseHandler.ok(req, res, data);
      } catch (err) {
        ResponseHandler.invalidRequest(req, res, err.message);
      }
    },
  );

  // Move a grantee through the post-award lifecycle (ACTIVE -> DELISTED/GRADUATED).
  monitoringAPI.put(
    "/grantees/:applicationId/status",
    allowRoles("system admin", "financial assistance coordinator"),
    async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const { applicationId } = req.params;
        const data = await changeGranteeStatus(applicationId, req.body, authHeader);
        ResponseHandler.updated(req, res, data);
      } catch (err) {
        ResponseHandler.invalidRequest(req, res, err.message);
      }
    },
  );

  return monitoringAPI;
};
