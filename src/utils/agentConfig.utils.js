import { ObjectId } from "mongodb";
import apiCallModel from "../mongoModel/ApiCall.model.js";
import jwt from "jsonwebtoken";
import axios from "axios";

const getUniqueNameAndSlug = (baseName, allAgents) => {
  const name = baseName || "untitled_agent";
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRegex = new RegExp(`^${escapeRegExp(name)}(?:_(\\d+))?$`);

  let name_next_count = 1;
  let slug_next_count = 1;

  for (const agent of allAgents) {
    const nameMatch = agent.name?.match(nameRegex);
    if (nameMatch) {
      const num = nameMatch[1] ? parseInt(nameMatch[1], 10) : 0;
      if (num >= name_next_count) name_next_count = num + 1;
    }

    const slugMatch = agent.slugName?.match(nameRegex);
    if (slugMatch) {
      const num = slugMatch[1] ? parseInt(slugMatch[1], 10) : 0;
      if (num >= slug_next_count) slug_next_count = num + 1;
    }
  }

  return {
    name: baseName || `${name}_${name_next_count}`,
    slugName: `${name}_${slug_next_count}`
  };
};

const normalizeFunctionIds = (function_ids) => {
  if (!function_ids) return [];
  if (Array.isArray(function_ids)) return function_ids;
  if (typeof function_ids === "object") return Object.values(function_ids);
  return [];
};

const cloneFunctionsForAgent = async (function_ids, org_id, agent_id) => {
  const cloned_function_ids = [];
  const ids = normalizeFunctionIds(function_ids);

  for (const function_id of ids) {
    if (!function_id) continue;
    let functionObjectId = null;
    try {
      functionObjectId = function_id?.buffer ? new ObjectId(Buffer.from(function_id.buffer)) : new ObjectId(function_id);
    } catch {
      console.error("Invalid function id in template:", function_id);
      continue;
    }

    const original_api_call = await apiCallModel.findOne({ _id: functionObjectId }).lean();
    if (!original_api_call || !original_api_call.script_id) {
      continue;
    }

    const existing_api_call = await apiCallModel
      .findOne({
        org_id: org_id,
        script_id: original_api_call.script_id
      })
      .lean();

    if (existing_api_call) {
      await apiCallModel.updateOne(
        { _id: existing_api_call._id },
        {
          $addToSet: { bridge_ids: agent_id.toString() }
        }
      );
      cloned_function_ids.push(existing_api_call._id.toString());
      continue;
    }

    try {
      const payload = {
        org_id: process.env.ORG_ID,
        project_id: process.env.PROJECT_ID,
        user_id: org_id
      };
      const auth_token = jwt.sign(payload, process.env.ACCESS_KEY, { algorithm: "HS256" });

      const duplicate_url = `https://flow-api.viasocket.com/embed/duplicateflow/${original_api_call.script_id}`;
      const headers = {
        Authorization: auth_token,
        "Content-Type": "application/json"
      };
      const json_body = {
        title: "",
        meta: ""
      };

      const response = await axios.post(duplicate_url, json_body, { headers });
      const duplicate_data = response.data;

      if (duplicate_data.success && duplicate_data.data) {
        const new_api_call = { ...original_api_call };
        delete new_api_call._id;
        new_api_call.org_id = org_id;
        new_api_call.script_id = duplicate_data.data.id;
        new_api_call.bridge_ids = [agent_id.toString()];

        const new_api_call_result = await new apiCallModel(new_api_call).save();
        cloned_function_ids.push(new_api_call_result._id.toString());
      } else {
        console.error(`Failed to duplicate function ${original_api_call.script_id}:`, duplicate_data);
      }
    } catch (e) {
      console.error(`Error duplicating function ${original_api_call.script_id || function_id}:`, e);
      const new_api_call = { ...original_api_call };
      delete new_api_call._id;
      new_api_call.org_id = org_id;
      new_api_call.bridge_ids = [agent_id.toString()];

      const new_api_call_result = await new apiCallModel(new_api_call).save();
      cloned_function_ids.push(new_api_call_result._id.toString());
    }
  }

  return cloned_function_ids;
};

