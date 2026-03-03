# Translation & i18n Workflow

We use `mkdocs-static-i18n` to provide English (`en`) and Nepali (`ne`) content.

Workflow:

1. English is the source of truth; write new content under `docs/en/`.
2. Create corresponding Nepali stubs under `docs/ne/` with `[Translation needed]` markers.
3. Translators update `docs/ne/*` pages; pull requests should include both `en` and `ne` changes where available.
4. CI builds the MkDocs site and publishes to GitHub Pages. The language switcher appears in the site header.

Priority pages for translation:

- `index.md` (home)
- `guides/contributors/*`
- `getting-started/project-overview.md`
- `about/roadmap.md`

Translation status can be tracked in `docs/translation-status.md` (TODO: add table).
