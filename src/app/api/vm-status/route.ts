/**
 * Lightweight health-check endpoint for the self-hosted Ollama VM.
 * Bypasses all auth/session/juice logic — just pings the VM directly.
 */
export const dynamic = "force-dynamic";

const OLLAMA_HOST = "http://130.110.14.224:11434";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const models = (data?.models || []).map((m: any) => m.name || m.model || "unknown");
      return Response.json({ status: "online", models });
    }

    return Response.json({ status: "offline", reason: `HTTP ${res.status}` }, { status: 502 });
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return Response.json(
      {
        status: "offline",
        reason: isTimeout ? "Connection timed out" : err?.message || "Network error",
      },
      { status: 502 },
    );
  }
}
