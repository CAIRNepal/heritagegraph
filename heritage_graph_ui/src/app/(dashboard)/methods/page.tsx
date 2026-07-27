import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  DANAM_NQ_SHA256,
  HERITAGEGRAPH_CITATION,
  HERITAGEGRAPH_DOI,
  HERITAGEGRAPH_PUBLIC_GRAPH,
  HERITAGEGRAPH_RELEASE,
  LICENSE_MATRIX,
} from '@/lib/provenance';

export const metadata = {
  title: 'Methods · HeritageGraph',
  description:
    'Methods, provenance, FAIR/CARE compliance, and reproducibility for the HeritageGraph cultural heritage knowledge graph.',
};

export default function MethodsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          HeritageGraph · Nature-rigor documentation
        </p>
        <h1 className="font-serif text-3xl font-semibold text-foreground">Methods &amp; data</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This page documents how HeritageGraph builds, reviews, and publishes a CIDOC-CRM-aligned
          knowledge graph for interactive exploration in the Heritage Museum and via SPARQL — at
          the evidentiary standard expected for a Nature-family methods / data descriptor section.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-foreground">Software release</h2>
        <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-2 text-sm">
          <dt className="text-muted-foreground">Version</dt>
          <dd className="font-mono">{HERITAGEGRAPH_RELEASE}</dd>
          <dt className="text-muted-foreground">DOI</dt>
          <dd className="font-mono break-all">{HERITAGEGRAPH_DOI}</dd>
          <dt className="text-muted-foreground">Code license</dt>
          <dd>MIT</dd>
          <dt className="text-muted-foreground">Data license</dt>
          <dd>CC BY 4.0 curated overlay; third-party layers retain upstream licenses (see matrix)</dd>
        </dl>
        <pre className="rounded-lg border border-border bg-muted/40 p-3 text-xs overflow-x-auto whitespace-pre-wrap">
          {HERITAGEGRAPH_CITATION}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-foreground">FAIR + CARE</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1.5">
          <li>
            <span className="text-foreground font-medium">Findable</span> — w3id resource IRIs;
            VoID/DCAT dataset description; corpus fingerprint (
            <code className="text-xs">manage.py corpus_fingerprint</code>).
          </li>
          <li>
            <span className="text-foreground font-medium">Accessible</span> — HTTPS dereference +
            CARE-aware read-only SPARQL (<code className="text-xs">/sparql/</code>).
          </li>
          <li>
            <span className="text-foreground font-medium">Interoperable</span> — CIDOC-CRM, CRMinf,
            LinkML registry, CRM bridge, SHACL shapes, SKOS vocabularies.
          </li>
          <li>
            <span className="text-foreground font-medium">Reusable</span> — license matrix below;
            frozen L0 dump with SHA-256; idempotent L1 ETL; ontology pin in import reports.
          </li>
          <li>
            <span className="text-foreground font-medium">CARE</span> —{' '}
            <code className="text-xs">access_tier</code> / TK labels on sources; sensitive tiers
            filtered by the SPARQL proxy; new human claims remain review-gated.
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Full machine-readable checklist:{' '}
          <code className="text-xs">documentation/research/NATURE_KG_RIGOR.md</code>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-foreground">License matrix</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-2 font-medium">Layer</th>
                <th className="p-2 font-medium">License</th>
                <th className="p-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {LICENSE_MATRIX.map((row) => (
                <tr key={row.layer} className="border-b border-border last:border-0">
                  <td className="p-2 align-top text-foreground">{row.layer}</td>
                  <td className="p-2 align-top font-mono text-xs">{row.license}</td>
                  <td className="p-2 align-top text-muted-foreground">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-foreground">Ontology &amp; graph model</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1.5">
          <li>
            Schema: LinkML registry from <code className="text-xs">ontology/HeritageGraph.yaml</code>{' '}
            (CIDOC-CRM bridge, SHACL shapes, SKOS vocabularies).
          </li>
          <li>
            Published instances live in named graph{' '}
            <code className="text-xs break-all">{HERITAGEGRAPH_PUBLIC_GRAPH}</code>.
          </li>
          <li>
            Museum live view: SPARQL projection via{' '}
            <code className="text-xs">GET /api/v1/cidoc/kg/graph/?scope=reviewed</code> — nodes
            typed by <code className="text-xs">rdf:type</code>, edges are asserted triples (not
            client-side heuristics).
          </li>
          <li>
            External Yale LUX bulk import stays in <code className="text-xs">imported/lux</code>;
            only entities linked via <code className="text-xs">skos:exactMatch</code> appear in the
            museum (linkset model — not merged into the public partition).
          </li>
          <li>
            Large research dumps (DANAM-aligned N-Quads) use a two-layer policy: frozen L0 named
            graphs for citation/SPARQL, plus curated Postgres L1 materialization into{' '}
            <code className="text-xs">graph/public</code>. See{' '}
            <code className="text-xs">documentation/research/DANAM_CORPUS_INTEGRATION_REPORT.md</code>.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-foreground">DANAM corpus pin</h2>
        <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-2 text-sm">
          <dt className="text-muted-foreground">Dump</dt>
          <dd className="font-mono text-xs break-all">data/reconciled/danam-heritagegraph.nq</dd>
          <dt className="text-muted-foreground">SHA-256</dt>
          <dd className="font-mono text-xs break-all">{DANAM_NQ_SHA256}</dd>
          <dt className="text-muted-foreground">L0 load</dt>
          <dd>
            <code className="text-xs">manage.py rdf_load_imported_nq</code> (never writes PUBLIC)
          </dd>
          <dt className="text-muted-foreground">L1 ETL</dt>
          <dd>
            <code className="text-xs">manage.py import_danam_nq</code> (idempotent by external IRI)
          </dd>
          <dt className="text-muted-foreground">Competency SPARQL</dt>
          <dd>
            <code className="text-xs">documentation/research/competency_queries.sparql</code>
          </dd>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-foreground">Publication pipeline</h2>
        <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1.5">
          <li>Contributions saved in Django (cultural entities, CIDOC metadata, relationship assertions).</li>
          <li>Epistemic review: only accepted / merged / published rows pass the publication policy.</li>
          <li>
            <code className="text-xs">kg_publish</code> / <code className="text-xs">rdf_rebuild</code>{' '}
            projects triples to Oxigraph; provenance partition records agent + source.
          </li>
          <li>
            Integrity gate: <code className="text-xs">kg_rigor_audit</code> (namespace, connectivity,
            pollution, L0 isolation, provenance coverage). Use{' '}
            <code className="text-xs">--strict</code> for release.
          </li>
          <li>
            Evaluation (optional): <code className="text-xs">kg_evaluate</code> against a gold-standard
            fixture (precision / recall / F1).
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-foreground">Limitations</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1.5">
          <li>Corpus size is community-curated and growing — not a complete national inventory.</li>
          <li>Temporal coverage (EDTF) is incomplete on many event nodes.</li>
          <li>External identifier reconciliation (Wikidata / Getty) is in progress beyond DANAM sameAs.</li>
          <li>Demo corpus in the museum is illustrative only; cite the live reviewed graph for research.</li>
          <li>
            Zenodo DOI is a placeholder until the first tagged deposit; pin the SHA-256 above for
            interim citation of the DANAM dump.
          </li>
          <li>
            SHACL-on-write is opt-in (<code className="text-xs">RDF_SHACL_VALIDATE_ON_WRITE</code>);
            shapes are generated and available for offline conformance reports.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-foreground">LUX attribution</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Yale University Art Gallery LUX data is used under its terms as a linked external authority.
          HeritageGraph stores stubs in <code className="text-xs">imported/lux</code> and links curated
          entities with <code className="text-xs">skos:exactMatch</code>; Yale IRIs are not served as an
          isolated dump in the museum view.
        </p>
      </section>

      <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
        <Button asChild variant="default" size="sm">
          <Link href="/heritage-museum?source=live">Open Heritage Museum (live)</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/about">About HeritageGraph</Link>
        </Button>
      </div>
    </div>
  );
}
