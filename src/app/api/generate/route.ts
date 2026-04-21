import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const MODEL_NAME = "gemini-3.1-flash";
const FREE_TOKENS_PER_DAY = 15_000;
const ONE_DAY_SECONDS = 60 * 60 * 24;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type GeneratePayload = {
  robloxId?: string;
  prompt?: string;
  userKey?: string;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

function getRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Missing Upstash Redis environment variables.");
  }

  return new Redis({ url, token });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeneratePayload;
    const robloxId = body.robloxId?.trim();
    const prompt = body.prompt?.trim();
    const userKey = body.userKey?.trim();

    if (!robloxId || !prompt) {
      return json({ error: "robloxId and prompt are required." }, 400);
    }

    const systemKey = process.env.GOOGLE_API_KEY?.trim();
    const activeApiKey = userKey || systemKey;
    const isFreeTier = !userKey;

    if (!activeApiKey) {
      return json(
        {
          error:
            "No API key available. Provide userKey or set GOOGLE_API_KEY in environment variables.",
        },
        500,
      );
    }

    const genAI = new GoogleGenerativeAI(activeApiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    let redis: Redis | null = null;
    let currentUsage = 0;
    let promptTokens = 0;
    const usageKey = `usage:${robloxId}`;

    // Free-tier requests are limited by token budget tracked in Upstash.
    if (isFreeTier) {
      redis = getRedisClient();
      currentUsage = Number((await redis.get<number>(usageKey)) ?? 0);

      const tokenCheck = await model.countTokens(prompt);
      promptTokens = tokenCheck.totalTokens ?? 0;

      if (currentUsage + promptTokens > FREE_TOKENS_PER_DAY) {
        return json(
          {
            error: "Daily token limit reached.",
            limit: FREE_TOKENS_PER_DAY,
            used: currentUsage,
            requested: promptTokens,
            remaining: Math.max(FREE_TOKENS_PER_DAY - currentUsage, 0),
          },
          429,
        );
      }
    }

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const code = result.response.text().trim();

    if (!code) {
      return json({ error: "Model returned an empty response." }, 502);
    }

    if (isFreeTier && redis) {
      const totalTokensUsed =
        result.response.usageMetadata?.totalTokenCount ?? promptTokens;

      const newUsage = currentUsage + totalTokensUsed;
      await redis.set(usageKey, newUsage, { ex: ONE_DAY_SECONDS });
    }

    return json({
      ok: true,
      code,
      mode: isFreeTier ? "system-key" : "byok",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return json({ error: message }, 500);
  }
}