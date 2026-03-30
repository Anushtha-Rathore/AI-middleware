import { modelConfigDocument } from "../services/utils/loadModelConfigs.js";
import { transformAdvancedParams } from "../utils/agentConfig.utils.js";

const transformAdvancedParamsMiddleware = (req, res, next) => {
  try {
    const configuration = req.body?.configuration;
    if (!configuration || typeof configuration !== "object") return next();

    const service = req.body?.service;
    const model = configuration?.model || req.body?.model;

    if (!service || !model) return next();

    req.body.configuration = transformAdvancedParams(configuration, {
      service,
      model,
      modelConfigDocument
    });

    return next();
  } catch (err) {
    return next(err);
  }
};

export default transformAdvancedParamsMiddleware;
