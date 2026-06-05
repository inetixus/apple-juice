import { getRedis } from "@/lib/store";

/**
 * Stage 2: the Studio plugin posts a full project snapshot (tree + script
 * sources) here. We stash it in Redis keyed by session so the chat route can
 * forward it to the agentic proxy. Snapshots can be large, so we cap and expire.
 */

const MAX_ENTRIES = 2000;
const TTL_SECONDS = 60 * 30; // 30 minutes

type SnapshotEntry = {
  path: string;
  className: string;
  source?: string;
};

export async function POST(req: Request) {
  try {
    const { key, snapshot } = await req.json();
    if (!key || typeof key !== "string") {
      return Response.json({ error: "Missing key" }, { status: 400 });
    }
    if (!Array.isArray(snapshot)) {
      return Response.json({ error: "snapshot must be an array" }, { status: 400 });
    }

    // Sanitize / cap to protect Redis and the proxy.
    const cleaned: SnapshotEntry[] = [];
    for (const e of snapshot.slice(0, MAX_ENTRIES)) {
      if (!e || typeof e.path !== "string" || typeof e.className !== "string") continue;
      cleaned.push({
        path: e.path,
        className: e.className,
        source: typeof e.source === "string" ? e.source : undefined,
      });
    }

    const redis = getRedis();
    await redis.set(`snapshot:${key}`, JSON.stringify(cleaned), { ex: TTL_SECONDS });

    return Response.json({ success: true, count: cleaned.length });
  } catch (error) {
    console.error("Snapshot sync error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
