  1. UI/UX Redesign — Robustness on the List and Detail Pages
  
  1.1 Skeleton Loading (List Page)

  Problem: page.tsx:155 shows <div>Loading projects…</div> — a plain text spinner is the worst user experience during the most common cold-load.

  Fix: Replace with ProjectCardSkeleton components that mirror the exact card shape:

  // src/components/projects/project-card-skeleton.tsx
  export function ProjectCardSkeleton() {
    return (
      <div className="rounded-2xl border bg-white/60 dark:bg-slate-900/60 p-5 animate-pulse space-y-3">
        <div className="flex justify-between">
          <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>
        <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="h-3 w-4/5 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="flex gap-4">
          <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  Render 4 of these in a sm:grid-cols-2 grid during loading. Total cost: ~30 lines.

  1.2 Pagination on the List

  Problem: listProjects fetches everything with /?ordering=-updated_at — at scale this is unbounded. The backend already returns { results: [...] } (DRF pagination format) but the frontend
  flattens it with Array.isArray(data) ? data : data.results ?? [].

  Fix (frontend): Switch listProjects to accept a page parameter and thread ?page=N into the URL. Add a simple "Load more" button below the grid — no page numbers needed for this use case.

  Fix (backend): Confirm ProjectViewSet uses PageNumberPagination with page_size = 20. If it uses the default unpaginated response, add pagination_class = StandardResultsSetPagination to the
   viewset. This is a one-line backend change.

  1.3 Optimistic State on Transitions

  Problem: [slug]/page.tsx:118–130 — handleTransition calls setProject(updated) only after the API resolves, so the button stays enabled and shows no intermediate feedback.

  Fix: Set a per-transition pending state immediately, disable all transition buttons during the call, and update the badge optimistically:

  // Immediately reflect the transition visually
  const optimisticBadge = PROJECT_STATE_LABELS[targetState] ?? targetState;
  setProject((prev) => prev ? { ...prev, state: targetState } : prev);
  // Roll back on error
  setProject(prev => prev ? { ...prev, state: project.state } : prev);

  The transitioning boolean already exists at line 91; extend it to a string | null holding the targetState so each button can show its own spinner.

  1.4 Form Validation on New Project

  Problem: new/page.tsx:53–56 validates only title and slug with a bare if check. The slug character rules, max-length enforcement, and uniqueness aren't surfaced until the server rejects
  the request.

  Fix — client-side field-level validation:

  const slugErrors: string[] = [];
  if (slug.length > 80) slugErrors.push("Max 80 characters.");
  if (!/^[a-z0-9-]+$/.test(slug)) slugErrors.push("Only lowercase letters, digits, and hyphens.");
  if (slug.startsWith("-") || slug.endsWith("-")) slugErrors.push("Cannot start or end with a hyphen.");

  Render these inline under the field with aria-describedby — no extra libraries needed. Block the submit button while errors exist.

  Fix — draft persistence: Save form state to sessionStorage on every change, restore on mount. This prevents losing a half-written project description on an accidental browser refresh.

  useEffect(() => {
    sessionStorage.setItem("project-draft", JSON.stringify({ title, slug, abstract, intendedSubject, visibility, tagsRaw }));
  }, [title, slug, abstract, intendedSubject, visibility, tagsRaw]);

  Clear on successful submit.

  1.5 Empty State — Discovery vs. Zero State

  The current empty state page.tsx:159–166 shows only "You have no projects yet." There is no way to discover public projects or see what others are working on.

  Add a "Public Projects" tab at the top of the list:

  [ My Projects ] [ Public Projects ]

  Public Projects hits a new endpoint GET /api/v1/data/projects/?visibility=public (no auth required, filtered queryset). This is the face of the project — showing community work here makes
  the page feel alive, not empty.

  ---
  2. Project-Based Contribution Workflow

  2.1 Contribution Types Supported

  The ProjectAsset model handles files; ProjectEntity links ontology entities. The full contribution workflow is:

  ┌───────────────────────────────┬──────────────────────────────────────────────────────┬──────────────────────────────────────────────┐
  │       Contribution Type       │                  Current Mechanism                   │                     Gap                      │
  ├───────────────────────────────┼──────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ Evidence files (photos, PDFs) │ ProjectAssetUploader — drag-drop, role, caption, OCR │ File type validation is backend-only         │
  ├───────────────────────────────┼──────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ Ontology entities             │ "Add Entity" redirects to /contribute?project=<slug> │ No in-project entity creation modal          │
  ├───────────────────────────────┼──────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ Textual annotations           │ Comments tab                                         │ No structured annotation on a specific asset │
  ├───────────────────────────────┼──────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ Bulk tabular data             │ Separate /contribute/ingestion/tabular               │ Not linked to a project                      │
  └───────────────────────────────┴──────────────────────────────────────────────────────┴──────────────────────────────────────────────┘

  2.2 File Handling Hardening

  Current: project-asset-uploader.tsx sends multipart to /assets/upload/. There is no client-side file type or size check.

  Add before the fetch call:

  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "audio/mpeg", "video/mp4"];

  if (file.size > MAX_BYTES) throw new Error(`File exceeds 50 MB limit.`);
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error(`Unsupported file type: ${file.type}`);

  On the backend, add Django's validate_file_extension and a byte-level MIME check using python-magic — this is the actual security boundary. File extension lies; MIME sniffing from the
  first 512 bytes does not.

  2.3 Upload Progress

  The current uploader has no progress indication. Add an XMLHttpRequest wrapper so onprogress fires:

  function uploadWithProgress(url: string, formData: FormData, onProgress: (pct: number) => void): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total * 100); };
      xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status }));
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.open("POST", url);
      xhr.send(formData);
    });
  }

  Drive a shadcn Progress bar in the uploader UI.

  2.4 Asset Metadata — Versioning

  Each asset currently stores role, caption, media_type. Add a version_label field (e.g., "v1", "revised-2026-05-21") to ProjectAsset and expose it in the upload form. When a file is
  replaced (same caption, same role), create a new ProjectAsset rather than overwriting — this gives a full file history. The model already uses UUID PKs so old asset IDs remain stable as
  permanent links.

  ---
  3. Submission Mechanism — API, Rate Limiting, Idempotency, Queues
  
  3.1 Idempotency on Project Creation

  Problem: new/page.tsx:49 — handleSubmit has no guard against double-submit beyond the submitting boolean. If the network is slow and the user somehow submits twice, two projects could be
  created with different auto-slugified slugs.

  Fix: The slug is already unique at the DB level (slug = models.SlugField(max_length=80, unique=True)). A second identical submit will get a 400 from Django. But surface this better:

  1. Disable the submit button immediately on first click (already done via submitting).
  2. On 400 with { slug: ["already exists"] }, redirect to the existing project instead of showing an error.

  For the broader case, pass a client-generated idempotency key header:

  headers: {
    "Idempotency-Key": crypto.randomUUID(), // generated once on form mount, stable across retries
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  On the backend, store the key in a short-lived cache (Redis, 24 h) keyed to (user_id, idempotency_key) → project_id. On replay, return the cached project instead of creating a new one.

  3.2 Rate Limiting

  The OCR quota is already implemented in project_services.py:110–117 (assert_project_ocr_quota). Apply the same pattern to project creation and asset upload at the API layer using
  django-ratelimit or DRF throttling:

  # In the ProjectViewSet
  from rest_framework.throttling import UserRateThrottle

  class ProjectCreateThrottle(UserRateThrottle):
      rate = "10/hour"  # 10 new projects per user per hour

  class ProjectAssetUploadThrottle(UserRateThrottle):
      rate = "50/day"   # 50 asset uploads per user per day

  Return 429 Too Many Requests with Retry-After header. The frontend's getApiErrorMessage in api-client.ts should handle 429 explicitly: "You've reached the upload limit. Try again in X
  minutes."

  3.3 Background Processing — OCR and Entity Inference

  project_services.py:143–175 already queues OCR via classify_and_route_document.delay(str(doc.id)) using Celery. The frontend polls ocr_status on the asset. This is the right pattern —
  extend it:

  Entity suggestion queue: When an asset is uploaded (image/PDF), after OCR completes, trigger a second Celery task:

  @shared_task
  def suggest_entities_from_asset(asset_id: str) -> None:
      """Run NER + ontology matching on OCR text, store candidates on the ProjectAsset."""

  Store suggestions in a JSONField on ProjectAsset: entity_suggestions: [{ label, ontology_class, confidence }]. The frontend renders these in a collapsible "Suggested Entities" section in
  the asset card — contributor clicks to accept and link them.

  3.4 Webhook on State Transition

  When a project transitions to in_review, fire a webhook to notify the moderation system. Add this to project_services.py:

  def notify_review_queue(project: Project) -> None:
      if not settings.REVIEW_WEBHOOK_URL:
          return
      payload = {"project_id": str(project.id), "slug": project.slug, "title": project.title}
      requests.post(settings.REVIEW_WEBHOOK_URL, json=payload, timeout=5)

  Call this inside the transition view, wrapped in a try/except so webhook failure never blocks the user-facing response. For production, move this to a Celery task.

  ---
  4. Acceptance Process — Review, Automated Checks, Merge, Rollback
  
  4.1 Pre-Submission Automated Checks

  Before a project can transition to in_review, run a checklist server-side:

  def validate_project_for_review(project: Project) -> list[str]:
      errors = []
      if not project.assets.exists():
          errors.append("At least one evidence asset is required.")
      if not project.entities.exists():
          errors.append("At least one ontology entity must be linked.")
      if not project.abstract.strip():
          errors.append("Abstract is required before submission.")
      if project.assets.filter(ocr_status="processing").exists():
          errors.append("Wait for all OCR jobs to finish before submitting.")
      return errors

  Return these as a 400 with { "blockers": [...] } when the transition endpoint is called with target_state=in_review. The frontend should surface blockers as a pre-flight checklist on the
  ProjectStepStrip — green check = passed, red = blocked.

  4.2 Moderator Dashboard

  The curation route at (dashboard)/curation/contributions/ already exists. Extend it into a moderation queue specifically for projects:

  New page: /curation/review-queue

  - List of projects in in_review state, sorted by submitted_at
  - Each row: title, owner, entity count, asset count, days in queue, tag filter
  - Actions per row: "Open", "Approve", "Request Revision", "Reject"

  The transition endpoint at /api/v1/data/projects/<slug>/transition/ already handles these — the moderator dashboard is purely a frontend concern calling the same API. The permission guards
   in project_services.py:38–56 enforce that only Reviewers and Moderators groups can approve/merge.

  4.3 Revision Cycle

  When a project transitions to needs_revision, the reviewer must supply a reason. Currently transitionProject in projects-api.ts:142 accepts an optional comment param but the frontend
  transition button ([slug]/page.tsx:188–197) never prompts for one.

  Fix: When targetState === "needs_revision", open a Dialog with a required <Textarea> before calling handleTransition. Pass the entered text as the comment field to the API. Store this in
  ProjectActivity with action="needs_revision" and payload.reason.

  4.4 Merge Strategy and Rollback

  The STATE_MERGED transition is irreversible (_PROJECT_TRANSITIONS[STATE_MERGED] = set()). On merge:

  Step 1 — Snapshot: Create a ProjectSnapshot record (new model) capturing the full project state as a JSON blob before merging into the main knowledge graph. This is the rollback artifact.

  class ProjectSnapshot(models.Model):
      id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
      project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="snapshots")
      state_at_merge = models.JSONField()  # serialized project + entities + assets
      merged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
      created_at = models.DateTimeField(auto_now_add=True)

      class Meta:
          db_table = "project_snapshots"

  Step 2 — Atomic write: The merge transaction that writes entities to the main KG must be wrapped in transaction.atomic(). If any entity write fails, the merge rolls back entirely — the
  project stays approved, the user gets a 500 with a human-readable error.

  Step 3 — Rollback endpoint: Add POST /api/v1/data/projects/<slug>/rollback/ accessible only to Moderators. This reads ProjectSnapshot.state_at_merge, deletes the merged triples from the KG
   (using the project's entity IDs as a deletion set), and resets the project state to needs_revision. Add a confirmation dialog on the frontend.

  4.5 Notification at Each Stage

  The Notification model already exists (migration 0009). Add signal-based notifications:

  ┌────────────────┬───────────────────────────────────┐
  │     Event      │          Who is notified          │
  ├────────────────┼───────────────────────────────────┤
  │ in_review      │ All users in Reviewers group      │
  ├────────────────┼───────────────────────────────────┤
  │ needs_revision │ Project owner + all editors       │
  ├────────────────┼───────────────────────────────────┤
  │ approved       │ Project owner                     │
  ├────────────────┼───────────────────────────────────┤
  │ merged         │ Project owner + all collaborators │
  └────────────────┴───────────────────────────────────┘

  @receiver(post_save, sender=ProjectActivity)
  def notify_on_project_activity(sender, instance, created, **kwargs):
      if not created:
          return
      if instance.action == "in_review":
          _notify_reviewers(instance.project)
      elif instance.action in ("needs_revision", "approved", "merged"):
          _notify_project_team(instance.project, instance.action)

  ---
  Summary — Priority Order

  ┌──────────┬────────────────────────────────────────────────────────┬────────┐
  │ Priority │                         Change                         │ Effort │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P0       │ Skeleton loaders on list page                          │ 1 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P0       │ Client-side slug + file validation                     │ 2 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P0       │ Pre-submission blockers checklist (backend + frontend) │ 3 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P1       │ Optimistic transition buttons                          │ 2 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P1       │ Draft persistence in sessionStorage                    │ 1 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P1       │ Rate limiting throttle classes                         │ 1 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P1       │ Revision reason dialog                                 │ 2 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P2       │ Upload progress bar                                    │ 2 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P2       │ Idempotency key header + Redis cache                   │ 3 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P2       │ Moderator review-queue page                            │ 4 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P2       │ ProjectSnapshot + merge rollback                       │ 4 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P3       │ Entity suggestion Celery task                          │ 6 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P3       │ Public project discovery tab                           │ 2 h    │
  ├──────────┼────────────────────────────────────────────────────────┼────────┤
  │ P3       │ Signal-based notifications                             │ 3 h    │
  └──────────┴────────────────────────────────────────────────────────┴────────┘

  Every P0 item is a bug or gap in the current code that affects a user on their first visit. P1 items improve reliability and prevent data loss. P2/P3 items are what make this the face of
  the project.

