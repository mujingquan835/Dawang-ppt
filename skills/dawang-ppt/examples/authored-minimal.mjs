import fs from 'node:fs';
import {textElement,imageElement,lineElement} from '../project/src/fusion/authoring/elements.mjs';
// Usage example, not a layout catalogue. All supported elements/custom geometry remain available.
// Key lines: contentPlan.throughLine (deck) and contentPlan.slides[i].keyLine (page) point at real text elements;
// contentPlan.authorNotes lists material meant only for the author, which must not appear on slides.
// Visual decisions: contentPlan.slides[i].visualDecision names the focus words ({elementId,text}), the layout, and zones
// ([{id,role,bounds}]) dividing the page; the focus must look different from its lead-in, elements sit inside zones.
// Palette: designChoice.appearance.palette is the deck default; a slide's own appearance.palette overrides only the keys it sets.
// Rule checklist: contentPlan.ruleChecklist records one entry per section from `rules:checklist <scenario>`; applied
// entries say how the section is honoured and name the elements that carry it, the rest give a reason.
const done=(how,...elementIds)=>({status:'applied',how,evidence:[{slideId:'one',elementIds}]}),skip=(reason)=>({status:'not-applicable',reason});
const ruleChecklist={scenario:'management-report',items:{
 'general#Requirements':done('读者任务写进主张；字号、留白与细线统一；只用一张相关示意图，无外部事实','claim','body','rule','image'),
 'scenario#Clear and direct content; no empty talk':done('标题直接陈述主张，只用合成材料原句，用词贴合制作者身份','claim','body'),
 'scenario#Visualize information with structural diagrams':skip('单一主张，无进度、职责或依赖关系'),
 'scenario#Key Requirements':done('细线与字号对比分层、未用卡片，左文右图非均分','claim','rule','image'),
 'scenario#Visual References':done('单一克制字体，主张固定左上，细线作为母题，无阴影渐变','claim','rule'),
 'scenario#Color Palette Reference':done('暖白背景配灰绿强调色，避开模板蓝','claim','rule')}};
export const authored={requirements:{projectId:'synthetic-example',title:'从材料到可编辑HTML',fixedPageCount:1},sources:{entries:[{sourceId:'synthetic',kind:'synthetic'}]},media:{entries:[]},contentPlan:{nodes:{claim:{text:'让内容决定构图'}},slides:[{slideId:'one',readerTask:'理解制作原则',keyLine:{elementId:'claim',source:'distilled',support:['材料要求先理解内容再排版']},visualDecision:{pattern:'free：单句主张页，没有可套用的页型',focus:{elementId:'claim'},layout:'整句主张即重点，独立成全页最大字号；正文在下，右上小图仅作示意',zones:[{id:'claim',role:'focus',bounds:[120,120,1300,420]},{id:'image',role:'media',bounds:[1440,100,240,240]}]}}],throughLine:{placements:[{slideId:'one',elementId:'claim'}],source:'distilled',support:['材料要求先理解内容再排版']},authorNotes:[{text:'示例数据为合成材料，不代表真实项目',reason:'制作说明'}],ruleChecklist},designChoice:{styleId:'authored/custom',direction:'自由构图示例',appearance:{palette:{bg:'#FFFFFF',ink:'#1F2A27',muted:'#5F6B66',accent:'#448877',line:'#D5DDD9'}}},slides:[{slideId:'one',appearance:{palette:{bg:'#F7F5F0'}},elements:[textElement({id:'claim',contentRef:'claim',bounds:[120,140,1300,160],style:{fontFamily:'Arial',fontSize:80}}),textElement({id:'body',text:'保留事实与证据，实际测量后复核。',bounds:[120,360,1400,150],style:{fontFamily:'Arial',fontSize:44}}),lineElement({id:'rule',from:[120,600],to:[1600,600],style:{stroke:'#448877',strokeWidth:4}}),imageElement({id:'image',src:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="45" fill="#448877"/></svg>').toString('base64'),bounds:[1450,120,200,200]})]}]};
if(process.argv[1]===import.meta.filename){if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(authored,null,2));else console.log(JSON.stringify(authored,null,2));}
