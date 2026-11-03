import fs from 'node:fs';
import {textElement,imageElement,lineElement} from '../project/src/fusion/authoring/elements.mjs';
// Usage example, not a layout catalogue. All supported elements/custom geometry remain available.
// Key lines: contentPlan.throughLine (deck) and contentPlan.slides[i].keyLine (page) point at real text elements;
// contentPlan.authorNotes lists material meant only for the author, which must not appear on slides.
// Visual decisions: contentPlan.slides[i].visualDecision names the focus words ({elementId,text}) and the layout; the focus must look different from its lead-in.
// Palette: designChoice.appearance.palette is the deck default; a slide's own appearance.palette overrides only the keys it sets.
// Kimi rule checklist: contentPlan.ruleChecklist records every item from `rules:checklist <scenario>`; applied items name
// the elements that carry them, the rest give a reason. A section id may dismiss all of its items at once.
const done=(how,...elementIds)=>({status:'applied',how,evidence:[{slideId:'one',elementIds}]}),skip=(reason)=>({status:'not-applicable',reason});
const ruleChecklist={scenario:'management-report',items:{
 'general#Requirements#1':done('本页读者任务：理解制作原则','claim'),'general#Requirements#2':skip('单页示例，无翻页节奏'),
 'general#Requirements#3':skip('无复杂数据结构'),'general#Requirements#4':done('字号、留白与细线统一处理','claim','body','rule'),
 'general#Requirements#5':done('仅用一张与主题相关的示意图','image'),'general#Requirements#6':skip('无用户品牌或模板'),'general#Requirements#7':skip('无外部事实与数据'),
 'scenario#Clear and direct content; no empty talk#1':done('标题直接陈述主张','claim'),'scenario#Clear and direct content; no empty talk#2':skip('单页示例，无封面'),
 'scenario#Clear and direct content; no empty talk#3':done('只使用合成材料原句，未补造数据','body'),'scenario#Clear and direct content; no empty talk#4':done('用词贴合制作者身份','body'),
 'scenario#Clear and direct content; no empty talk#5':skip('无现场动画需求'),
 'scenario#Visualize information with structural diagrams':skip('单一主张，无进度、职责或依赖关系'),
 'scenario#Key Requirements#1':done('层级与留白逐项调整','claim','body'),'scenario#Key Requirements#2':done('用细线与字号对比分层，未用卡片','rule'),'scenario#Key Requirements#3':done('左文右图非均分','claim','image'),
 'scenario#Visual References#1':skip('示例只用单一字体以保证测试可复现'),'scenario#Visual References#2':done('字体与配色同为克制风格','claim'),
 'scenario#Visual References#3':done('主张固定在左上，图在右上','claim','image'),'scenario#Visual References#4':skip('无图表'),'scenario#Visual References#5':skip('无 SmartArt 需求'),
 'scenario#Visual References#6':done('无阴影、无渐变','rule'),'scenario#Visual References#7':done('细线作为母题','rule'),
 'scenario#Color Palette Reference#1':done('灰绿强调色，避开模板蓝','rule'),'scenario#Color Palette Reference#2':done('暖白背景','claim')}};
export const authored={requirements:{projectId:'synthetic-example',title:'从材料到可编辑HTML',fixedPageCount:1},sources:{entries:[{sourceId:'synthetic',kind:'synthetic'}]},media:{entries:[]},contentPlan:{nodes:{claim:{text:'让内容决定构图'}},slides:[{slideId:'one',readerTask:'理解制作原则',keyLine:{elementId:'claim',source:'distilled',support:['材料要求先理解内容再排版']},visualDecision:{focus:{elementId:'claim'},layout:'整句主张即重点，独立成全页最大字号；正文在下，右上小图仅作示意'}}],throughLine:{placements:[{slideId:'one',elementId:'claim'}],source:'distilled',support:['材料要求先理解内容再排版']},authorNotes:[{text:'示例数据为合成材料，不代表真实项目',reason:'制作说明'}],ruleChecklist},designChoice:{styleId:'authored/custom',direction:'自由构图示例',appearance:{palette:{bg:'#FFFFFF',ink:'#1F2A27',muted:'#5F6B66',accent:'#448877',line:'#D5DDD9'}}},slides:[{slideId:'one',appearance:{palette:{bg:'#F7F5F0'}},elements:[textElement({id:'claim',contentRef:'claim',bounds:[120,140,1300,160],style:{fontFamily:'Arial',fontSize:80}}),textElement({id:'body',text:'保留事实与证据，实际测量后复核。',bounds:[120,360,1400,150],style:{fontFamily:'Arial',fontSize:44}}),lineElement({id:'rule',from:[120,600],to:[1600,600],style:{stroke:'#448877',strokeWidth:4}}),imageElement({id:'image',src:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="45" fill="#448877"/></svg>').toString('base64'),bounds:[1450,120,200,200]})]}]};
if(process.argv[1]===import.meta.filename){if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(authored,null,2));else console.log(JSON.stringify(authored,null,2));}
