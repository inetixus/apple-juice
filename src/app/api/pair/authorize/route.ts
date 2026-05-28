import { getRedis, ipKeyFor } from "@/lib/store";

/**
 * POST /api/pair/authorize
 * 
 * Allows a user to manually link an IP address to their session.
 * Used as a fallback when auto-pairing via IP fails.
 */
export async function POST(req: Request) {
  try {
    const { sessionKey, ip } = await req.json();

    if (!sessionKey || !ip) {
      return Response.json({ error: "Missing sessionKey or ip" }, { status: 400 });
    }

    const redis = getRedis();
    
    // Link the IP to this session key
    await redis.set(ipKeyFor(ip), sessionKey, { ex: 3600 });
    
    // Also remove from pending list
    await redis.srem("apple-juice:pending-ips", ip);

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
