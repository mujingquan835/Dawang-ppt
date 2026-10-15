# Open Design Template Bridge

This bridge ports selected visual systems and layout ideas into the `dashiai-ppt`
runtime. It does not embed or depend on the Open Design desktop application.

Included sources:

- `theme13` — Blue Professional, adapted from `zarazhangrui/beautiful-html-templates`, MIT.
- `theme14` — Weekly Report, adapted from `lewislulu/html-ppt-skill`, MIT.
- `theme15` — Product Launch, adapted from `lewislulu/html-ppt-skill`, MIT.
- `theme16` — Knowledge Architecture Blueprint, adapted from `lewislulu/html-ppt-skill`, MIT.

Explicitly excluded:

- `guizang-ppt`
- Guizang Editorial / E-Ink templates
- Open Design application runtime, navigation, authentication, and export code

The resulting React components, metadata contracts, browser editing, revision
workflow, and PPTX/PDF export remain part of the DashiAI PPT runtime.
