import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProject, getProjectMessages, saveProjectMessages } from "@/lib/store";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = params.id;
  if (!projectId) return Response.json({ error: "Project ID required" }, { status: 400 });

  const project = await getProject(projectId);
  if (!project || project.ownerUserId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await getProjectMessages(projectId);
  return Response.json({ messages });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = params.id;
  if (!projectId) return Response.json({ error: "Project ID required" }, { status: 400 });

  const project = await getProject(projectId);
  if (!project || project.ownerUserId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  if (!Array.isArray(body.messages)) {
    return Response.json({ error: "Invalid messages format" }, { status: 400 });
  }

  await saveProjectMessages(projectId, body.messages);
  return Response.json({ ok: true });
}
