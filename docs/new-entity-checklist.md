# New Entity Checklist

Step-by-step guide for adding a new CIDOC entity type to HeritageGraph.  
Follow steps in order — each step depends on the previous one.

> **Example:** Throughout this guide `ArtifactType` is used as a placeholder. Replace it with your actual model name (PascalCase).

---

## 1. LinkML class (ontology first)

Add the new class and its slots to `ontology/HeritageGraph.yaml`:

```yaml
ArtifactType:
  class_uri: crm:E22_Human-Made_Object   # pick the correct CIDOC URI
  description: "…"
  slots:
    - name
    - description
    # … add domain-specific slots
```

Add any new enum values needed under `enums:` in the same file.

---

## 2. Django model

Add the model to `heritage_graph/apps/cidoc_data/models.py`.

- Inherit from `MetaData` (shared audit fields) unless you have a strong reason not to.
- Add choice-tuple constants near the top of the file if you need `choices=` on a field.
- Add a `GenericRelation` to `HeritageAssertion` if the entity should be assertable:

```python
from django.contrib.contenttypes.fields import GenericRelation

class ArtifactType(MetaData):
    name = models.CharField(max_length=200)
    # … fields
    assertions = GenericRelation(
        "HeritageAssertion",
        content_type_field="content_type",
        object_id_field="object_id",
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Artifact Type"
        verbose_name_plural = "Artifact Types"

    def __str__(self):
        return self.name
```

Update `assertable_model_names()` in `identity_validation.py` if the model participates in identity clustering.

---

## 3. Migration

```bash
make migrations   # creates the migration file
make migrate      # applies it to the dev DB
```

Review the generated migration before committing.

---

## 4. Registry key

Add a row to `DJANGO_MODEL_TO_REGISTRY_CLASS_KEY` in  
`heritage_graph/apps/cidoc_data/cidoc_registry_keys.py`:

```python
"ArtifactType": "artifact_type",
```

The value (`"artifact_type"`) becomes the registry key used everywhere else.

---

## 5. Classmap entry

Add an entry to `tools/ui-classmap.yaml`:

```yaml
- linkml: ArtifactType
  key: artifact_type
  apiEndpoint: /cidoc/artifact_types/
  label: Artifact Type
  labelPlural: Artifact Types
  navigable: true
  category: tangible      # matches a hubCategory key in contribute-hub.yaml
  icon: box               # any lucide icon name
```

`apiEndpoint` must match the URL you register in step 8 below.

---

## 6. Serializer (regenerate)

```bash
make serializers
```

This writes a `ArtifactTypeGeneratedSerializer` stub to  
`heritage_graph/apps/cidoc_data/serializers.generated.py`.

If you need custom field logic (e.g. nested relations, read-only computed fields),
copy the stub into `serializers.py` and rename it `ArtifactTypeSerializer`,
then add `CulturalEntityLinkMixin` as needed:

```python
class ArtifactTypeSerializer(CulturalEntityLinkMixin, BaseRegistrySerializer):
    class Meta:
        model = ArtifactType
        fields = "__all__"
```

Import the hand-written version from `serializers.py` in your ViewSet (step 7).

---

## 7. ViewSet

Add to `heritage_graph/apps/cidoc_data/views.py`:

```python
class ArtifactTypeViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = ArtifactType.objects.all()
    serializer_class = ArtifactTypeSerializer   # or ArtifactTypeGeneratedSerializer
    search_fields = ["name"]
```

`ContributionFlowMixin` (already used by all CIDOC viewsets) provides
permission gating and the LinkML JSON Schema validation hook.

---

## 8. Router

Register in `heritage_graph/apps/cidoc_data/urls.py`:

```python
router.register(r'artifact_types', ArtifactTypeViewSet)
```

The prefix (`artifact_types`) must match `apiEndpoint` in the classmap minus the `/cidoc/` prefix.

---

## 9. Hub intent

Add an entry to `tools/contribute-hub.yaml` so the entity appears in the Contribute hub:

```yaml
- registryKey: artifact_type
  hubCategory: tangible           # must match a key in hubCategories
  route: /contribute/artifact-type
  emoji: "📦"
  shortDescription: "Manufactured objects and artifacts"
  description: "Document a heritage artifact with its materials, provenance, and condition."
  difficulty: beginner            # beginner | intermediate | advanced
```

---

## 10. Regenerate ontology assets

```bash
make generate
```

This runs the full pipeline: ontology → serializers → entityrefs → schema-rebuild. It regenerates `registry.generated.json`/`.ts`, `serializers.generated.py`, and persists the DB snapshot.

> **CI enforcement**: GitHub Actions runs `make check` on any ontology or serializer file change to ensure generated files stay in sync.

---

## 11. Admin registration

Register the model in `heritage_graph/apps/cidoc_data/admin.py`:

```python
@admin.register(ArtifactType)
class ArtifactTypeAdmin(admin.ModelAdmin):
    list_display = ["name", "created_at"]
    search_fields = ["name"]
```

---

## 12. Tests

Add at least a basic CRUD smoke test in `heritage_graph/apps/cidoc_data/tests.py`:

```python
class ArtifactTypeAPITest(APITestCase):
    def test_list(self):
        ArtifactType.objects.create(name="Test Artifact")
        resp = self.client.get("/cidoc/artifact_types/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["results"]), 1)
```

---

## Quick checklist

| # | Task | File(s) |
|---|------|---------|
| 1 | LinkML class + slots | `ontology/HeritageGraph.yaml` |
| 2 | Django model | `cidoc_data/models.py` |
| 3 | Migration | `make migrations && make migrate` |
| 4 | Registry key | `cidoc_data/cidoc_registry_keys.py` |
| 5 | Classmap entry | `tools/ui-classmap.yaml` |
| 6 | Serializer | `make serializers` (or hand-write in `serializers.py`) |
| 7 | ViewSet | `cidoc_data/views.py` |
| 8 | Router | `cidoc_data/urls.py` |
| 9 | Hub intent | `tools/contribute-hub.yaml` |
| 10 | Regenerate assets | `make ontology` |
| 11 | Admin | `cidoc_data/admin.py` |
| 12 | Tests | `cidoc_data/tests.py` |
