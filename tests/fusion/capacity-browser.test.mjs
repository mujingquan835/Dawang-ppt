import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
test('measured role/schedule/flow modules render, survive HTML reopening, and reject overloaded regions',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'capacity-browser-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const r=spawnSync('skills/dawang-ppt/project/node_modules/.bin/tsx',['tests/fusion/helpers/capacity-browser-run.jsx',dir],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
});
