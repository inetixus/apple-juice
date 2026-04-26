import { getRedis } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { key, tree } = await req.json();
    if (!key || typeof tree !== "string") {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    
    const redis = getRedis();
    // Store the project tree under this session key, expires in 1 hour
    await redis.set(`tree:${key}`, tree, { ex: 60 * 60 });
    
    return Response.json({ success: true });
  } catch (error) {
    console.error("Tree sync error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
