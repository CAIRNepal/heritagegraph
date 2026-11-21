"use client";

import React, { useMemo, useState } from "react";
import { Quote, Copy, Check } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const PUBLISHER = "HeritageGraph (CAIR-Nepal)";
const LICENSE_LABEL = "CC BY 4.0";
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

function yearOf(s?: string): number {
  if (s) {
    const y = new Date(s).getFullYear();
    if (!Number.isNaN(y)) return y;
  }
  return new Date().getFullYear();
}

function bibtexKey(title: string, id: string): string {
  const slug = (title || "entity").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16);
  return `heritagegraph_${slug || "entity"}_${id}`.replace(/[^a-zA-Z0-9_]/g, "");
}

interface CiteEntityDialogProps {
  title: string;
  typeLabel: string;
  authors?: string[];
  date?: string;
  id: string;
  trigger?: React.ReactNode;
}

export function CiteEntityDialog({
  title,
  typeLabel,
  authors = [],
  date,
  id,
  trigger,
}: CiteEntityDialogProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const url = useMemo(
    () => (typeof window !== "undefined" ? window.location.href.split("#")[0] : ""),
    [],
  );
  const year = yearOf(date);
  const authorList = authors.filter(Boolean);
  const authorStr = authorList.length ? authorList.join(" and ") : "HeritageGraph contributors";

  const formats = useMemo(() => {
    const bibtex = `@misc{${bibtexKey(title, id)},
  title        = {${title}},
  author       = {${authorStr}},
  year         = {${year}},
  howpublished = {${PUBLISHER}},
  note         = {${typeLabel}. Licensed under ${LICENSE_LABEL}},
  url          = {${url}}
}`;

    const ris = [
      "TY  - DATA",
      `TI  - ${title}`,
      ...(authorList.length ? authorList : ["HeritageGraph contributors"]).map((a) => `AU  - ${a}`),
      `PY  - ${year}`,
      `PB  - ${PUBLISHER}`,
      `KW  - ${typeLabel}`,
      `UR  - ${url}`,
      `M2  - Licensed under ${LICENSE_LABEL}`,
      "ER  - ",
    ].join("\n");

    const jsonld = JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "@id": url,
        name: title,
        additionalType: typeLabel,
        url,
        datePublished: String(year),
        publisher: { "@type": "Organization", name: "CAIR-Nepal" },
        license: LICENSE_URL,
        creator: (authorList.length ? authorList : ["HeritageGraph contributors"]).map((a) => ({
          "@type": "Person",
          name: a,
        })),
      },
      null,
      2,
    );

    return { bibtex, ris, jsonld };
  }, [title, id, authorStr, authorList, year, typeLabel, url]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  };

  const block = (key: string, text: string) => (
    <div className="relative">
      <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </pre>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="absolute right-2 top-2 h-7 gap-1"
        onClick={() => copy(key, text)}
      >
        {copied === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied === key ? "Copied" : "Copy"}
      </Button>
    </div>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost">
            <Quote className="mr-1 h-3.5 w-3.5" /> Cite
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cite this entity</DialogTitle>
          <DialogDescription>
            Reusable under{" "}
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {LICENSE_LABEL}
            </a>{" "}
            with attribution. Copy a citation in your preferred format.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="bibtex">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bibtex">BibTeX</TabsTrigger>
            <TabsTrigger value="ris">RIS</TabsTrigger>
            <TabsTrigger value="jsonld">JSON-LD</TabsTrigger>
          </TabsList>
          <TabsContent value="bibtex" className="mt-3">
            {block("bibtex", formats.bibtex)}
          </TabsContent>
          <TabsContent value="ris" className="mt-3">
            {block("ris", formats.ris)}
          </TabsContent>
          <TabsContent value="jsonld" className="mt-3">
            {block("jsonld", formats.jsonld)}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
