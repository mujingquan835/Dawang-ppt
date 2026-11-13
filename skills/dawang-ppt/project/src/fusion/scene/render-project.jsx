// Writes the deck page for a project. Kept as the single entry point the pipeline, preview server and CLI call.
import { writeDeck } from "../shell/page.jsx";
function renderProject(project, outFile) {
  return writeDeck(project, outFile);
}
export { renderProject };
