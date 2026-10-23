import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {prepareMaterial} from '../../skills/dawang-ppt/project/src/fusion/authoring/prepare.mjs';
import {createTextAuthor,distributeBounds} from '../../skills/dawang-ppt/project/src/fusion/authoring/elements.mjs';
import {readAuthoringRules} from '../../skills/dawang-ppt/project/src/fusion/kimi/reference-index.mjs';
test('prepare preserves text/runs/geometry and archives image bytes without returning base64',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dawang-prepare-'));
 try{const input=path.join(dir,'input.json'),image=Buffer.from('synthetic-image-bytes');
 fs.writeFileSync(input,JSON.stringify({slides:[{slideId:'s',elements:[{id:'t',type:'text',text:'关键事实与待核状态',runs:[{text:'保留',style:{fontWeight:700}}],bounds:[1,2,3,4]},{id:'i',type:'image',src:'data:image/png;base64,'+image.toString('base64'),bounds:[5,6,7,8]}]}]}));
 const result=prepareMaterial({inputFile:input,outDir:path.join(dir,'prepared')});const out=fs.readFileSync(result.materialFile,'utf8');
 assert.ok(!out.includes('base64'));const m=JSON.parse(out);assert.equal(m.slides[0].elements[0].text,'关键事实与待核状态');assert.equal(m.slides[0].elements[0].runs[0].style.fontWeight,700);assert.deepEqual(m.slides[0].elements[1].bounds,[5,6,7,8]);assert.deepEqual(fs.readFileSync(result.media[0].path),image);
 assert.throws(()=>prepareMaterial({inputFile:input,outDir:path.join(dir,'prepared')}),/already exists/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unsupported HTML fails explicitly rather than presenting incomplete extraction',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dawang-html-'));try{const file=path.join(dir,'x.html');fs.writeFileSync(file,'<h1>Plain HTML</h1>');assert.throws(()=>prepareMaterial({inputFile:file,outDir:path.join(dir,'out')}),/snapshot missing/);assert.equal(fs.existsSync(path.join(dir,'out')),false);}finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('unknown scenario exposes valid IDs for recovery',()=>assert.throws(()=>readAuthoringRules({scenarioId:'product-introduction'}),/Valid scenarios:.*business-plan/));
test('style author preserves custom geometry and per-element overrides',()=>{const text=createTextAuthor({baseStyle:{fontFamily:'Arial',fontSize:40},roles:{title:{fontSize:72,color:'#222222'}}});const e=text({role:'title',id:'x',text:'重点',bounds:[11,22,500,100],style:{fontSize:80}});assert.deepEqual(e.bounds,[11,22,500,100]);assert.equal(e.style.fontSize,80);assert.equal(e.style.fontFamily,'Arial');assert.throws(()=>text({role:'missing'}),/Unknown/);assert.deepEqual(distributeBounds({origin:[10,20],sizes:[[100,50],[200,70]],gap:12}),[[10,20,100,50],[122,20,200,70]]);});
