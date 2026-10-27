// Rule provenance and execution records for Dawang-PPT.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const statuses = new Set(['applicable', 'not-applicable', 'user-overridden', 'unsupported']);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const stringList = (value) => Array.isArray(value) && value.every(nonempty);
const hashFile = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function createRuleManifest({ sourceFiles, decisions }) {
  if (!Array.isArray(sourceFiles) || !Array.isArray(decisions)) throw new TypeError('sourceFiles and decisions must be arrays');
  const sources = sourceFiles.map(({ id, path: file, section = '' }) => {
    const absolute = path.resolve(file);
    let sha256 = null;
    try { sha256 = hashFile(absolute); } catch { /* Validation reports missing/unreadable sources. */ }
    return { id, path: absolute, sha256, section };
  });
  return { sources, decisions: structuredClone(decisions) };
}

// Validation checks local provenance and records, not the semantic quality of a deck.
// Any issue means the manifest is not clean; unsupported is never a success flag.
export function validateRuleManifest(manifest) {
  const issues = [];
  const add = (code, message, context = {}) => issues.push({ code, severity: 'error', message, ...context });
  if (!manifest || typeof manifest !== 'object') {
    add('manifest-invalid', 'Expected a rule manifest object');
    return issues;
  }
  const sources = Array.isArray(manifest.sources) ? manifest.sources : [];
  const decisions = Array.isArray(manifest.decisions) ? manifest.decisions : [];
  if (!sources.length) add('sources-required', 'At least one source is required');
  if (!decisions.length) add('decisions-required', 'At least one explicit rule decision is required');
  const sourceIds = new Set();
  for (const source of sources) {
    if (!source || typeof source !== 'object') { add('source-invalid', 'Expected a source object'); continue; }
    const context = { sourceId: source.id };
    if (!nonempty(source.id)) add('source-id-required', 'Source ID is required', context);
    else if (sourceIds.has(source.id)) add('source-id-duplicate', 'Source IDs must be unique', context);
    else sourceIds.add(source.id);
    if (typeof source.section !== 'string') add('source-section-invalid', 'Section must be a string', context);
    if (!nonempty(source.path) || !path.isAbsolute(source.path)) {
      add('source-path-invalid', 'Source path must be absolute', context);
      continue;
    }
    if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)) add('source-hash-invalid', 'Expected a SHA-256 fingerprint', context);
    let currentHash;
    try { currentHash = hashFile(source.path); } catch (error) {
      add(error.code === 'ENOENT' ? 'source-missing' : 'source-unreadable', 'Cannot read source file', context);
      continue;
    }
    if (source.sha256 && currentHash !== source.sha256) add('source-hash-changed', 'Source bytes differ from the recorded fingerprint', context);
  }
  const ruleIds = new Set();
  for (const decision of decisions) {
    if (!decision || typeof decision !== 'object') { add('decision-invalid', 'Expected a decision object'); continue; }
    const context = { ruleId: decision.ruleId };
    if (!nonempty(decision.ruleId)) add('rule-id-required', 'Rule ID is required', context);
    else if (ruleIds.has(decision.ruleId)) add('rule-id-duplicate', 'Rule IDs must be unique; group slideIds for a shared decision', context);
    else ruleIds.add(decision.ruleId);
    if (!sourceIds.has(decision.sourceId)) add('decision-source-unknown', 'Decision must reference an existing source ID', context);
    if (!statuses.has(decision.status)) add('decision-status-invalid', 'Unknown rule status', context);
    if (typeof decision.reason !== 'string' || (decision.status !== 'applicable' && !nonempty(decision.reason))) add('decision-reason-required', 'Non-applicable decisions require a reason', context);
    if (!stringList(decision.slideIds)) add('decision-slide-ids-invalid', 'slideIds must be an array of nonempty strings', context);
    if (!stringList(decision.evidencePaths)) add('decision-evidence-paths-invalid', 'evidencePaths must be an array of nonempty strings', context);
    if (decision.status === 'unsupported') add('rule-unsupported', 'Rule remains unsupported and requires explicit handling', context);
  }
  return issues;
}
