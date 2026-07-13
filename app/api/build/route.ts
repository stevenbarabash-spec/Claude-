import { NextResponse } from "next/server";
import { addBuild, fileBuildIssue, listBuilds, updateBuild } from "@/lib/builds";

const BUILD_PIN = process.env.WARROOM_BUILD_PIN || "1782";

export async function GET() {
  return NextResponse.json({ builds: await listBuilds() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string; pin?: string };
  if (body.pin !== BUILD_PIN) {
    return NextResponse.json({ error: "Wrong PIN." }, { status: 403 });
  }
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "Describe what to build." }, { status: 400 });
  }
  const { build, builds } = await addBuild(body.text);
  // Try to kick off the autonomous build via a GitHub issue.
  const { issueUrl, error } = await fileBuildIssue(build);
  const updated = await updateBuild(build.id, {
    status: issueUrl ? "building" : "requested",
    issueUrl,
    note: error,
  });
  return NextResponse.json({ builds: updated, issueUrl, note: error }, { status: 200 });
}
