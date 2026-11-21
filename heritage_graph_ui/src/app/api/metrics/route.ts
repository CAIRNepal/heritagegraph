import { type NextRequest } from "next/server";
import { Counter, Registry, collectDefaultMetrics } from "prom-client";

declare global {
  // eslint-disable-next-line no-var
  var __heritagegraph_prom_registry: Registry | undefined;
  // eslint-disable-next-line no-var
  var __heritagegraph_prom_scrapes_total: Counter<string> | undefined;
}

function getRegistry() {
  if (!globalThis.__heritagegraph_prom_registry) {
    const registry = new Registry();
    collectDefaultMetrics({ register: registry });
    globalThis.__heritagegraph_prom_registry = registry;
  }

  if (!globalThis.__heritagegraph_prom_scrapes_total) {
    globalThis.__heritagegraph_prom_scrapes_total = new Counter({
      name: "heritagegraph_ui_metrics_scrapes_total",
      help: "Total number of Prometheus scrapes of /api/metrics.",
      registers: [globalThis.__heritagegraph_prom_registry],
    });
  }

  return {
    registry: globalThis.__heritagegraph_prom_registry,
    scrapesTotal: globalThis.__heritagegraph_prom_scrapes_total,
  };
}

export async function GET(_req: NextRequest) {
  const { registry, scrapesTotal } = getRegistry();
  scrapesTotal.inc();

  return new Response(await registry.metrics(), {
    status: 200,
    headers: {
      "Content-Type": registry.contentType,
      "Cache-Control": "no-store",
    },
  });
}

