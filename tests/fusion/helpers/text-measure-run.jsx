import assert from 'node:assert/strict';import React from '../../../skills/dawang-ppt/project/node_modules/react/index.js';import {renderToStaticMarkup} from '../../../skills/dawang-ppt/project/node_modules/react-dom/server.node.js';
import {chromium} from '../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import {SceneElement} from '../../../skills/dawang-ppt/project/src/fusion/scene/render.jsx';
import {resolveSlideStyle} from '../../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import {createLayoutMeasurer} from '../../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs';
const specs=[
 {text:'中文实际字体测量，保留事实与限定。',style:{fontFamily:'Arial',fontSize:34}},
 {text:'HTML 2026 中文 English 42.5%',style:{fontFamily:'Arial',fontSize:38,fontWeight:700,letterSpacing:1.5}},
 {text:'第一行\nSecond line\n第三行',style:{fontFamily:'Arial',fontSize:32,lineHeight:1.7}},
 {runs:[{text:'中文 A12\n',style:{fontFamily:'Arial',fontSize:64,fontWeight:700}},{text:'强调与Mixed文字',style:{fontSize:24,fontFamily:'Times New Roman',letterSpacing:2}}],style:{fontFamily:'Arial',fontSize:32,lineHeight:1.3}},
 {text:'窄文本框要按实际字符换行而不是猜测高度',style:{fontFamily:'Arial',fontSize:34},bounds:[0,0,105,300]},
 {text:'默认字号'}
].map((s,i)=>({id:'text-'+i,type:'text',bounds:[0,0,300,400],...s}));
const style=resolveSlideStyle({styleId:'authored/custom',authoring:{engine:'kimi-authored-v1'}}),m=await createLayoutMeasurer(),browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{const measured=await m.texts(specs,style),page=await browser.newPage();await page.setContent('<!doctype html><style>body{margin:0}</style>'+specs.map(element=>renderToStaticMarkup(<SceneElement element={element} styleDefinition={style}/>)).join(''));const actual=await page.evaluate(async()=>{await document.fonts.ready;return [...document.querySelectorAll('[data-element-type="text"]')].map(el=>{el.style.height='auto';return {id:el.dataset.fusionElement,height:el.getBoundingClientRect().height};});});for(const item of actual){const value=measured.find(r=>r.id===item.id);assert(Math.abs(value.height-item.height)<=2,JSON.stringify({item,value}));}console.log('formal SceneElement text measurement error <= 2 logical px for six specs');}finally{await m.close();await browser.close();}
