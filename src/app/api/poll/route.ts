import { consumeIfAuthorized } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (!code || !token) {
    return Response.json({ paired: false, error: "Missing code or token" }, { status: 400 });
  }

  try {
    const result = await consumeIfAuthorized(code, token);

    if (!result.ok) {
      if (result.reason === "not_found") return Response.json({ paired: false }, { status: 404 });
      if (result.reason === "bad_token") return Response.json({ paired: false }, { status: 401 });
      if (result.reason === "expired") return Response.json({ paired: false, error: "expired" }, { status: 410 });
    }

    // Ensure code is always a string for the plugin — Upstash can auto-parse
    // the nested JSON payload into an object, but the plugin expects a raw JSON string.
    const codeValue = result.payload.code;
    const codeStr = typeof codeValue === "string" ? codeValue : JSON.stringify(codeValue);

    return Response.json({
      paired: true,
      hasNewCode: result.payload.hasNewCode,
      code: codeStr,
      messageId: result.payload.messageId,
    });
  } catch (err) {
    console.error("/api/poll error", err instanceof Error ? err.message : String(err));
    return Response.json({ paired: false, error: "Internal server error" }, { status: 500 });
  }
}