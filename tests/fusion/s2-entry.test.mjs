import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {buildStyleOptions,resolveChoice} from '../../skills/dawang-ppt/project/src/fusion/kimi/style-options.mjs';
const cli='skills/dawang-ppt/scripts/dawang.mjs';
test('daily appearance choices exclude family and unavailable entries',()=>{
 const options=buildStyleOptions({primary:'management-report'},{presets:[{category:'work',name:'moon-white-imagery',presetId:'kimi-preset:work/moon-white-imagery'}]});
 assert(options.tiles.length>=1&&options.tiles.length<=9);
 assert(options.tiles.every(t=>t.implemented&&t.styleId.startsWith('legacy/')));
 for(const t of options.tiles)assert.equal(resolveChoice(options,t.index).layoutEngine,'content-first');
 assert.throws(()=>resolveChoice(options,'kimi/work/moon-white-imagery'));
});
test('styles command exposes only usable appearances and templates are explicit',()=>{
 const styles=JSON.parse(execFileSync(process.execPath,[cli,'styles'],{encoding:'utf8'}));
 assert(styles.length>=1&&styles.length<=9);
 assert(styles.every(s=>s.id.startsWith('legacy/')&&s.layoutEngine==='content-first'));
 const templates=JSON.parse(execFileSync(process.execPath,[cli,'templates'],{encoding:'utf8'}));
 assert.equal(templates.length,17);
});
test('default build expects a content brief rather than a legacy goal',()=>{
 const source=fs.readFileSync(cli,'utf8');
 assert.match(source,/build: "render:brief"/);
 const pkg=JSON.parse(fs.readFileSync('package.json'));
 assert.match(pkg.scripts.build,/dawang.mjs build$/);
});
test('build rejects a legacy goal and retired family before creating output',async()=>{
 const {default:os}=await import('node:os');const {default:path}=await import('node:path');const {spawnSync}=await import('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'s2-default-'));
 try{for(const input of [{title:'旧目标',slides:[{layout:'theme14_page007',props:{}}]}, {title:'历史家族',styleId:'kimi/work/moon-white-imagery',contentSlides:[{slideId:'one',title:'内容'}]}]){
  const file=path.join(dir,'brief.json'),output=path.join(dir,'deck/index.html');fs.writeFileSync(file,JSON.stringify(input));
  const r=spawnSync(process.execPath,[cli,'build',file,output],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/contentSlides|旧家族工程/);assert(!fs.existsSync(output));
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('appearance grid provides exactly the usable options with a matching sidecar',async()=>{
 const {default:os}=await import('node:os');const {default:path}=await import('node:path');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'s2-board-'));
 try{const file=path.join(dir,'appearance.html');execFileSync(process.execPath,[cli,'styles:grid','management-report',file]);
 const html=fs.readFileSync(file,'utf8'),options=JSON.parse(fs.readFileSync(path.join(dir,'appearance.json')));
 assert.equal((html.match(/<article/g)||[]).length,9);assert.equal(options.tiles.length,6);assert(!html.includes('kimi/'));assert(html.includes('暂无更多已适配外观'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
