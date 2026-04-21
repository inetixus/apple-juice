import { NextResponse } from "next/server";
import { consumeSession } from "../../../lib/store";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code")?.trim();

  if (!code) {
    return NextResponse.json({ hasNewCode: false });
  }

  const session = consumeSession(code);

  if (!session) {
    return NextResponse.json({ hasNewCode: false });
  }

  return NextResponse.json({
    hasNewCode: true,
    code: session.code,
    messageId: session.messageId,
  });
}