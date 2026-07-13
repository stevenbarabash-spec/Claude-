// Revert = redeploy the PREVIOUS production deployment's commit to production.
// Uses the same Vercel deploy API used to ship, so it's a reliable one-click
// undo. Needs VERCEL_TOKEN + VERCEL_PROJECT_ID (+ optional VERCEL_REPO_ID) env.
import { NextResponse } from "next/server";

const BUILD_PIN = process.env.WARROOM_BUILD_PIN || "1782";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { pin?: string };
  if (body.pin !== BUILD_PIN) return NextResponse.json({ error: "Wrong PIN." }, { status: 403 });

  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const repoId = process.env.VERCEL_REPO_ID;
  if (!token || !projectId) {
    return NextResponse.json(
      { error: "Revert needs VERCEL_TOKEN + VERCEL_PROJECT_ID in the env." },
      { status: 400 },
    );
  }
  const auth = { authorization: `Bearer ${token}` };
  try {
    const listRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=5&target=production&state=READY`,
      { headers: auth, cache: "no-store" },
    );
    const { deployments } = (await listRes.json()) as {
      deployments: { uid: string; meta?: { githubCommitSha?: string; githubCommitRef?: string }; name?: string }[];
    };
    // [0] is current live; [1] is the one to roll back to.
    const prev = deployments?.[1];
    const sha = prev?.meta?.githubCommitSha;
    if (!prev || !sha) {
      return NextResponse.json({ error: "No previous production deployment to revert to." }, { status: 409 });
    }
    const redeploy = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        name: prev.name || "claude",
        project: projectId,
        target: "production",
        gitSource: repoId
          ? { type: "github", repoId: Number(repoId), ref: sha }
          : { type: "github", ref: sha, repoId: undefined },
      }),
    });
    if (!redeploy.ok) {
      const t = await redeploy.text();
      return NextResponse.json({ error: `Revert deploy failed: ${redeploy.status} ${t.slice(0, 140)}` }, { status: 502 });
    }
    const d = await redeploy.json();
    return NextResponse.json({ ok: true, revertedTo: sha.slice(0, 7), deploymentId: d.id });
  } catch (err) {
    return NextResponse.json({ error: `Revert error: ${String(err)}` }, { status: 500 });
  }
}
