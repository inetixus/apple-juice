import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getProject,
  getProjectMessages,
  saveProjectMessages,
} from "@/lib/store";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = params.id;
  if (!projectId)
    return Response.json({ error: "Project ID required" }, { status: 400 });

  const url = new URL(_req.url);
  const chatIndex = parseInt(url.searchParams.get("index") || "0") || 0;

  const project = await getProject(projectId);
  if (!project || project.ownerUserId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await getProjectMessages(projectId, chatIndex);
  return Response.json({ messages });
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = params.id;
  if (!projectId)
    return Response.json({ error: "Project ID required" }, { status: 400 });

  const url = new URL(req.url);
  const chatIndex = parseInt(url.searchParams.get("index") || "0") || 0;

  const project = await getProject(projectId);
  if (!project || project.ownerUserId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  if (!Array.isArray(body.messages)) {
    return Response.json({ error: "Invalid messages format" }, { status: 400 });
  }

  await saveProjectMessages(projectId, body.messages, chatIndex);
  return Response.json({ ok: true });
}
