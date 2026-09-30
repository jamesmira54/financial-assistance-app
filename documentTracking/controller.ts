import { Request, Response, Router } from "express";
import { ResponseHandler } from "../response";
import { allowRoles } from "../middleware/authentication";
import {
  validateDtsAccept,
  validateDtsForward,
  validateDtsListQuery,
  validateDtsRemarksRequired,
  validateDtsSetupCreate,
  validateDtsSetupId,
  validateDtsSetupKind,
  validateDtsSetupUpdate,
  validateDtsSubmit,
  validateDtsTrackId,
  validateDtsTrackPayload,
  validateDtsUserOffice,
} from "../middleware/validation";
import { getQueryParams, QueryParams, SUCCESS_MESSAGES } from "../utils";
import {
  acceptTrack,
  assignUserOffice,
  completeTrack,
  createSetup,
  createTrack,
  deleteDraft,
  deleteSetup,
  DocumentTrackPayload,
  DtsForbiddenError,
  forwardTrack,
  getCurrentDtsUser,
  getTrack,
  getTrackForPrint,
  getTrackHistory,
  getTracks,
  listOfficeUsers,
  listSetup,
  returnTrack,
  submitTrack,
  TrackListFilters,
  updateSetup,
  updateTrack,
} from "./service";
import { renderTrackPdf } from "./pdf";

const SETUP_ROLES = ["system admin", "financial assistance coordinator"];

const fail = (req: Request, res: Response, err: any) => {
  if (err instanceof DtsForbiddenError) {
    ResponseHandler.forbidden(req, res, err.message);
  } else {
    ResponseHandler.invalidRequest(req, res, err.message);
  }
};

const trackPayload = (body: any): DocumentTrackPayload => ({
  title: body.title,
  particulars: body.particulars,
  processTypeId: body.processTypeId,
  purposeId: body.purposeId,
  sponsorshipId: body.sponsorshipId,
  destinationId: body.destinationId || null,
  submit: body.submit === true,
});

// Only the fields each action reads; status/office/actor are never taken from
// the request.
const actionFields = (body: any) => ({
  destinationId: body.destinationId || undefined,
  remarks: body.remarks ?? undefined,
});

const str = (v: any) => (v && v !== "undefined" && v !== "null" ? String(v) : undefined);

