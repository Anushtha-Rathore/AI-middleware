import { modelConfigDocument } from "./loadModelConfigs.js";

console.log("🔍 agentAdvanceParameterTransform.utils.js loaded successfully!");

/**
 * Get advance parameter fields for a specific service and model
 * @param {string} service - Service name (e.g., 'openai', 'google')
 * @param {string} model_name - Model name (e.g., 'gpt-3.5-turbo')
 * @returns {Array} - Array of advance parameter field names
 */
function getAdvanceParameterFieldsForModel(service, model_name) {
  try {
    console.log(`🔍 Getting advance parameters for service: ${service}, model: ${model_name}`);

    const serviceLower = service.toLowerCase();
    if (!modelConfigDocument[serviceLower] || !modelConfigDocument[serviceLower][model_name]) {
      console.log(`⚠️ No model configuration found for ${service}/${model_name}`);
      return [];
    }

    const modelObj = modelConfigDocument[serviceLower][model_name];
    const configurations = modelObj.configuration || {};

    // Get all fields that have level property (advance parameters)
    const advanceFields = Object.keys(configurations).filter((field) => {
      const fieldConfig = configurations[field];
      return fieldConfig && typeof fieldConfig === "object" && fieldConfig.level !== undefined;
    });

    console.log(`✅ Found advance parameters for ${service}/${model_name}:`, advanceFields);
    return advanceFields;
  } catch (error) {
    console.error(`❌ Error getting advance parameters for ${service}/${model_name}:`, error);
    return [];
  }
}

/**
 * Transform advance parameters from frontend structure to backend mode/value structure
 * Only transforms fields that are in the advance parameter list for the specific model
 * @param {Object} configuration - The configuration object from frontend
 * @param {string} service - Service name from request
 * @param {string} model_name - Model name from request
 * @returns {Object} - Transformed configuration with mode/value structure
 */
export function transformAgentAdvanceParametersToModeValue(configuration, service, model_name) {
  console.log("=== TRANSFORMATION START ===");
  console.log("Input configuration:", JSON.stringify(configuration, null, 2));
  console.log("Service:", service, "Model:", model_name);

  if (!configuration || typeof configuration !== "object") {
    console.log("No configuration or not an object, returning as-is");
    return configuration;
  }

  if (!service || !model_name) {
    console.log("⚠️ Service or model name missing, cannot determine advance parameters");
    return configuration;
  }

  // Get the list of advance parameters for this specific model
  const advanceParameterFields = getAdvanceParameterFieldsForModel(service, model_name);

  if (advanceParameterFields.length === 0) {
    console.log("⚠️ No advance parameters found for this model, returning as-is");
    return configuration;
  }

  console.log("🎯 Advance parameter fields to check:", advanceParameterFields);

  const transformedConfig = { ...configuration };
  let transformationCount = 0;

  // Check only the advance parameter fields for this model
  advanceParameterFields.forEach((field) => {
    const fieldValue = transformedConfig[field];

    if (fieldValue) {
      console.log(`Checking advance field: ${field}`, fieldValue);

      // Transform if it's an object WITHOUT 'mode' key (old format)
      if (fieldValue && typeof fieldValue === "object" && fieldValue.mode === undefined && fieldValue.level !== undefined) {
        console.log(`🔄 TRANSFORMING advance field: ${field} from old format to mode/value`);

        // Convert old format to new mode/value structure
        const oldValue = transformedConfig[field];
        transformedConfig[field] = {
          mode: determineModeFromLevel(fieldValue),
          value: fieldValue.level
        };

        console.log(`Field ${field} transformed:`, {
          old: oldValue,
          new: transformedConfig[field]
        });

        transformationCount++;
      } else {
        console.log(`✅ SKIP advance field: ${field} (already has mode or no level)`);
      }
    } else {
      console.log(`ℹ️ Advance field ${field} not found in configuration`);
    }
  });

  console.log(`=== TRANSFORMATION COMPLETE ===`);
  console.log(`Total fields transformed: ${transformationCount}`);
  console.log("Output configuration:", JSON.stringify(transformedConfig, null, 2));
  console.log("=== END TRANSFORMATION ===\n");

  return transformedConfig;
}

/**
 * Determine mode from level value
 * @param {Object} fieldValue - Field value in old format
 * @returns {string} - The mode
 */
function determineModeFromLevel(fieldValue) {
  const level = fieldValue.level;
  const defaultValue = fieldValue.default;

  console.log(`Determining mode for field - level: ${level}, default: ${defaultValue}, min: ${fieldValue.min}, max: ${fieldValue.max}`);

  if (level === defaultValue || level === 0) {
    console.log(`Mode determined as: default`);
    return "default";
  }

  if (fieldValue.min !== undefined && level === fieldValue.min) {
    console.log(`Mode determined as: min`);
    return "min";
  }

  if (fieldValue.max !== undefined && level === fieldValue.max) {
    console.log(`Mode determined as: max`);
    return "max";
  }

  console.log(`Mode determined as: custom`);
  return "custom";
}

/**
 * Middleware function to transform agent configuration before processing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function transformAgentAdvanceParametersMiddleware(req, res, next) {
  console.log("🚀 MIDDLEWARE CALLED! transformAgentAdvanceParametersMiddleware executed");
  console.log("🔍 MIDDLEWARE: Transform agent advance parameters");
  console.log("Request body keys:", Object.keys(req.body));
  console.log("Request body configuration exists:", !!req.body.configuration);
  console.log("Service from request:", req.body.service);
  console.log("Model from configuration:", req.body.configuration?.model);

  const { configuration, service } = req.body;
  const model_name = configuration?.model || req.body.model_name;

  if (configuration) {
    console.log("🔄 MIDDLEWARE: Configuration found, transforming...");
    console.log("Using service:", service, "and model:", model_name);

    const originalConfig = { ...configuration };
    req.body.configuration = transformAgentAdvanceParametersToModeValue(configuration, service, model_name);

    console.log("🔍 MIDDLEWARE: Transformation completed");
    console.log("Original config keys:", Object.keys(originalConfig));
    console.log("Transformed config keys:", Object.keys(req.body.configuration));

    // Check if anything actually changed
    const hasChanges = JSON.stringify(originalConfig) !== JSON.stringify(req.body.configuration);
    console.log("🔍 MIDDLEWARE: Configuration changed:", hasChanges);
  } else {
    console.log("⚠️ MIDDLEWARE: No configuration found in request body");
  }

  next();
}
