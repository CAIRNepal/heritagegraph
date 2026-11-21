/**
 * Sanity check for semantic form graph + JSON-LD (run from heritage_graph_ui):
 *   npm run verify:form-graph
 */
import type { OntologyClass } from "../src/lib/ontology/types";
import {
  deriveFormGraph,
  formGraphToJsonLd,
  linkmlRangeToResourceSegment,
  registryKeyToResourceSegment,
} from "../src/lib/ontology/form-graph";

const personStub = {
  key: "person",
  label: "Person",
  labelPlural: "Persons",
  description: "",
  apiEndpoint: "/cidoc/persons/",
  classUri: "crm:E21_Person",
  fields: [
    {
      key: "name",
      label: "Name",
      type: "text" as const,
      slot_uri: "rdfs:label",
      required: true,
    },
    {
      key: "associated_place",
      label: "Place",
      type: "relation" as const,
      relationTo: "Place",
      slot_uri: "crm:P129i_is_subject_of",
      multivalued: false,
      relationEndpoint: "/cidoc/locations/",
    },
  ],
  columns: [],
} satisfies OntologyClass;

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function main() {
  if (registryKeyToResourceSegment("person") !== "person") {
    fail("Expected registryKeyToResourceSegment(person) === person");
  }
  if (linkmlRangeToResourceSegment("Place") !== "location") {
    fail("Expected Place → location segment for RDF URI");
  }
  if (linkmlRangeToResourceSegment("TimeSpan") !== null) {
    fail("Expected TimeSpan → null");
  }

  const base = "https://example.test/resource";
  const graph = deriveFormGraph({
    ontologyClass: personStub,
    formData: {
      name: "Test Person",
      associated_place: { id: 7, name: "KTM" },
    },
    draftLocalId: "fixture-draft",
    resourceBase: base,
    rootLabel: "Test Person",
  });

  if (!graph.rootUri.endsWith("/person/draft-fixture-draft")) {
    fail(`Unexpected root URI: ${graph.rootUri}`);
  }

  const edgeToPlace = graph.edges.find(
    (e) =>
      e.objectUri != null &&
      e.objectUri === `${base}/location/7` &&
      e.predicate.includes("P129")
  );
  if (!edgeToPlace) {
    fail("Expected CRM edge to merged location URI");
  }

  const jsonLd = formGraphToJsonLd(graph, personStub, base);
  if (typeof jsonLd["@context"] !== "object" || jsonLd["@context"] == null) {
    fail("JSON-LD missing @context");
  }
  const rootJson =
    Array.isArray(jsonLd["@graph"]) &&
    (jsonLd["@graph"] as Record<string, unknown>[]).length > 0
      ? ((jsonLd["@graph"] as Record<string, unknown>[]).find(
          (n) => n["@id"] === graph.rootUri
        ) ??
        (jsonLd["@graph"] as Record<string, unknown>[])[0])
      : jsonLd;
  const rootAtId = rootJson?.["@id"];
  if (
    typeof rootAtId !== "string" ||
    !(rootAtId as string).includes("/person/")
  ) {
    fail("JSON-LD root @id malformed");
  }
  const t = rootJson?.["@type"];
  if (
    typeof t !== "string" ||
    !(t === "crm:E21_Person" || (t as string).includes("E21"))
  ) {
    fail(`JSON-LD @type unexpected: ${String(t)}`);
  }

  console.log("verify-form-graph: ok");
}

main();
