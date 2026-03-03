# Contributing (Developer Guide)

This guide replaces the minimal `contributing.md` at the repo root and describes how to contribute code.

Essentials:

- Branch from `v1` for all work.
- Commit messages: imperative tense (e.g., `Add feature`).
- Open issues for non-trivial changes and assign a clear description and acceptance criteria.
- Use `ruff format .` and `ruff check .` before submitting PRs.

PR checklist:

- [ ] Branch from `v1`
- [ ] Include tests for backend changes
- [ ] Run `ruff format` and `npm run build` for frontend changes
- [ ] Update documentation in `docs/` for any public API changes

See also `CLAUDE.md` and `AGENTS.md` for developer conventions and AI-agent guidance.
