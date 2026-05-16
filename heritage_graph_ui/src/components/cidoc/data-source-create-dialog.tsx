"use client";

import { useCallback, useEffect, useState } from "react";

import OntologyForm from "@/components/ontology-form";
import { OntologyUnavailablePanel } from "@/components/ontology/OntologyUnavailablePanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchDataSourcePickerLabel } from "@/lib/kg-proposal-hydrate";
import { getPublicApiUrl } from "@/lib/api-base";
import { useOntology } from "@/lib/ontology/OntologyProvider";

interface DataSourceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null | undefined;
  onCreated: (uuid: string, label: string) => void;
}

export function DataSourceCreateDialog({
  open,
  onOpenChange,
  token,
  onCreated,
}: DataSourceCreateDialogProps) {
  const { getOntologyClass } = useOntology();
  const cls = getOntologyClass("data_source");
  const [formInstanceKey, setFormInstanceKey] = useState(0);

  useEffect(() => {
    if (open) setFormInstanceKey((k) => k + 1);
  }, [open]);

  const handleContributionCreated = useCallback(
    ({ id }: { id: string }) => {
      void (async () => {
        const base = getPublicApiUrl();
        const label = token
          ? await fetchDataSourcePickerLabel(token, base, id)
          : id;
        onCreated(id, label);
        onOpenChange(false);
      })();
    },
    [onCreated, onOpenChange, token]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,920px)] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>New data source</DialogTitle>
          <DialogDescription>
            Evidence record (for proposals). Submits to the same review queue as other CIDOC
            contributions.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {!cls ? (
            <OntologyUnavailablePanel variant="contribute" missingKey="data_source" />
          ) : (
            <OntologyForm
              key={formInstanceKey}
              ontologyClass={cls}
              embeddedCreateOnly
              onContributionCreated={handleContributionCreated}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
