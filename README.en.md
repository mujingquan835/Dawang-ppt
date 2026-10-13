# Dawang-PPT

An experimental content-driven presentation skill for Chinese management reports, analysis and training. Semantic facts, styles, compositions and export are separate. HTML editing writes back to the same content state used for PPTX export.

Version 0.1.0 supports six compositions, three experimental styles, custom tokens, editable text/images/shapes/connectors/native tables. Native data charts, SmartArt, arbitrary PPTX template import and automatic style transfer are not implemented. User visual acceptance and target Office/WPS client compatibility remain pending.

Install the complete repository, run `npm ci`, then `node skills/dawang-ppt/scripts/install.mjs`. Start a new Codex session and invoke `$dawang-ppt`. Existing skills remain installed.

See [Chinese documentation](README.md), [architecture](docs/architecture.md), [acceptance](docs/acceptance.md) and [licenses](docs/upstream-sources.md). Original upstream notices and component licenses remain in force. The new runtime uses an independent MIT PptxGenJS adapter rather than the proprietary upstream exporter.
