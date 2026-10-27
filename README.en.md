# Dawang-PPT

A Chinese presentation skill that turns source material into a single offline-editable HTML file. The authoring agent plans the content, edits screen-ready copy, designs each slide and reviews the result. PPTX, PDF and images are optional exports.

The sharing build is `v0.2.0-preview.20261027.1`, a **prerelease**, primarily tested on macOS with Node.js 22+ and Chrome. The complete original production-rule reading and section adaptation workflow is restored. Version-matched reference documents must be supplied separately; they are not redistributed in this ZIP, and summaries never substitute for them.

Download the dedicated skill ZIP from the [release page](https://github.com/mujingquan835/Dawang-ppt/releases/tag/v0.2.0-preview.20261027.1), extract to a permanent location, open the `dawang-ppt` folder and run:

```sh
npm ci --prefix project
node scripts/install.mjs
export DAWANG_PPT_RULES_DIR="/your/path/to/complete-rule-source"
node scripts/dawang.mjs doctor
```

Check `ready: true`, `runtime: true`, `rules.provider: "dawang-ppt"`, and `rules.status: "pinned"`. Start a new AI session, request `dawang-ppt`, attach material and specify audience, purpose, slide count and constraints. See the [Chinese guide](docs/USAGE.md) for other clients, updating and troubleshooting.

Recipients only viewing or manually editing the delivered HTML do not need Node.js or the skill. Use Chrome/Edge, select the existing HTML when first saving, and grant write access. A browser draft is not a saved source file.

PPTX fonts are not embedded; PDF is rasterized. Arbitrary PPTX imports, native data charts, SmartArt, and identical rendering across clients are not guaranteed. See [release notes](docs/RELEASE-20261027.md), [LICENSE](LICENSE) and [NOTICE](NOTICE.md).
