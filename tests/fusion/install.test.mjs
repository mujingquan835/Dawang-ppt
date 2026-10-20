import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync,spawnSync} from 'node:child_process';
test('isolated installation and removal preserve an unrelated installation',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dawang-install-')),target=path.join(dir,'skill'),installer=path.resolve('skills/dawang-ppt/scripts/install.mjs');try{execFileSync(process.execPath,[installer,'--target',target]);assert.equal(fs.realpathSync(target),path.resolve('skills/dawang-ppt'));const doctor=JSON.parse(execFileSync(process.execPath,[path.join(target,'scripts/dawang.mjs'),'doctor'],{encoding:'utf8'}));assert(doctor.runtime);execFileSync(process.execPath,[installer,'--target',target,'--uninstall']);assert(!fs.existsSync(target));fs.mkdirSync(target);fs.writeFileSync(path.join(target,'keep.txt'),'unrelated');const result=spawnSync(process.execPath,[installer,'--target',target],{encoding:'utf8'});assert.notEqual(result.status,0);assert.equal(fs.readFileSync(path.join(target,'keep.txt'),'utf8'),'unrelated');}finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('explicit link replacement verifies old target and records rollback without deleting it',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dawang-switch-')),target=path.join(dir,'skill'),old=path.join(dir,'previous'),installer=path.resolve('skills/dawang-ppt/scripts/install.mjs');
 try{
  fs.mkdirSync(old);fs.writeFileSync(path.join(old,'keep'),'old');fs.symlinkSync(old,target,'dir');
  assert.notEqual(spawnSync(process.execPath,[installer,'--target',target,'--replace-link',dir]).status,0);
  assert.equal(fs.realpathSync(target),fs.realpathSync(old));
  const out=execFileSync(process.execPath,[installer,'--target',target,'--replace-link',old],{encoding:'utf8'});
  assert.equal(fs.realpathSync(target),path.resolve('skills/dawang-ppt'));
  const receipt=JSON.parse(fs.readFileSync(JSON.parse(out).rollbackFile));
  assert.equal(receipt.previousTarget,old);assert.equal(fs.readFileSync(path.join(old,'keep'),'utf8'),'old');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
