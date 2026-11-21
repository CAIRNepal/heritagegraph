"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectToEntityForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/contribute/entity?${q}` : "/contribute/entity");
  }, [router, searchParams]);

  return (
    <div className="py-8 text-center text-sm text-muted-foreground">Redirecting…</div>
  );
}

export default function CulturalEntityAliasPage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      }
    >
      <RedirectToEntityForm />
    </Suspense>
  );
}
