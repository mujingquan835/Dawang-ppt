# Attribution Notice

## 大师 PPT 公开增强版

本仓库的增强版功能、配置、工作流、文档与后续维护由 **@大师的AI小灶 / [mujingquan835](https://github.com/mujingquan835)** 负责。

Additions, modifications, configuration, workflow design, documentation, and ongoing maintenance in this enhanced edition are provided by **@Master's AI Workshop / [mujingquan835](https://github.com/mujingquan835)**.

Copyright (c) 2026 mujingquan835. The additions and modifications are distributed under the repository's applicable licenses.

## Upstream project

This enhanced edition is based on [chuspeeism/dashi-ppt-skill](https://github.com/chuspeeism/dashi-ppt-skill).

Copyright (c) 2026 chuspeeism. Upstream AGPL-3.0 material retains its original copyright and license notices.

The bundled `skills/dashiai-ppt/project/packages/html-deck-to-pptx` export engine is proprietary upstream material. Its own `LICENSE` file controls that component and has not been replaced or reassigned.

Third-party dependencies, fonts, visual assets, and demo media retain their respective copyright and license notices.

## Dawang-PPT

Dawang-PPT 0.2.0 development additions are maintained by mujingquan835. The new runtime does not use the proprietary DashiAI export engine. Kimi design document text is not redistributed; the repository contains an index and independently authored adaptations.

The maintained fusion runtime is `skills/dawang-ppt/project`. It retains the original editing shell and licensed open source template runtime, but excludes the proprietary export package and browser bundle. Its export adapter is independently authored with PptxGenJS and JSZip. The root `runtime` remains a historical prototype. OPPO Sans copyright and license are retained alongside the bundled font.

## Historical V3 local reference boundary

The current fusion work is a local development build for personal use and has not passed final visual acceptance. This status does not replace the licenses of upstream code or assets. Kimi original reference text is read only from an external local installation (`KIMI_PPT_SKILL_DIR`, `~/.dawang-ppt/kimi-reference/`, or the existing user skill). It is not bundled with the public source or its integration history. A reference index or palette preview is not a completed template migration.

Selected original integration modules were authored on the owner's local `grok/fusion-opt-v1` branch (source snapshot `23b15a1`). Integration uses reviewed source changes rather than merging the branch containing local-only reference copies; see `docs/开发进度-v3.md`.

## Dawang-PPT sharing build (2026-10-27)

The active authoring entry now reads bundled Dawang-PPT production rules from `references/rules/` and the maintained authoring guides, fingerprinted by `dawang-rules.lock.json`. It does not load external Kimi rule installations. Historical source, metadata and adapters remain in the repository for compatibility and provenance. The dedicated skill ZIP excludes the historical skills, external rule reader, external rule lock, and proprietary exporter. This rule-path change does not remove the upstream copyright or licensing obligations for the editor, templates, assets or dependencies.

## Sharing preview correction (2026-10-27, revision 1)

The previous sharing preview substituted shortened rule documents and did not preserve the complete authoring-rule behavior. Revision `v0.2.0-preview.20261027.1` restores the complete pinned rule reader, section dispositions and original reference fingerprint; presentation terminology is normalized without replacing the underlying rules. Version-matched original documents remain an external prerequisite and are not redistributed without confirmed permission. Earlier statements that no external references were required apply only to the superseded, non-equivalent preview. Historical short drafts are archived and excluded from the skill package.
