"use client";

/**
 * Pattern routes remain for bookmarks / deep links from older emails,
 * but we no longer promote them on the contribute hub. Send people to the
 * simple “Add something new” flow instead of a multi-step ontology wizard.
 */
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ContributePatternRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  useEffect(() => {
    // Preserve a soft breadcrumb via hash so support can still see which pattern was requested.
    const hash = slug ? `#was-pattern-${encodeURIComponent(slug)}` : "";
    router.replace(`/contribute${hash}`);
  }, [router, slug]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <p>Taking you to the simple contribute page…</p>
    </div>
  );
}
