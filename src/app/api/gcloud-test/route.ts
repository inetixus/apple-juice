import { readFileSync } from 'fs';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const saPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
    if (!saPath) return NextResponse.json({ error: 'Missing GOOGLE_SERVICE_ACCOUNT_PATH' }, { status: 500 });

    const raw = readFileSync(saPath, 'utf8');
    const parsed = JSON.parse(raw);

    // only return non-sensitive metadata
    const meta = {
      type: parsed.type,
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      client_id: parsed.client_id,
    };

    return NextResponse.json({ ok: true, metadata: meta });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
