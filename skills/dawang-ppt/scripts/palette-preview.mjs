import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {REPORT_PALETTES} from '../project/src/fusion/authoring/report-palettes.mjs';
import {colorRoles} from '../project/src/fusion/authoring/layout-kit.mjs';

const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function paint(value,label){
 if(typeof value!=='string'||!/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value))throw Error(label+' must be a hexadecimal color');
 return (value.length===4?'#'+[...value.slice(1)].map(c=>c+c).join(''):value).toUpperCase();
}
export function validatePaletteOptions(input){
 if(!input||!Array.isArray(input.options)||!input.options.length)throw Error('options must contain a recommendation');
 const seen=new Set();
 const options=input.options.map(o=>{
  // {report:'blue-gold'} picks one of the nine report palettes (the main candidates); name, colours and source follow.
  if(o?.report){const r=REPORT_PALETTES.find(x=>x.id===o.report||x.name===o.report);if(!r)throw Error('unknown report palette: '+o.report+' (choose '+REPORT_PALETTES.map(x=>x.id).join(' / ')+')');o={id:o.id||r.id,name:o.name||r.name,reason:o.reason||r.fit,source:o.source||'九组汇报配色：'+r.name,...(r.limits?{limits:r.limits}:{}),...o,palette:{surface:r.palette.pale,...r.palette,...(o.palette||{})}};}
  if(typeof o?.id!=='string'||!/^[-a-zA-Z0-9_]+$/.test(o.id))throw Error('option id must use letters, numbers, hyphens or underscores');
  if(seen.has(o.id))throw Error('duplicate option id: '+o.id);seen.add(o.id);
  for(const k of ['name','reason','source'])if(typeof o[k]!=='string'||!o[k].trim())throw Error(k+' is required for '+o.id);
  const palette={};for(const k of ['bg','ink','accent','muted','line'])palette[k]=paint(o.palette?.[k],'palette.'+k);
  palette.surface=paint(o.palette?.surface??palette.bg,'palette.surface');
  // Colour roles (deep primary, soft secondary, sparing pop) make the preview a small report page.
  for(const k of ['primary','secondary','pop'])if(o.palette?.[k]!==undefined)palette[k]=paint(o.palette[k],'palette.'+k);
  return {...o,palette};
 });
 return {title:typeof input.title==='string'?input.title:'请选择本次配色',options};
}
// A small report page in the palette: tag header, a solid answer block, target → actual, and three tiles where only
// the strongest carries the pop colour. Shows how much of the page each colour takes, not just the swatches.
function reportCard(o,i){
 const p=o.palette,r=colorRoles(p),v={...p,band:r.band,soft:r.soft,secink:r.secondaryInk};
 const styles=Object.entries(v).map(([k,c])=>'--'+k+':'+c).join(';');
 const sw=[['primary','主色'],['secondary','辅色'],['pop','跳色'],['bg','背景'],['ink','正文']];
 return `<article data-palette-id="${escape(o.id)}"><div class="report" style="${styles}"><header><b>成果数据 | 02</b><span>到店超目标，<em>成交转化</em>待提升</span></header><div class="row"><div class="answer"><small>整体判断</small><strong>128.6<i>%</i></strong><small>到店目标达成</small></div><div class="pair"><div class="before"><small>目标到店</small><strong>10,000</strong></div><div class="arrow">›</div><div class="after"><small>实际到店</small><strong>12,860</strong></div></div></div><div class="tiles"><div><small>成交额</small><strong>186.4<i>万元</i></strong></div><div class="hot"><small>新增会员 <u>最高</u></small><strong>3,412<i>人</i></strong></div><div><small>人均成本</small><strong>34.5<i>元</i></strong></div></div></div><div class="caption"><h3>${i+1}. ${escape(o.name)}</h3><p>${escape(o.reason)}</p><p class="source">依据：${escape(o.source)}</p>${o.limits?`<p class="limits">限制：${escape(o.limits)}</p>`:''}<div class="swatches">${sw.map(([k,l])=>`<span><i style="background:${p[k]}"></i>${l} ${p[k]}</span>`).join('')}</div></div></article>`;
}
const REPORT_CSS='.report{background:var(--bg);color:var(--ink);padding:22px}.report header{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--ink);padding-bottom:12px}.report header b{background:var(--primary);color:#fff;font-size:12px;padding:6px 10px}.report header span{font-size:18px;font-weight:700}.report header em{color:var(--primary);font-style:normal}.report .row{display:grid;grid-template-columns:0.9fr 1.3fr;gap:12px;margin-top:16px}.answer{background:var(--primary);color:#fff;padding:14px 16px;border-radius:8px;display:flex;flex-direction:column;gap:4px}.answer small{font-size:11px;opacity:.85}.answer strong{font-size:38px;line-height:1.1}.answer i,.tiles i{font-style:normal;font-size:.45em;margin-left:3px}.pair{display:grid;grid-template-columns:1fr 18px 1fr;align-items:center;gap:6px}.pair>div{border-radius:8px;padding:14px 12px;display:flex;flex-direction:column;gap:6px;height:100%;justify-content:center}.before{background:var(--soft);color:var(--secink)}.after{background:var(--band);color:var(--primary)}.pair small{font-size:11px}.pair strong{font-size:24px}.arrow{color:var(--primary);font-size:28px;text-align:center}.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.tiles>div{background:var(--band);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:6px}.tiles small{font-size:11px;color:#6b6f76}.tiles strong{font-size:22px;color:var(--ink)}.tiles .hot{box-shadow:inset 5px 0 0 var(--pop)}.tiles .hot strong{color:var(--primary)}.caption .limits{font-size:12px;color:#9A3A1F}.tiles u{text-decoration:none;background:var(--pop);color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;margin-left:4px}';
export function renderPalettePreview(input){
 const data=validatePaletteOptions(input);
 const cards=data.options.map((o,i)=>{
  const p=o.palette,styles=Object.entries(p).map(([k,v])=>'--'+k+':'+v).join(';');
  if(p.primary)return reportCard(o,i);
  return `<article data-palette-id="${escape(o.id)}"><div class="sample" style="${styles}"><small>配色应用示意</small><h2>让重点清楚，<br><em>让内容有层次。</em></h2><p>正文解释本页主张，辅助信息保留必要口径。</p><div class="structure"><b>核心内容</b><span>支持信息</span></div><footer>来源、日期与状态在实际制作时填写</footer></div><div class="caption"><h3>${i+1}. ${escape(o.name)}</h3><p>${escape(o.reason)}</p><p class="source">依据：${escape(o.source)}</p><div class="swatches">${['bg','ink','accent','muted','line'].map((k,j)=>`<span><i style="background:${p[k]}"></i>${['背景','主文','强调','辅助','结构'][j]} ${p[k]}</span>`).join('')}</div></div></article>`;
 }).join('');
 return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(data.title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#edf0ec;color:#253129;font-family:"PingFang SC","Microsoft YaHei",sans-serif}main{max-width:1500px;margin:auto;padding:32px}h1{font-size:30px;margin:0 0 12px}.intro{font-size:15px;line-height:1.7;margin:0 0 28px;color:#526158}.options{display:grid;grid-template-columns:repeat(${data.options.length===4?2:Math.min(3,data.options.length)},minmax(0,1fr));gap:20px}article{background:#fff;border:1px solid #cfd7ce;min-width:0}.sample{background:var(--bg);color:var(--ink);padding:24px;min-height:345px}.sample small{color:var(--muted);font-size:12px}.sample h2{font-size:29px;line-height:1.35;margin:26px 0 18px}.sample em{color:var(--accent);font-style:normal}.sample p{font-size:15px;line-height:1.7;margin:0 0 22px}.structure{display:flex;gap:20px;align-items:center;padding:16px 12px;background:var(--surface);border-top:4px solid var(--accent);border-bottom:1px solid var(--line);font-size:15px}.structure span{color:var(--muted)}.sample footer{font-size:11px;color:var(--muted);margin-top:22px}.caption{padding:18px 20px}.caption h3{font-size:20px;margin:0 0 10px}.caption p{font-size:14px;line-height:1.7;margin:8px 0}.caption .source{font-size:12px;color:#526158}.swatches{display:flex;flex-wrap:wrap;gap:8px;font-size:10px;color:#526158;margin-top:16px}.swatches span{display:flex;gap:4px;align-items:center}.swatches i{width:14px;height:14px;border:1px solid #a7b2a6}.notice{font-size:13px;line-height:1.8;color:#526158;margin-top:24px}${REPORT_CSS}@media(max-width:900px){.options{grid-template-columns:1fr}main{padding:20px}.sample{min-height:325px}}</style><main><h1>${escape(data.title)}</h1><p class="intro">请选择序号或名称，也可以提出调整。所选方案决定颜色职责，版式继续依据内容设计。</p><section class="options">${cards}</section><p class="notice">这是本次候选配色在同一内容结构中的应用示意，不是原版主题复刻。示意文字与结构标记不代表真实业务内容、数据或成效。</p></main></html>`;
}

// Daily skill installations are directory symlinks; compare the resolved files.
if(process.argv[1]&&fs.existsSync(process.argv[1])&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))){
 const [input,out,...rest]=process.argv.slice(2),pngIndex=rest.indexOf('--png');
 if(!input||!out||(rest.length&&!(rest.length===2&&rest[0]==='--png'&&rest[1])))throw Error('Usage: node palette-preview.mjs <options.json> <preview.html> [--png <preview.png>]');
 const data=JSON.parse(fs.readFileSync(path.resolve(input),'utf8')),html=renderPalettePreview(data),output=path.resolve(out);
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);
 let png;
 if(pngIndex>=0){
  png=path.resolve(rest[pngIndex+1]);fs.mkdirSync(path.dirname(png),{recursive:true});
  const require=createRequire(new URL('../project/package.json',import.meta.url));const {chromium}=require('playwright-core');
  const executablePath=process.env.DAWANG_CHROME_PATH||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined);
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  try{const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});await page.goto(pathToFileURL(output).href);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:png,fullPage:true});}finally{await browser.close();}
 }
 console.log(JSON.stringify({html:output,...(png?{png}:{}),options:validatePaletteOptions(data).options.map(o=>({id:o.id,name:o.name}))}));
}
