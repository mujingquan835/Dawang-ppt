import { clone, revision, validateProject } from '../project/schema.mjs';
import { resolveSlideStyle } from '../styles/registry.mjs';
import { syncCompositionTextState } from '../scene/model.mjs';
import { CONTENT_CONTRACT } from '../qa/key-lines.mjs';

// Direct elements are the design. Never select a preset or re-plan their geometry.
export function createAuthoredProject(input) {
  if (!Array.isArray(input?.slides) || !input.slides.length) throw new Error('Authored slides must be a nonempty array');
  for (const key of ['requirements', 'sources', 'media', 'contentPlan', 'designChoice']) {
    if (!input[key] || typeof input[key] !== 'object' || Array.isArray(input[key])) throw new Error(`Authored input requires ${key}`);
  }
  if (!Array.isArray(input.sources.entries) || !Array.isArray(input.media.entries) || !input.contentPlan.nodes) throw new Error('Authored sources/media entries and contentPlan.nodes are required');
  const source = clone(input);
  const slides = source.slides.map(slide => ({
    ...slide,
    mode: slide.mode ?? 'composition',
    authoring: slide.authoring ?? { engine: 'dawang-authored-v1' },
    styleId: slide.styleId ?? source.designChoice.styleId
  }));
  const slideOrder = slides.map(slide => slide.slideId);
  const legacy = { slideOrder: [...slideOrder], text: {}, props: {}, media: {}, skippedSlides: [], deletedSlides: [], duplicatedSlides: [], typography: { mode: 'global', headingFont: 'theme', bodyFont: 'theme', monoFont: 'theme' } };
  const project = {
    version: 2,
    // New authored decks must record their key lines; older projects without this stamp only get warnings.
    requirements: { projectId: revision(), ...source.requirements, contentContract: CONTENT_CONTRACT },
    sources: { userEdits: [], ...source.sources },
    media: source.media,
    contentPlan: source.contentPlan,
    designChoice: source.designChoice,
    slides,
    editorState: { legacy, slideOrder, skippedSlides: [], deletedSlides: [], overrides: {}, history: [], redo: [] },
    revision: revision()
  };
  const issues = validateProject(project);
  if (issues.length) throw new Error(issues.join('\n'));
  // Existing style tokens supply drawing defaults only; they never choose a layout.
  for (const slide of slides) resolveSlideStyle(slide, source);
  return syncCompositionTextState(project);
}
