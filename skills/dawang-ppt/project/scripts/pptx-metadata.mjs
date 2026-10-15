import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';

export const MASTER_PPT_AUTHOR = '@大师的AI小灶';
export const MASTER_PPT_APPLICATION = '大师 PPT';

export async function brandPptxFile(file, options = {}) {
  const input = await readFile(file);
  const output = await brandPptxBuffer(input, options);
  const tempFile = `${file}.metadata-${process.pid}-${Date.now()}.tmp`;
  try {
    await writeFile(tempFile, output);
    await rename(tempFile, file);
  } finally {
    await rm(tempFile, { force: true }).catch(() => {});
  }
  return file;
}

export async function brandPptxBuffer(input, options = {}) {
  const author = String(options.author || MASTER_PPT_AUTHOR);
  const application = String(options.application || MASTER_PPT_APPLICATION);
  const zip = await JSZip.loadAsync(input);
  const coreEntry = zip.file('docProps/core.xml');
  if (!coreEntry) throw new Error('PPTX is missing docProps/core.xml.');

  let coreXml = await coreEntry.async('string');
  coreXml = setXmlElement(coreXml, 'dc:creator', author, 'cp:coreProperties');
  coreXml = setXmlElement(coreXml, 'cp:lastModifiedBy', author, 'cp:coreProperties');
  zip.file('docProps/core.xml', coreXml);

  const appEntry = zip.file('docProps/app.xml');
  if (appEntry) {
    let appXml = await appEntry.async('string');
    appXml = setXmlElement(appXml, 'Application', application, 'Properties');
    appXml = setXmlElement(appXml, 'Company', author, 'Properties');
    zip.file('docProps/app.xml', appXml);
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

function setXmlElement(xml, tagName, value, rootTagName) {
  const escaped = escapeXml(value);
  const elementPattern = new RegExp(`<${escapeRegExp(tagName)}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${escapeRegExp(tagName)}>`, 'i');
  const replacement = `<${tagName}>${escaped}</${tagName}>`;
  if (elementPattern.test(xml)) return xml.replace(elementPattern, replacement);

  const closingRoot = new RegExp(`</${escapeRegExp(rootTagName)}>`, 'i');
  if (!closingRoot.test(xml)) throw new Error(`PPTX metadata XML is missing </${rootTagName}>.`);
  return xml.replace(closingRoot, `${replacement}</${rootTagName}>`);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
