# Archived Sphinx site (legacy)

The files `documentation/conf.py`, `index.rst`, `introduction.rst`, `contributing.rst`, `Makefile`, and `make.bat` are a **legacy Sphinx** docs site — do not edit them.

**Current documentation** lives in:

- [`documentation/README.md`](README.md) — topic hub
- [`DOCS.md`](../DOCS.md) — root index
- [`tests/README.md`](../tests/README.md) — E2E runners

Add or update guides under `documentation/<topic>/`, not in the Sphinx `.rst` files.

## MkDocs (current static site)

[`mkdocs.yml`](../mkdocs.yml) now uses `docs_dir: documentation` and the nav above. Build locally:

```bash
make docs-build   # output → ./site/
make docs-serve   # http://localhost:8001
```

The old `docs/en/...` tree referenced by the pre-2026 MkDocs config was never checked in; do not recreate it unless you are migrating content from Sphinx.
