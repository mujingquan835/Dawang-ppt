import {writeEditablePackage} from './write.mjs';
import fs from 'node:fs';import PptxGenJS from 'pptxgenjs';import {composeEditablePptx} from './pptx-core.mjs';
export async function exportEditablePptx(collection,target){const {pptx,report}=composeEditablePptx(PptxGenJS.default || PptxGenJS,collection,target);fs.writeFileSync(target.fileName,await writeEditablePackage(pptx,collection));fs.writeFileSync(target.fileName+'.report.json',JSON.stringify(report,null,2));return report;}
