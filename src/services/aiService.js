const { Anthropic } = require("@anthropic-ai/sdk");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client = null;

class AiUnavailableError extends Error {}

function getClient() {
  if (!client) {
    try {
      // Reads ANTHROPIC_API_KEY (or another configured Anthropic credential) from the environment.
      client = new Anthropic();
    } catch (error) {
      throw new AiUnavailableError(error.message);
    }
  }
  return client;
}

// Sends one request to Claude. "fallbacks: default" lets the API retry a refused
// request on a suitable fallback model inside the same call.
async function ask({ system, messages, effort, schema }) {
  let response;
  try {
    response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages,
      output_config: {
        effort,
        ...(schema ? { format: { type: "json_schema", schema } } : {}),
      },
    });
  } catch (error) {
    // Errors that are not SDK errors are raised before any request is sent,
    // e.g. when no credentials can be resolved.
    if (!(error instanceof Anthropic.AnthropicError)) throw new AiUnavailableError(error.message);
    throw error;
  }

  if (response.stop_reason === "refusal") {
    const error = new Error("The AI declined this request");
    error.status = 422;
    throw error;
  }
  if (response.stop_reason === "max_tokens") {
    const error = new Error("The AI response was cut off");
    error.status = 502;
    throw error;
  }

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return schema ? JSON.parse(text) : text;
}

// True when the failure is a server-side configuration problem (no or invalid
// credentials) rather than a problem with this particular request.
function isConfigurationError(error) {
  return error instanceof AiUnavailableError
    || error instanceof Anthropic.AuthenticationError
    || error instanceof Anthropic.PermissionDeniedError;
}

module.exports = { ask, isConfigurationError, APIError: Anthropic.APIError };
