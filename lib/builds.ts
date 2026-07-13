// Build Console queue — feature requests submitted from inside WARROOM.
// Stored on the sentinel log. Each request can trigger a GitHub issue that the
// Claude GitHub app turns into a build; the log tracks status.
import { getStore } from "./store";
import { GOALS_SENTINEL_DATE, type BuildRequest } from "./types";

const MAX = 60;

export async function listBuilds(): Promise<BuildRequest[]> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  return log?.notes.builds ?? [];
}

async function save(builds: BuildRequest[]): Promise<void> {
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { builds: builds.slice(0, MAX) });
}

export async function addBuild(text: string): Promise<{ build: BuildRequest; builds: BuildRequest[] }> {
  const builds = await listBuilds();
  const build: BuildRequest = {
    id: crypto.randomUUID(),
    text: text.trim(),
    status: "requested",
    createdAt: new Date().toISOString(),
  };
  builds.unshift(build);
  await save(builds);
  return { build, builds };
}

export async function updateBuild(id: string, patch: Partial<BuildRequest>): Promise<BuildRequest[]> {
  const builds = (await listBuilds()).map((b) => (b.id === id ? { ...b, ...patch } : b));
  await save(builds);
  return builds;
}

// File the request as a GitHub issue so the Claude GitHub app can build it.
// Best-effort: needs GITHUB_TOKEN + GITHUB_REPO ("owner/name") in the env.
export async function fileBuildIssue(build: BuildRequest): Promise<{ issueUrl?: string; error?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return { error: "Build queued. Autonomous building needs GITHUB_TOKEN + GITHUB_REPO set (and the Claude GitHub app installed)." };
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: `[WARROOM build] ${build.text.slice(0, 70)}`,
        body: `@claude please implement this feature request from the WARROOM Build Console, then commit and open a PR (or push if configured for auto-ship):\n\n> ${build.text}\n\n_Submitted ${build.createdAt}_`,
        labels: ["warroom-build", "claude"],
      }),
    });
    if (!res.ok) return { error: `GitHub issue failed: ${res.status}` };
    const data = await res.json();
    return { issueUrl: data.html_url as string };
  } catch (err) {
    return { error: `GitHub issue error: ${String(err)}` };
  }
}
