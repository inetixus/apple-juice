/**
 * BYOK (Bring Your Own Key) provider registry — the single source of truth for
 * every external inference provider a user can plug their own API key into.
 *
 * Almost all of these expose an OpenAI-compatible `/chat/completions` endpoint,
 * so the chat route can treat them uniformly: pick the base URL from here, send
 * the user's key as a Bearer token, done. Google (Gemini) is the one shape-
 * different provider and is handled on its own path in the chat route.
 *
 * Shared-credit ("provided") inference does NOT live here — that runs on the
 * Kiro lineup (see kiro-models.ts) and is selected when keyMode === "provided".
 *
 * Logo files live under /public/icons/<id>.png (or .webp). Use those exact
 * filenames when dropping new icons in — the registry picks them up automatically.
 */

export type ByokProviderId =
  | "openai"
  | "google"
  | "anthropic"
  | "deepseek"
  | "openrouter"
  | "groq"
  | "mistral"
  | "xai"
  | "together"
  | "fireworks"
  | "perplexity"
  | "huggingface";

export interface ByokProvider {
  id: ByokProviderId;
  /** Human label shown in the picker. */
  label: string;
  /** Brand logo under /public/icons, or null for a generic mark. */
  logo: string | null;
  /** OpenAI-compatible chat-completions endpoint. Empty for non-OAI shapes. */
  endpoint: string;
  /** Where the user generates a key (shown as a help link). */
  consoleUrl: string;
  /** Placeholder shown in the key input. */
  placeholder: string;
  /** Loose prefix(es) a valid key usually starts with (for soft detection). */
  keyPrefixes: string[];
  /** A small curated set of recommended models, used as a fallback list. */
  defaultModels: string[];
  /** Default model selected when the user switches to this provider. */
  defaultModel: string;
  /**
   * true  → uses the standard OpenAI Chat Completions wire format.
   * false → bespoke shape (currently only Google), handled separately.
   */
  openAiCompatible: boolean;
}

