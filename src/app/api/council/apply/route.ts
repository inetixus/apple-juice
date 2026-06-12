import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSession } from "@/lib/store";
import { runStudioTool, isStudioBridgeLive } from "@/lib/agent/studio-bridge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ApplyBody = {
  sessionKey?: string;
  code?: string;
  /** Where to place it. Sensible defaults if omitted. */
  parent?: string;
  name?: string;
  type?: "Script" | "LocalScript" | "ModuleScript";
};

/**
 * POST /api/council/apply
 *
 * Writes the council's winning code straight into the user's Roblox Studio via
 * the plugin tool bridge — one click from "best solution" to "in my game".
 * Requires the Studio plugin to be paired/live for this session.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  let ownerUserId = (session?.user as { id?: string } | undefined)?.id;

  const body = (await req.json()) as ApplyBody;
  const sessionKey = body.sessionKey?.trim() ?? "";
  const code = (body.code ?? "").trim();

  if (!sessionKey) {
    return Response.json({ error: "Missing sessionKey" }, { status: 400 });
  }
  const pair = await getSession(sessionKey);
  if (!ownerUserId && pair) ownerUserId = pair.ownerUserId;
  if (!ownerUserId || !pair || pair.ownerUserId !== ownerUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!code) {
    return Response.json({ error: "No code to apply" }, { status: 400 });
  }

  if (!(await isStudioBridgeLive(sessionKey))) {
    return Response.json(
      { error: "Roblox Studio isn't connected. Pair the plugin and try again." },
      { status: 409 },
    );
  }

  // Default placement: a server Script in ServerScriptService. The council
  // produces a single solution, so one target is correct here.
  const type = body.type ?? "Script";
  const parent =
    body.parent ??
    (type === "LocalScript"
      ? "StarterPlayer.StarterPlayerScripts"
      : type === "ModuleScript"
        ? "ReplicatedStorage"
        : "ServerScriptService");
  const name = (body.name ?? "CouncilWinner").replace(/[^A-Za-z0-9_]/g, "") || "CouncilWinner";

  const res = await runStudioTool(sessionKey, "studio_write_script", {
    parent,
    name,
    type,
    code,
  });

  if (!res.ok) {
    return Response.json(
      { error: res.error ?? "Failed to write script to Studio." },
      { status: 502 },
    );
  }

  return Response.json({
    success: true,
    message: `Wrote ${parent}.${name} to Studio.`,
    parent,
    name,
    type,
  });
}
