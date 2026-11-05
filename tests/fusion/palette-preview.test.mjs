import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {renderPalettePreview,validatePaletteOptions} from '../../skills/dawang-ppt/scripts/palette-preview.mjs';
const option=(id='blue')=>({id,name:'清晰蓝',reason:'便于核对数据和状态',source:'测试用自主配色',palette:{bg:'#F3F6FB',ink:'#1D2E4A',accent:'#285EA8',muted:'#58677D',line:'#DFE8F5'}});
test('preview applies each candidate palette to headline, copy and structural areas',()=>{
 const html=renderPalettePreview({title:'汇报配色选择',options:[option(),{...option('dark'),name:'墨金',palette:{bg:'#1B1D1A',ink:'#F4F1E8',accent:'#E8BC60',muted:'#AFB2A7',line:'#30332D'}}]});
 assert.match(html,/data-palette-id="blue"/);assert.match(html,/data-palette-id="dark"/);assert.match(html,/#F3F6FB/);assert.match(html,/#E8BC60/);assert.match(html,/便于核对数据和状态/);assert.match(html,/测试用自主配色/);
});
test('all display strings are escaped, including names, reason and source',()=>{
 const v=option();v.name='<script>alert(1)</script>';v.reason='a < b';v.source='<img onerror=bad>';
 const html=renderPalettePreview({title:'<unsafe>',options:[v]});assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img onerror'));assert.match(html,/&lt;unsafe&gt;/);assert.match(html,/a &lt; b/);
});
test('unsafe paint values and incomplete recommendations fail before rendering',()=>{
 assert.throws(()=>renderPalettePreview({options:[{...option(),palette:{...option().palette,bg:'url(https://bad)'}}]}),/palette.bg/);
 assert.throws(()=>renderPalettePreview({options:[{...option(),reason:''}]}),/reason/);
});
test('stable option IDs are required and unique',()=>{
 assert.throws(()=>validatePaletteOptions({options:[option(),option()]}),/duplicate/);
 assert.throws(()=>validatePaletteOptions({options:[{...option(),id:'" onclick="bad'}]}),/id/);
});
test('short hexadecimal paints normalize and optional surface has a real fallback',()=>{
 const a=validatePaletteOptions({options:[{...option(),palette:{...option().palette,bg:'#fff'}}]});assert.equal(a.options[0].palette.bg,'#FFFFFF');assert.equal(a.options[0].palette.surface,'#FFFFFF');
});
for(const viaLink of [false,true])test(`CLI writes the requested preview through ${viaLink?'a linked skill directory':'the direct skill directory'}`,()=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'dawang-palette-cli-')));
 try{
  const skill=fileURLToPath(new URL('../../skills/dawang-ppt/',import.meta.url));
  const linked=path.join(dir,'installed-skill');
  if(viaLink)fs.symlinkSync(skill,linked,'dir');
  fs.writeFileSync(path.join(dir,'options.json'),JSON.stringify({options:[option()]}));
  const run=spawnSync(process.execPath,[path.join(viaLink?linked:skill,'scripts/palette-preview.mjs'),'options.json','preview.html'],{cwd:dir,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  assert.ok(fs.existsSync(path.join(dir,'preview.html')),'successful invocation must create the requested preview');
  assert.match(fs.readFileSync(path.join(dir,'preview.html'),'utf8'),/data-palette-id="blue"/);
  assert.equal(JSON.parse(run.stdout).html,path.join(dir,'preview.html'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a report palette is referenced by id and previewed as a small report page with its colour roles', () => {
  const data = validatePaletteOptions({ options: [{ report: 'blue-gold', reason: '稳重正式' }, { report: '红金' }] });
  assert.equal(data.options[0].id, 'blue-gold');
  assert.equal(data.options[0].palette.primary, '#23338B');
  assert.equal(data.options[1].name, '红金');
  assert.match(data.options[1].source, /九组汇报配色/);
  const html = renderPalettePreview({ options: [{ report: 'blue-gold' }] });
  assert.match(html, /class="answer"/);
  assert.match(html, /class="pair"/);
  assert.match(html, /--pop:#FA6500/);
  assert.throws(() => validatePaletteOptions({ options: [{ report: 'nope' }] }), /unknown report palette/);
});
