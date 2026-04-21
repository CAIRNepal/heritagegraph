"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOntology } from "@/lib/ontology/OntologyProvider";

type Props = {
  /** Contribute uses `/contribute/<key>`; knowledge uses `/knowledge/<domain>/...` */
  variant: "contribute" | "knowledge";
  /** Registry key / domain segment that has no OntologyClass */
  missingKey: string;
};

/**
 * Shown when the YAML-driven registry has no definition for an entity type.
 * Explains what failed, likely causes, and practical next steps for users vs maintainers.
 */
export function OntologyUnavailablePanel({ variant, missingKey }: Props) {
  const { degraded, degradedReason, reload } = useOntology();
  const router = useRouter();

  const contextLine =
    variant === "contribute"
      ? "Contribution forms are built from the ontology registry (LinkML and class map → generated files, with an optional live refresh from the API when you are signed in)."
      : "Record pages use the ontology registry to decide which fields exist and how to load data from the API.";

  const whyBullets: string[] = [];
  if (degradedReason === "snapshot") {
    whyBullets.push(
      "The live schema registry could not be loaded, so the app fell back to the bundled snapshot. That snapshot may be older than the server, or it may not list every route."
    );
  } else if (degradedReason === "unauthenticated") {
    whyBullets.push(
      "You are not signed in, so the app only uses the bundled ontology snapshot—not the latest copy from the server."
    );
  } else if (degradedReason === "unconfigured_api") {
    whyBullets.push(
      "The app is not configured with a public API URL, so it cannot fetch the live registry—only the bundled snapshot is available."
    );
  }
  whyBullets.push(
    "The registry that is currently loaded does not define this entity key. That often means the URL is wrong, or the type was never added to the YAML-driven pipeline (or was removed from the class map)."
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 md:p-8">
      <Alert
        variant="default"
        className="border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30"
      >
        <AlertCircle className="text-amber-700 dark:text-amber-400" />
        <AlertTitle className="text-amber-950 dark:text-amber-100">
          This form can&apos;t be loaded from the ontology schema
        </AlertTitle>
        <AlertDescription className="text-amber-950/90 dark:text-amber-100/90">
          <p className="font-medium text-foreground">
            The app is working, but it does not have a schema-driven definition for{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {missingKey}
            </code>
            , so the form cannot be shown safely.
          </p>
        </AlertDescription>
      </Alert>

      <div className="space-y-4 text-sm text-muted-foreground">
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">What is happening</h3>
          <p>{contextLine}</p>
          <p>
            The loaded registry has no class entry for{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
              {missingKey}
            </code>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">Why this can happen</h3>
          <ul className="list-disc space-y-1.5 pl-5">
            {whyBullets.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
            {degraded ? (
              <li>
                A degraded registry flag is set ({degradedReason ?? "unknown"}), which can
                narrow what the UI can offer compared to a fully healthy deployment.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">What you can try</h3>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Retry</strong> using the button below (temporary network or server
              issues sometimes resolve on a second load).
            </li>
            <li>
              <strong>Sign in with Google</strong> if you are not signed in, so the app
              can request the latest registry from the API.
            </li>
            {variant === "contribute" ? (
              <li>
                Open <strong>Contribute</strong> from the hub so you only pick types that
                are registered for contribution.
              </li>
            ) : (
              <li>
                Use the sidebar to open a knowledge type that appears in the menu, or
                return to the dashboard.
              </li>
            )}
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="default" size="sm" onClick={() => void reload()}>
              Retry loading schema
            </Button>
            {variant === "contribute" ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/contribute">Back to Contribute</Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push("/")}
              >
                Back to dashboard
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-md border border-border bg-muted/40 p-4 text-xs leading-relaxed">
          <p className="font-medium text-foreground">For developers and curators</p>
          <p className="mt-1">
            Add or restore a row in{" "}
            <code className="rounded bg-background px-1 font-mono">tools/ui-classmap.yaml</code>{" "}
            (and the LinkML class in{" "}
            <code className="rounded bg-background px-1 font-mono">ontology/HeritageGraph.yaml</code>{" "}
            if needed), run <code className="rounded bg-background px-1 font-mono">make ontology</code>
            , commit the updated{" "}
            <code className="rounded bg-background px-1 font-mono">registry.generated.*</code>
            , redeploy, and on the server run{" "}
            <code className="rounded bg-background px-1 font-mono">
              python manage.py rebuild_schema_registry
            </code>{" "}
            if you store the registry in the database.
          </p>
        </section>
      </div>
    </div>
  );
}
