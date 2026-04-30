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
    console.warn(
      "[copy-cesium-assets] Skip: cesium Build folder not found (run npm install).",
    );
    return;
  }

  await fs.rm(destRoot, { recursive: true, force: true });
  await fs.mkdir(destRoot, { recursive: true });

  for (const name of subdirs) {
    const from = path.join(srcRoot, name);
    const to = path.join(destRoot, name);
    await fs.cp(from, to, { recursive: true });
  }

  console.log("[copy-cesium-assets] Copied to public/cesium/");
}

main().catch((err) => {
  console.error("[copy-cesium-assets]", err);
  process.exit(1);
});
