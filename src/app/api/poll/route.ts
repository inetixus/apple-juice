import { consumeIfAuthorized } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (!code || !token) {
    return Response.json({ paired: false, error: "Missing code or token" }, { status: 400 });
  }

  const result = await consumeIfAuthorized(code, token);

  if (!result.ok) {
    if (result.reason === "not_found") return Response.json({ paired: false }, { status: 404 });
    if (result.reason === "bad_token") return Response.json({ paired: false }, { status: 401 });
    if (result.reason === "expired") return Response.json({ paired: false, error: "expired" }, { status: 410 });
  }

  return Response.json({
    paired: true,
    hasNewCode: result.payload.hasNewCode,
    code: result.payload.code,
    messageId: result.payload.messageId,
  });
}