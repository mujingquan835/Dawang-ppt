import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('Save overwrites existing source without download and restores its real file handle on reopen',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'save-controls-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const result=spawnSync('skills/dawang-ppt/project/node_modules/.bin/tsx',['tests/fusion/helpers/save-controls-run.jsx',dir],{encoding:'utf8',timeout:120000});
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
});
