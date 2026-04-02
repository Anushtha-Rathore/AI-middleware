import express from "express";
import { middleware, requireAdminRole } from "../middlewares/middleware.js";
import * as agentConfigController from "../controllers/agentConfig.controller.js";
import validate from "../middlewares/validate.middleware.js";
import conversationValidation from "../validation/joi_validation/conversation.validation.js";
import agentConfigValidation from "../validation/joi_validation/agentConfig.validation.js";
import { transformAgentAdvanceParametersMiddleware } from "../services/utils/agentAdvanceParameterTransform.utils.js";

console.log("🔍 config.routes.js loaded with transformAgentAdvanceParametersMiddleware");

const router = express.Router();

// Add logging for all routes
router.use((req, res, next) => {
  console.log("🔍 config.routes.js - Route hit:", req.method, req.originalUrl);
  next();
});

router.get("/", middleware, agentConfigController.getAllAgentController);

router.get("/:agent_id", middleware, validate(agentConfigValidation.getAgent), agentConfigController.getAgentController);

router.post(
  "/",
  middleware,
  requireAdminRole,
  validate(agentConfigValidation.createAgent),
  transformAgentAdvanceParametersMiddleware,
  agentConfigController.createAgentController
);

router.put(
  "/:agent_id",
  middleware,
  requireAdminRole,
  (req, res, next) => {
    console.log("🚀 PUT /:agent_id route hit - about to call middleware");
    next();
  },
  transformAgentAdvanceParametersMiddleware,
  (req, res, next) => {
    console.log("🚀 Middleware completed - calling controller");
    next();
  },
  agentConfigController.updateAgentController
);

router.post("/clone", middleware, requireAdminRole, validate(agentConfigValidation.cloneAgent), agentConfigController.cloneAgentController);

router.delete(
  "/:agent_id",
  middleware,
  requireAdminRole,
  validate(conversationValidation.deleteBridges),
  agentConfigController.deleteAgentController
);

export default router;
