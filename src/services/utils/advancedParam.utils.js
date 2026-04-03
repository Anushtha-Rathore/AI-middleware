import { modelConfigDocument } from "./loadModelConfigs.js";

/**
 * Get the set of advanced parameter keys for a given service and model.
 * Advanced parameters are identified by their field type (slider) or typeOf value.
 * @param {string} service - The service name (e.g., 'openai', 'anthropic')
 * @param {string} model - The model name
 * @returns {Set<string>} Set of advanced parameter keys
 */
const getAdvancedParamKeys = (service, model) => {
  if (!service || !model) return new Set();

  const serviceLower = service.toLowerCase();
  const modelConfig = modelConfigDocument[serviceLower]?.[model];
  if (!modelConfig) {
    console.log(`[ADV_PARAM] No model config found for ${serviceLower}/${model}`);
    return new Set();
  }

  const advancedKeys = new Set();
  const config = modelConfig.configuration || {};

  for (const [key, value] of Object.entries(config)) {
    // Skip the 'model' key itself
    if (key === "model") continue;

    // Consider a parameter as "advanced" if:
    // 1. It has a field type of "slider" (temperature, max_tokens, etc.)
    // 2. Or it has min/max values defined (numeric range parameters)
    if (value && typeof value === "object") {
      const isSlider = value.field === "slider";
      const hasNumericRange = typeof value.min === "number" && typeof value.max === "number";
      const isNumericType = value.typeOf === "number";

      if (isSlider || (hasNumericRange && isNumericType)) {
        advancedKeys.add(key);
      }
    }
  }

  console.log(`[ADV_PARAM] Advanced keys for ${serviceLower}/${model}:`, Array.from(advancedKeys));
  return advancedKeys;
};

/**
 * Transform configuration from frontend format to DB storage format.
 * For advanced parameters, stores as { mode, value } object.
 * For regular parameters, stores as-is.
 *
 * Frontend format: { creativity_level: 0.7, max_tokens: "default", model: "gpt-4" }
 * DB format: { creativity_level: { mode: "custom", value: 0.7 }, max_tokens: { mode: "default", value: null }, model: "gpt-4" }
 *
 * @param {Object} configuration - Configuration object from frontend
 * @param {string} service - The service name
 * @param {string} model - The model name
 * @returns {Object} Transformed configuration for DB storage
 */
const transformToDbFormat = (configuration, service, model) => {
  if (!configuration || typeof configuration !== "object") {
    return configuration;
  }

  const advancedKeys = getAdvancedParamKeys(service, model);
  const transformed = {};

  for (const [key, value] of Object.entries(configuration)) {
    // Skip non-advanced parameters - store as-is
    if (!advancedKeys.has(key)) {
      transformed[key] = value;
      continue;
    }

    // If already in DB format (has mode property), keep as-is
    if (value && typeof value === "object" && "mode" in value) {
      transformed[key] = value;
      continue;
    }

    // Transform to DB format based on value type
    if (value === "default" || value === "min" || value === "max") {
      transformed[key] = {
        mode: value,
        value: null
      };
    } else if (typeof value === "number") {
      transformed[key] = {
        mode: "custom",
        value: value
      };
    } else if (value === null || value === undefined) {
      transformed[key] = {
        mode: "default",
        value: null
      };
    } else {
      // For any other case, treat as custom with the value
      transformed[key] = {
        mode: "custom",
        value: typeof value === "string" ? parseFloat(value) || null : value
      };
    }
  }

  return transformed;
};

/**
 * Transform configuration from DB storage format to frontend format.
 * For advanced parameters, flattens { mode, value } to the appropriate value.
 * For regular parameters, returns as-is.
 *
 * DB format: { creativity_level: { mode: "custom", value: 0.7 }, max_tokens: { mode: "default", value: null } }
 * Frontend format: { creativity_level: 0.7, max_tokens: "default" }
 *
 * @param {Object} configuration - Configuration object from DB
 * @param {string} service - The service name
 * @param {string} model - The model name
 * @returns {Object} Transformed configuration for frontend
 */
const transformToFrontendFormat = (configuration, service, model) => {
  if (!configuration || typeof configuration !== "object") {
    return configuration;
  }

  const advancedKeys = getAdvancedParamKeys(service, model);
  const transformed = {};

  for (const [key, value] of Object.entries(configuration)) {
    // Check if this is an advanced parameter stored in DB format
    if (advancedKeys.has(key) && value && typeof value === "object" && "mode" in value) {
      // Convert from DB format to frontend format
      if (value.mode === "custom") {
        transformed[key] = value.value;
      } else {
        // mode is "default", "min", or "max"
        transformed[key] = value.mode;
      }
    } else {
      // Regular parameter or old format - return as-is
      transformed[key] = value;
    }
  }

  return transformed;
};

/**
 * Check if a configuration value is in DB format (has mode/value structure)
 * @param {*} value - The value to check
 * @returns {boolean}
 */
const isDbFormat = (value) => {
  return value && typeof value === "object" && "mode" in value && "value" in value;
};

export { getAdvancedParamKeys, transformToDbFormat, transformToFrontendFormat, isDbFormat };