// const getModelParamMap = (service, model, modelConfigDocument) => {
//   if (!service || !model) return {};
//   const serviceLower = String(service).toLowerCase();
//   const modelDef = modelConfigDocument?.[serviceLower]?.[model];
//   if (!modelDef?.configuration) return {};
//   returnmodelDef.configuration || {};
// };

// const isAdvancedParam = (paramDef) => {
//   if (!paramDef || typeof paramDef !== "object") return false;
//   return paramDef.min !== undefined || paramDef.max !== undefined;
// };

// const normalizeModeObject = (raw) => {
//   if (!(raw && typeof raw === "object" && "mode" in raw)) {
//     return { mode: "default", value: null };
//   }

//   const mode = raw.mode;
//   if (mode === "default" || mode === "min" || mode === "max") {
//     return { mode, value: null };
//   }

//   if (mode === "custom") {
//     return { mode: "custom", value: typeof raw.value === "number" ? raw.value : null };
//   }

//   return { mode: "default", value: null };
// };

// const transformAdvancedParams = (payloadConfig, { service, model, modelConfigDocument }) => {
//   if (!payloadConfig || typeof payloadConfig !== "object") return payloadConfig;

//   const modelParams = getModelParamMap(service, model, modelConfigDocument);
//   const transformed = { ...payloadConfig };

//   for (const [key, rawValue] of Object.entries(payloadConfig)) {
//     // strict trigger: only if incoming value is object with mode
//     if (!(rawValue && typeof rawValue === "object" && "mode" in rawValue)) continue;

//     // optional safety: only transform if key is an advanced parameter for this model
//     if (!isAdvancedParam(modelParams[key])) continue;

//     transformed[key] = normalizeModeObject(rawValue);
//   }

//   return transformed;
// };

const getModelConfigParams = (service, model, modelConfigDocument) => {
  if (!service || !model) return {};
  const serviceLower = String(service).toLowerCase();
  const modelDoc = modelConfigDocument?.[serviceLower]?.[model];
  if (!modelDoc?.configuration) return {};
  return modelDoc.configuration.additional_parameters || modelDoc.configuration;
};

// const isAdvancedParam = (paramDef) => {
//   if (!paramDef || typeof paramDef !== "object") return false;
//   return paramDef.field === "slider" || paramDef.min !== undefined || paramDef.max !== undefined;
// };

const normalizeModeValue = (rawValue) => {
  if (rawValue && typeof rawValue === "object" && "mode" in rawValue) {
    const { mode, value } = rawValue;

    if (mode === "default" || mode === "min" || mode === "max") {
      return { mode, value: null };
    }

    if (mode === "custom") {
      return { mode: "custom", value: typeof value === "number" ? value : null };
    }

    return { mode: "default", value: null };
  }

  // if (rawValue === "default" || rawValue === "min" || rawValue === "max") {
  //   return { mode: rawValue, value: null };
  // }

  // if (typeof rawValue === "number") {
  //   return { mode: "custom", value: rawValue };
  // }

  // return { mode: "default", value: null };
};

const transformAdvancedParams = (payloadConfig, { service, model, modelConfigDocument }) => {
  if (!payloadConfig || typeof payloadConfig !== "object") return payloadConfig;

  const modelParams = getModelConfigParams(service, model, modelConfigDocument);
  if (!modelParams || typeof modelParams !== "object") return payloadConfig;

  const transformed = { ...payloadConfig };

  for (const [key, rawValue] of Object.entries(payloadConfig)) {
    const keyExistsInModelConfig = Object.prototype.hasOwnProperty.call(modelParams, key);
    if (!keyExistsInModelConfig) continue;

    transformed[key] = normalizeModeValue(rawValue);
  }

  return transformed;
};

export { getUniqueNameAndSlug, normalizeFunctionIds, cloneFunctionsForAgent, transformAdvancedParams };
