import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoredProject} from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import {applyEditCommand,undoProject} from '../../skills/dawang-ppt/project/src/fusion/editor/commands.mjs';
import {validateProject} from '../../skills/dawang-ppt/project/src/fusion/project/schema.mjs';
import PptxGenJS from '../../skills/dawang-ppt/project/node_modules/pptxgenjs/dist/pptxgen.es.js';
import JSZip from '../../skills/dawang-ppt/project/node_modules/jszip/lib/index.js';
import {composeEditablePptx} from '../../skills/dawang-ppt/project/src/fusion/export/pptx-core.mjs';
import {writeEditablePackage} from '../../skills/dawang-ppt/project/src/fusion/export/write.mjs';
const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
function project(){return createAuthoredProject({requirements:{title:'裁切'},sources:{entries:[],userEdits:[]},media:{entries:[]},contentPlan:{nodes:{},slides:[{slideId:'one'}]},designChoice:{styleId:'legacy/theme09'},slides:[{slideId:'one',elements:[{id:'photo',type:'image',src,bounds:[100,100,800,400],fit:'contain'}]}]});}
test('image crop atomically records visible source rectangle and frame with undo, without changing source',()=>{
 const p=project(),r=applyEditCommand(p,{slideId:'one',elementId:'photo',type:'image',src,crop:[.1,.2,.5,.4],bounds:[120,140,400,320],fit:'cover'});
 assert.equal(r.ok,true);assert.deepEqual(r.project.slides[0].elements[0].crop,[.1,.2,.5,.4]);assert.deepEqual(r.project.slides[0].elements[0].bounds,[120,140,400,320]);assert.equal(r.project.slides[0].elements[0].src,undefined);assert.equal(r.project.media.entries[0].src,src);
 assert.deepEqual(undoProject(r.project).project.slides,p.slides);
 const reset=applyEditCommand(r.project,{slideId:'one',elementId:'photo',type:'image',src,fit:'contain',crop:null});assert.equal(reset.ok,true);assert.equal(reset.project.slides[0].elements[0].crop,undefined);
});
test('invalid crop cannot be saved or applied',()=>{
 for(const crop of [[-.1,0,.5,.5],[.5,0,.6,1],[0,0,0,.5],[0,0,NaN,1]]){
 const p=project();p.slides[0].elements[0].crop=crop;assert(validateProject(p).some(i=>/crop/.test(i)));
 const r=applyEditCommand(project(),{slideId:'one',elementId:'photo',type:'image',src,crop});assert.equal(r.ok,false);
 }
});
test('PPTX retains editable original image with exact arbitrary two-axis source crop',async()=>{
 const collection={revision:'crop-test',slides:[{slideId:'one',objects:[{id:'photo',type:'image',src,bounds:[120,140,400,320],fit:'cover',crop:[.1,.2,.5,.4],naturalWidth:1000,naturalHeight:1000,style:{}}]}]};
 const {pptx}=composeEditablePptx(PptxGenJS,collection),zip=await JSZip.loadAsync(await writeEditablePackage(pptx,collection));
 const xml=await zip.file('ppt/slides/slide1.xml').async('string');assert.match(xml,/<a:srcRect l="10000" r="40000" t="20000" b="40000"\/>/);assert.equal((xml.match(/<p:pic>/g)||[]).length,1);
});