export default () => {
  const dtsAPI = Router();

  // -------------------------------------------------------------- current user

  dtsAPI.get("/me", async (req, res) => {
    try {
      ResponseHandler.ok(req, res, await getCurrentDtsUser(req.headers.authorization));
    } catch (err) {
      fail(req, res, err);
    }
  });

  // -------------------------------------------------------------- setup manager
  // Office user assignment is registered before the generic /setup/:kind routes.

  dtsAPI.get("/setup/offices/:id/users", allowRoles(...SETUP_ROLES), validateDtsSetupId, async (req, res) => {
    try {
      ResponseHandler.ok(req, res, await listOfficeUsers(String(req.params.id)));
    } catch (err) {
      fail(req, res, err);
    }
  });

  dtsAPI.put("/setup/user-offices/:userId", allowRoles("system admin"), validateDtsUserOffice, async (req, res) => {
    try {
      const data = await assignUserOffice(String(req.params.userId), req.body.officeId ?? null);
      ResponseHandler.updated(req, res, data);
    } catch (err) {
      fail(req, res, err);
    }
  });

  // Dropdown sources for the Create Track / Forward forms; readable by any
  // authenticated user. ?active=true limits to selectable values.
  dtsAPI.get("/setup/:kind", validateDtsSetupKind, async (req, res) => {
    try {
      const params: QueryParams = getQueryParams(req);
      const activeOnly = String(req.query.active).toLowerCase() === "true";
      ResponseHandler.ok(req, res, await listSetup(String(req.params.kind), params, activeOnly));
    } catch (err) {
      fail(req, res, err);
    }
  });

  dtsAPI.post("/setup/:kind", allowRoles(...SETUP_ROLES), validateDtsSetupKind, validateDtsSetupCreate, async (req, res) => {
    try {
      const data = await createSetup(String(req.params.kind), req.body, req.headers.authorization);
      ResponseHandler.created(req, res, data);
    } catch (err) {
      fail(req, res, err);
    }
  });

  dtsAPI.put("/setup/:kind/:id", allowRoles(...SETUP_ROLES), validateDtsSetupKind, validateDtsSetupId, validateDtsSetupUpdate, async (req, res) => {
    try {
      const data = await updateSetup(String(req.params.kind), String(req.params.id), req.body, req.headers.authorization);
      ResponseHandler.updated(req, res, data);
    } catch (err) {
      fail(req, res, err);
    }
  });

  dtsAPI.delete("/setup/:kind/:id", allowRoles(...SETUP_ROLES), validateDtsSetupKind, validateDtsSetupId, async (req, res) => {
    try {
      await deleteSetup(String(req.params.kind), String(req.params.id), req.headers.authorization);
      ResponseHandler.deleted(req, res, SUCCESS_MESSAGES.DTS_SETUP_DELETED);
    } catch (err) {
      fail(req, res, err);
    }
  });

  // -------------------------------------------------------------- tracks

  dtsAPI.get("/", validateDtsListQuery, async (req, res) => {
    try {
      const params: QueryParams = getQueryParams(req);
      const filters: TrackListFilters = {
        processTypeId: str(req.query.processTypeId),
        purposeId: str(req.query.purposeId),
        currentOfficeId: str(req.query.currentOfficeId),
        createdFrom: str(req.query.createdFrom),
        createdTo: str(req.query.createdTo),
        submittedFrom: str(req.query.submittedFrom),
        submittedTo: str(req.query.submittedTo),
        inbox: String(req.query.inbox).toLowerCase() === "true",
      };
      ResponseHandler.ok(req, res, await getTracks(req.headers.authorization, params, filters));
    } catch (err) {
      fail(req, res, err);
    }
  });

  // Create as Draft (submit omitted/false) or Create and Submit (submit: true).
  dtsAPI.post("/", validateDtsTrackPayload, async (req, res) => {
    try {
      const data = await createTrack(trackPayload(req.body), req.headers.authorization);
      ResponseHandler.created(req, res, data);
    } catch (err) {
      fail(req, res, err);
    }
  });

  dtsAPI.get("/:trackId", validateDtsTrackId, async (req, res) => {
    try {
      ResponseHandler.ok(req, res, await getTrack(String(req.params.trackId), req.headers.authorization));
    } catch (err) {
      fail(req, res, err);
    }
  });

  dtsAPI.put("/:trackId", validateDtsTrackId, validateDtsTrackPayload, async (req, res) => {
    try {
      const data = await updateTrack(String(req.params.trackId), trackPayload(req.body), req.headers.authorization);
      ResponseHandler.updated(req, res, data);
    } catch (err) {
      fail(req, res, err);
    }
  });

  dtsAPI.delete("/:trackId", validateDtsTrackId, async (req, res) => {
    try {
      await deleteDraft(String(req.params.trackId), req.headers.authorization);
      ResponseHandler.deleted(req, res, SUCCESS_MESSAGES.DTS_DRAFT_DELETED);
    } catch (err) {
      fail(req, res, err);
    }
  });

  dtsAPI.get("/:trackId/history", validateDtsTrackId, async (req, res) => {
    try {
      ResponseHandler.ok(req, res, await getTrackHistory(String(req.params.trackId), req.headers.authorization));
    } catch (err) {
      fail(req, res, err);
    }
  });

  // Binary response, so this streams the PDF directly (as resources/download
  // does) rather than going through ResponseHandler.
  dtsAPI.get("/:trackId/pdf", validateDtsTrackId, async (req, res) => {
    try {
      const track = await getTrackForPrint(String(req.params.trackId), req.headers.authorization);
      const pdf = await renderTrackPdf(track);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${track.trackNumber}.pdf"`);
      res.setHeader("Content-Length", pdf.length);
      res.end(pdf);
    } catch (err) {
      fail(req, res, err);
    }
  });

  // -------------------------------------------------------------- workflow

  const workflow: [string, any[], (id: string, fields: any, auth: string) => Promise<any>][] = [
    ["submit", validateDtsSubmit, submitTrack],
    ["accept", validateDtsAccept, acceptTrack],
    ["forward", validateDtsForward, forwardTrack],
    ["return", validateDtsRemarksRequired, returnTrack],
    ["done", validateDtsRemarksRequired, completeTrack],
  ];

  for (const [action, validators, handler] of workflow) {
    dtsAPI.post(`/:trackId/${action}`, validateDtsTrackId, ...validators, async (req: Request, res: Response) => {
      try {
        const data = await handler(String(req.params.trackId), actionFields(req.body), req.headers.authorization);
        ResponseHandler.updated(req, res, data);
      } catch (err) {
        fail(req, res, err);
      }
    });
  }

  return dtsAPI;
};
