import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createProject, listUserProjects, updateProject, deleteProject, getProject } from "@/lib/store";

/**
 * GET /api/projects — List all projects for the authenticated user
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await listUserProjects(userId);
  return Response.json({ projects });
}

/**
 * POST /api/projects — Create a new project
 * Body: { name: string }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = (body.name || "Untitled Project").trim().slice(0, 60);

  const project = await createProject(userId, name);
  return Response.json({ project });
}

/**
 * PATCH /api/projects — Update a project
 * Body: { id: string, name?: string, sessionKey?: string, provider?: string, model?: string }
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return Response.json({ error: "Project ID required" }, { status: 400 });

  // Verify ownership
  const project = await getProject(id);
  if (!project || project.ownerUserId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Only allow safe fields
  const safeUpdates: Record<string, unknown> = {};
  if (updates.name) safeUpdates.name = String(updates.name).trim().slice(0, 60);
  if (updates.sessionKey !== undefined) safeUpdates.sessionKey = updates.sessionKey;
  if (updates.provider) safeUpdates.provider = updates.provider;
  if (updates.model) safeUpdates.model = updates.model;

  const updated = await updateProject(id, safeUpdates);
  return Response.json({ project: updated });
}

/**
 * DELETE /api/projects — Delete a project
 * Body: { id: string }
 */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id } = body;
  if (!id) return Response.json({ error: "Project ID required" }, { status: 400 });

  // Verify ownership
  const project = await getProject(id);
  if (!project || project.ownerUserId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await deleteProject(userId, id);
  return Response.json({ ok: true });
}
