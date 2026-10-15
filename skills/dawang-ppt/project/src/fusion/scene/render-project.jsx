import fs from "node:fs";
import path from "node:path";
import { buildSync } from "esbuild";
import { renderDeck } from "../../renderDeck.jsx";
import { validateProject } from "../project/schema.mjs";
function renderProject(project, outFile) {
  const issues = validateProject(project);
  if (issues.length) throw new Error(issues.join("\n"));
  const byId = new Map(project.slides.map((s) => [s.slideId, s]));
  const order = project.editorState.slideOrder || project.slides.map((s) => s.slideId);
  const slides = order.map((id) => byId.get(id)).filter(Boolean).map((s) => s.mode === "template" ? { ...s, id: s.slideId } : { id: s.slideId, key: s.slideId, mode: "composition", layout: "fusion-composition", label: s.label || s.title || s.compositionId, props: { fusionSlide: s, fusionProject: project } });
  const deck = { title: project.requirements.title, themePack: project.slides.find((s) => s.layout)?.layout.split("_")[0] || "theme13", slides, state: project.editorState.legacy || {}, fusionProject: project };
  renderDeck(deck, { outFile });
  return { revision: project.revision, slides: slides.length, outFile };
}
export {
  renderProject
};
