/**
 * Copy Cesium static assets (Workers, Assets, Widgets, ThirdParty) into public/cesium
 * so the browser can load them at runtime via window.CESIUM_BASE_URL = '/cesium'.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcRoot = path.join(root, "node_modules", "cesium", "Build", "Cesium");
const destRoot = path.join(root, "public", "cesium");
const subdirs = ["Workers", "Assets", "Widgets", "ThirdParty"];

async function main() {
  try {
    await fs.access(srcRoot);
  } catch {
    console.error(
      "[copy-cesium-assets] ERROR: Cesium build folder not found at",
      srcRoot,
      "(run npm install in heritage_graph_ui).",
    );
    process.exit(1);
  }

  for (const name of subdirs) {
    const from = path.join(srcRoot, name);
    try {
      await fs.access(from);
    } catch {
      console.error(
        "[copy-cesium-assets] ERROR: Missing Cesium subdirectory:",
        from,
      );
      process.exit(1);
    }
  }

  await fs.rm(destRoot, { recursive: true, force: true });
  await fs.mkdir(destRoot, { recursive: true });

  for (const name of subdirs) {
    const from = path.join(srcRoot, name);
    const to = path.join(destRoot, name);
    await fs.cp(from, to, { recursive: true });
  }

  for (const name of subdirs) {
    const to = path.join(destRoot, name);
    const entries = await fs.readdir(to);
    if (entries.length === 0) {
      console.error(
        `[copy-cesium-assets] ERROR: Destination ${name} is empty after copy.`,
      );
      process.exit(1);
    }
  }

  const workersDir = path.join(destRoot, "Workers");
  const workerFiles = await fs.readdir(workersDir);
  const hasWorkerJs = workerFiles.some((f) => f.endsWith(".js"));
  if (!hasWorkerJs) {
    console.error(
      "[copy-cesium-assets] ERROR: No .js worker bundles found under public/cesium/Workers.",
    );
    process.exit(1);
  }

  console.log("[copy-cesium-assets] Copied to public/cesium/");
}

main().catch((err) => {
  console.error("[copy-cesium-assets]", err);
  process.exit(1);
});
