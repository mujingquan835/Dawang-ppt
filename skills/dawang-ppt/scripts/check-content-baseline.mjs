import fs from 'node:fs';
import {validateContentBaseline} from '../project/src/fusion/authoring/content-baseline.mjs';
const [projectPath,baselinePath]=process.argv.slice(2);
if(!projectPath||!baselinePath)throw new Error('Usage: node check-content-baseline.mjs authored.json content-baseline.json');
const project=JSON.parse(fs.readFileSync(projectPath)),baseline=JSON.parse(fs.readFileSync(baselinePath));
if(project.requirements?.contentBaselineContract!=='source-baseline-v1')throw new Error('source-baseline-v1 must be enabled');
const issues=validateContentBaseline(project,baseline);console.log(JSON.stringify({ok:!issues.length,issues},null,2));process.exitCode=issues.length?1:0;
