# GitHub Visual Introduction Implementation Plan

> **For agentic workers:** Use inline execution for this approved documentation task. No runtime or production-rule changes.

**Goal:** Make the GitHub introduction understandable through actual slides, editor screenshots, and an editable public sample.

**Architecture:** Reuse the existing authored → make → portable HTML chain, with synthetic source material and reproducible screenshot capture. Publish images and source in Git; distribute the large offline HTML as a clearly named sample attachment.

**Tech Stack:** Existing Dawang-PPT runtime, Node.js, Playwright, GitHub Markdown.

**Spec:** `docs/superpowers/specs/2026-10-31-github-visual-introduction-design.md`

## Global Constraints

Only docs, synthetic examples and documentation scripts change. Keep complete rules, source licensing and separate-rule prerequisites. No private assets, personal paths, invented performance claims or irreversible retagging.

## Review Focus

First-time readers see the setup prerequisite before commands. Actual screenshots match described controls. Sample is explicitly synthetic. HTML is self-contained and editable. All relative links/images work on GitHub and release context.

## Tasks

- [x] Create source material, screen-ready copy and 4-page authored example; generate using existing make command, with full QA and page screenshots.
- [x] Capture actual editor selection, text editing and save/export controls; verify edit/undo/offline reopen. Publish a screenshot overview and sample guide.
- [x] Rewrite README and enrich USAGE; check Markdown links, image dimensions, privacy, unchanged runtime/rules and actual rendered documentation.
- [x] Commit and upload docs/assets; attach sample HTML without modifying the existing skill ZIP; verify remote file and download metadata.

Verification is proportionate to docs-only scope: full example QA, actual screenshot review, offline edit/reopen, generated-link checks, and production-rule parity audit. Do not repeat unrelated engine suites when runtime files are unchanged.

Validation: 4-page make QA has zero issues/warnings; actual editor screenshots reviewed; offline edit/undo/redo/serialization/reopen passed. GitHub Markdown API output rendered locally at desktop/mobile widths; all 4 homepage images load. 64 links checked with no missing relative paths. Complete rule parity still PASS; production files are untouched.

Read-only review found a personal-path literal in the screenshot helper; replaced with runtime home-directory detection and re-scanned all public files. No remaining actionable findings. The sample HTML and its separate checksum are uploaded; the existing skill ZIP digest is unchanged.
