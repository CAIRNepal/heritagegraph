/**
 * Smoke-check that copy-cesium-assets populated public/cesium (workers + Assets).
 * Use after install/build or in CI before deploy sanity.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const cesiumPublic = path.join(root, "public", "cesium");
const sentinel = path.join(
  cesiumPublic,
  "Assets",
  "approximateTerrainHeights.json",
);

function main() {
  if (!fs.existsSync(sentinel)) {
    console.error(
      "[verify-cesium-public] Missing:",
      sentinel,
      "→ run npm run copy-cesium (or npm install / npm run build) in heritage_graph_ui.",
    );
    process.exit(1);
  }
  const workers = path.join(cesiumPublic, "Workers");
  if (!fs.existsSync(workers)) {
    console.error("[verify-cesium-public] Missing Workers directory:", workers);
    process.exit(1);
  }
  const workersFiles = fs.readdirSync(workers);
  const hasWorkerJs = workersFiles.some((f) => f.endsWith(".js"));
  if (!hasWorkerJs) {
    console.error(
      "[verify-cesium-public] No .js bundles under:",
      workers,
    );
    process.exit(1);
  }
  console.log("[verify-cesium-public] public/cesium looks OK.");
}

main();