export const BYOK_PROVIDERS: Record<ByokProviderId, ByokProvider> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    logo: "/icons/chatgpt.png",
    endpoint: "https://api.openai.com/v1/chat/completions",
    consoleUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
    keyPrefixes: ["sk-"],
    defaultModels: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o1", "o1-mini"],
    defaultModel: "gpt-4o-mini",
    openAiCompatible: true,
  },
  google: {
    id: "google",
    label: "Google AI Studio",
    logo: "/icons/google.webp",
    endpoint: "", // bespoke Gemini shape — handled on the google path
    consoleUrl: "https://aistudio.google.com/app/apikey",
    placeholder: "AIza...",
    keyPrefixes: ["AIza"],
    defaultModels: [
      "models/gemini-2.5-pro",
      "models/gemini-2.5-flash",
      "models/gemini-2.0-flash",
      "models/gemini-1.5-pro",
      "models/gemini-1.5-flash",
    ],
    defaultModel: "models/gemini-2.5-flash",
    openAiCompatible: false,
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    logo: "/icons/anthropic.png",
    endpoint: "https://api.anthropic.com/v1/chat/completions",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
    keyPrefixes: ["sk-ant-"],
    defaultModels: [
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
    ],
    defaultModel: "claude-3-5-sonnet-latest",
    openAiCompatible: true,
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    logo: "/icons/deepseek.png",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    consoleUrl: "https://platform.deepseek.com/api_keys",
    placeholder: "sk-...",
    keyPrefixes: ["sk-"],
    defaultModels: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    openAiCompatible: true,
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    logo: "/icons/openrouter.png",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    consoleUrl: "https://openrouter.ai/keys",
    placeholder: "sk-or-...",
    keyPrefixes: ["sk-or-"],
    defaultModels: [
      "anthropic/claude-sonnet-4",
      "openai/gpt-4o",
      "deepseek/deepseek-chat",
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.3-70b-instruct",
    ],
    defaultModel: "anthropic/claude-sonnet-4",
    openAiCompatible: true,
  },
  groq: {
    id: "groq",
    label: "Groq",
    logo: "/icons/groq.png",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    consoleUrl: "https://console.groq.com/keys",
    placeholder: "gsk_...",
    keyPrefixes: ["gsk_"],
    defaultModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "deepseek-r1-distill-llama-70b",
      "qwen-2.5-coder-32b",
    ],
    defaultModel: "llama-3.3-70b-versatile",
    openAiCompatible: true,
  },
  mistral: {
    id: "mistral",
    label: "Mistral AI",
    logo: "/icons/mistral.png",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    consoleUrl: "https://console.mistral.ai/api-keys",
    placeholder: "...",
    keyPrefixes: [],
    defaultModels: ["mistral-large-latest", "codestral-latest", "mistral-small-latest"],
    defaultModel: "codestral-latest",
    openAiCompatible: true,
  },
  xai: {
    id: "xai",
    label: "xAI (Grok)",
    logo: "/icons/xai.png",
    endpoint: "https://api.x.ai/v1/chat/completions",
    consoleUrl: "https://console.x.ai",
    placeholder: "xai-...",
    keyPrefixes: ["xai-"],
    defaultModels: ["grok-4", "grok-3", "grok-3-mini"],
    defaultModel: "grok-3",
    openAiCompatible: true,
  },
  together: {
    id: "together",
    label: "Together AI",
    logo: "/icons/together.png",
    endpoint: "https://api.together.xyz/v1/chat/completions",
    consoleUrl: "https://api.together.xyz/settings/api-keys",
    placeholder: "...",
    keyPrefixes: [],
    defaultModels: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "Qwen/Qwen2.5-Coder-32B-Instruct",
      "deepseek-ai/DeepSeek-V3",
    ],
    defaultModel: "Qwen/Qwen2.5-Coder-32B-Instruct",
    openAiCompatible: true,
  },
  fireworks: {
    id: "fireworks",
    label: "Fireworks AI",
    logo: "/icons/fireworks.png",
    endpoint: "https://api.fireworks.ai/inference/v1/chat/completions",
    consoleUrl: "https://fireworks.ai/account/api-keys",
    placeholder: "fw_...",
    keyPrefixes: ["fw_"],
    defaultModels: [
      "accounts/fireworks/models/llama-v3p3-70b-instruct",
      "accounts/fireworks/models/deepseek-v3",
      "accounts/fireworks/models/qwen2p5-coder-32b-instruct",
    ],
    defaultModel: "accounts/fireworks/models/qwen2p5-coder-32b-instruct",
    openAiCompatible: true,
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    logo: "/icons/perplexity.png",
    endpoint: "https://api.perplexity.ai/chat/completions",
    consoleUrl: "https://www.perplexity.ai/settings/api",
    placeholder: "pplx-...",
    keyPrefixes: ["pplx-"],
    defaultModels: ["sonar-pro", "sonar", "sonar-reasoning"],
    defaultModel: "sonar",
    openAiCompatible: true,
  },
  huggingface: {
    id: "huggingface",
    label: "Hugging Face",
    logo: "/icons/huggingface.png",
    // Hugging Face Inference API — OpenAI-compatible endpoint.
    // Models are addressed as the full HF repo id, e.g. "Qwen/Qwen2.5-Coder-32B-Instruct".
    endpoint: "https://api-inference.huggingface.co/v1/chat/completions",
    consoleUrl: "https://huggingface.co/settings/tokens",
    placeholder: "hf_...",
    keyPrefixes: ["hf_"],
    defaultModels: [
      "Qwen/Qwen2.5-Coder-32B-Instruct",
      "meta-llama/Llama-3.3-70B-Instruct",
      "deepseek-ai/DeepSeek-V3-0324",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "microsoft/Phi-4",
    ],
    defaultModel: "Qwen/Qwen2.5-Coder-32B-Instruct",
    openAiCompatible: true,
  },
};

/** Ordered list for rendering the provider picker. */
export const BYOK_PROVIDER_LIST: ByokProvider[] = [
  BYOK_PROVIDERS.openai,
  BYOK_PROVIDERS.anthropic,
  BYOK_PROVIDERS.google,
  BYOK_PROVIDERS.deepseek,
  BYOK_PROVIDERS.openrouter,
  BYOK_PROVIDERS.groq,
  BYOK_PROVIDERS.mistral,
  BYOK_PROVIDERS.xai,
  BYOK_PROVIDERS.together,
  BYOK_PROVIDERS.fireworks,
  BYOK_PROVIDERS.perplexity,
  BYOK_PROVIDERS.huggingface,
];

export function getByokProvider(id: string | undefined | null): ByokProvider | undefined {
  if (!id) return undefined;
  return BYOK_PROVIDERS[id as ByokProviderId];
}

/** Resolve the chat-completions endpoint for an OpenAI-compatible provider. */
export function endpointForProvider(id: string): string {
  return getByokProvider(id)?.endpoint || BYOK_PROVIDERS.openai.endpoint;
}

/** Extra headers some providers require (e.g. OpenRouter attribution). */
export function extraHeadersForProvider(id: string): Record<string, string> {
  if (id === "openrouter") {
    return {
      "HTTP-Referer": "https://github.com/inetixus/apple-juice",
      "X-Title": "Apple Juice Roblox Sync",
    };
  }
  if (id === "anthropic") {
    // Anthropic's OpenAI-compat endpoint still wants its version header.
    return { "anthropic-version": "2023-06-01" };
  }
  return {};
}

/** localStorage key holding a provider's BYOK key. */
export function storageKeyFor(id: string): string {
  return `apple-juice-byok-${id}`;
}
