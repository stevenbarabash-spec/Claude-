// Increment the WARROOM version in lib/config.ts.
// Scheme: 2.<minor>.<build> — build runs 1→100, then rolls to the next minor
// (2.1.100 → 2.2.1). A 2-part version (e.g. 2.1) starts the build at .1.
// Run on every build (the CI does this; run manually before a manual deploy).
import fs from "fs";

const path = "lib/config.ts";
const src = fs.readFileSync(path, "utf8");
const m = src.match(/version:\s*"v?([0-9]+(?:\.[0-9]+)*)"/);
if (!m) {
  console.error("version not found in lib/config.ts");
  process.exit(1);
}

const parts = m[1].split(".").map(Number);
let [maj, min, build] = parts;
if (build === undefined) {
  build = 1; // 2.1 → 2.1.1
} else if (build < 100) {
  build += 1; // 2.1.5 → 2.1.6
} else {
  min += 1; // 2.1.100 → 2.2.1
  build = 1;
}

const next = `v${maj}.${min}.${build}`;
fs.writeFileSync(path, src.replace(/version:\s*"v?[0-9.]+"/, `version: "${next}"`));
console.log(next);
