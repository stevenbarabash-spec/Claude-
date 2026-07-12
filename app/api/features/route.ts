import { NextResponse } from "next/server";
import { addFeature, listFeatures, removeFeature, setFeatureStatus } from "@/lib/features";
import type { FeatureRequest } from "@/lib/types";

const STATUSES = ["new", "considering", "planned", "passed"];

export async function GET() {
  return NextResponse.json({ items: await listFeatures() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string; source?: FeatureRequest["source"] };
  if (!body.text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });
  const source = body.source === "claude" ? "claude" : "you";
  return NextResponse.json({ items: await addFeature(body.text, source) });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { id?: string; status?: FeatureRequest["status"] };
  if (!body.id || !body.status || !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "id + valid status required" }, { status: 400 });
  }
  return NextResponse.json({ items: await setFeatureStatus(body.id, body.status) });
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ items: await removeFeature(id) });
}
