import fs from 'node:fs';
import {textElement as text,lineElement as line} from '../../skills/dawang-ppt/project/src/fusion/authoring/elements.mjs';
const C={bg:'#F7F3E8',ink:'#123B2F',muted:'#56685D',accent:'#8B6A26',line:'#CCCFC2',pale:'#E1E7DD',white:'#FAF8F1'};
const t=(id,txt,x,y,w,h,size=34,color=C.ink,weight=400)=>text({id,text:txt,bounds:[x,y,w,h],style:{fontFamily:'Arial',fontSize:size,color,fontWeight:weight,lineHeight:1.22}});
const l=(id,x1,y1,x2,y2,color=C.line,width=2)=>line({id,from:[x1,y1],to:[x2,y2],style:{stroke:color,strokeWidth:width}});
const shape=(id,x,y,w,h,fill)=>({id,type:'shape',bounds:[x,y,w,h],style:{fill}});
const v=(id,bounds,p,stroke=C.ink,width=3)=>({id,type:'vector',bounds,viewBox:[0,0,bounds[2],bounds[3]],path:p,style:{fill:'none',stroke,strokeWidth:width,strokeLinejoin:'round'}});
const footer=(n,dark=false)=>[l('footer-line',110,975,1810,975,dark?'#4C675A':C.line),t('footer-note','公开合成示例 · 数量与业务内容仅用于演示',110,997,1380,35,22,dark?'#CFD9CD':C.muted),t('page-number',String(n).padStart(2,'0')+' / 04',1650,997,160,35,22,dark?'#CFD9CD':C.muted)];
const tag=(label,dark=false)=>t('eyebrow',label,110,78,1600,42,26,dark?'#D7C894':C.accent,600);
export const authored={
 requirements:{projectId:'dawang-public-showcase-20261031',title:'跨团队交接试点 · Dawang-PPT 合成示例',fixedPageCount:4},
 sources:{entries:[{sourceId:'synthetic-material',kind:'synthetic',source:'examples/showcase/material.md',description:'公开虚构材料，无真实业务数据或产品成效主张。'}]},media:{entries:[]},
 contentPlan:{nodes:{},throughLine:{placements:[{slideId:'opening',elementId:'claim'}],source:'created',support:['合成材料中接收状态及下一步须明确，不能把未确认任务当作已开始执行。']},authorNotes:[],slides:[
  {slideId:'opening',readerTask:'理解试点主题和当前记录',keyLine:{elementId:'claim',source:'created',support:['任务交接应保留接收确认及下一步状态。']}},
  {slideId:'numbers',readerTask:'理解34项任务的状态划分',keyLine:{elementId:'claim',source:'distilled',support:['合成记录：34项中27项已完成、7项待确认。']}},
  {slideId:'flow',readerTask:'理解接收与资料不足分支',keyLine:{elementId:'claim',source:'distilled',support:['资料完整才确认接收，未确认前不能视为已开始执行；不完整返回补充。']}},
  {slideId:'plan',readerTask:'理解计划与观察边界',keyLine:{elementId:'claim',source:'created',support:['合成材料拟用一周试点，记录资料、接收及卡点，不预设改善效果。']}}
 ]},
 designChoice:{styleId:'authored/custom',direction:'暖纸色与墨绿；开放线条、字号差和非等分构图；每页按内容关系设计。',appearance:{palette:{bg:C.bg,ink:C.ink,muted:C.muted,accent:C.accent,line:C.line}}},
 slides:[
 {slideId:'opening',elements:[tag('DAWANG-PPT / 可编辑成稿示例'),t('claim','让跨团队交接\n有清楚的下一步',110,218,1120,290,104,C.ink,700),t('intro','跨团队交接试点',116,570,1000,70,42,C.ink,600),t('status','示例第 1 周：27 项已完成，7 项待确认。',116,674,1060,90,34,C.muted),
  l('open-route',1360,282,1744,282,C.ink,4),l('route-down',1744,282,1744,682,C.ink,4),l('route-bottom',1464,682,1744,682,C.ink,4),v('route-tip',[1438,668,28,28],'M 27 0 L 1 14 L 27 28'),t('right-label','交接',1358,190,250,60,42,C.ink,600),t('right-confirm','确认',1575,405,180,70,42,C.ink,600),t('right-next','下一步',1320,753,400,75,52,C.ink,600),...footer(1)]},
 {slideId:'numbers',elements:[tag('01 / 数量与状态'),t('claim','34 项任务，27 项已完成',110,177,1690,110,76,C.ink,700),t('total','34',112,356,620,230,180,C.ink,700),t('total-label','项交接任务',120,610,600,75,42,C.muted),
  t('complete-count','27 项',885,375,560,90,64,C.ink,700),t('complete-label','已完成',1480,402,300,60,36,C.muted),shape('complete-bar',888,496,890,38,C.ink),
  t('pending-count','7 项',885,607,560,90,64,C.accent,700),t('pending-label','待确认',1480,632,300,60,36,C.muted),shape('pending-bar',888,726,231,38,C.accent),
  t('basis','口径：示例第 1 周记录；34 = 27 + 7。',116,829,1500,55,30,C.muted),t('limit','“待确认”保留为独立状态，不当作失败或取消。',116,892,1600,48,30,C.ink),...footer(2)]},
 {slideId:'flow',elements:[tag('02 / 带分支的工作流程'),t('claim','确认接收后，再进入下一步',110,177,1690,110,76,C.ink,700),
  ...[['submit','01','提交交接',112],['check','02','核对资料',532],['accept','03','确认接收',1010],['execute','04','开始执行',1474]].flatMap(([id,num,txt,x])=>[t(id+'-number',num,x,380,240,50,28,C.accent,600),t(id,txt,x,470,360,78,52,C.ink,600)]),
  ...[[410,516],[884,516],[1348,516]].flatMap(([x,y],i)=>[l('connector-'+i,x,y,x+76,y,C.ink,3),v('arrow-'+i,[x+64,y-9,14,18],'M 0 0 L 12 9 L 0 18')]),
  t('condition','资料完整',992,592,420,50,28,C.muted),v('return-path',[292,585,415,200],'M 415 0 L 415 168 L 0 168 L 0 0',C.accent,3),v('return-head',[280,581,24,20],'M 0 18 L 12 1 L 24 18',C.accent,3),t('return-label','资料不完整 → 返回补充',747,718,1020,65,38,C.accent,600),
  t('flow-limit','拟定流程示例：补齐后重新提交核对；未确认接收前不算开始执行。',116,871,1685,64,30,C.muted),...footer(3)]},
 {slideId:'plan',appearance:{palette:{bg:C.ink,ink:C.bg,muted:'#CFD9CD',accent:'#D7C894',line:'#4C675A'}},elements:[tag('03 / 拟定行动计划',true),t('claim','用一周试点\n记录交接中的卡点',110,177,1600,210,82,C.bg,700),t('plan-purpose','只记录观察，不预设改善效果。',116,430,1500,65,38,'#CFD9CD'),
  l('timeline',116,601,1790,601,'#8BA58F',3),...[[116,'第 1—2 天','建立共同清单',390],[580,'第 3—5 天','小范围试用',600],[1280,'第 6—7 天','复盘记录',500]].flatMap(([x,date,txt,w],i)=>[shape('tick-'+i,x,585,5,33,'#D7C894'),t('date-'+i,date,x,652,w,55,30,'#D7C894',600),t('action-'+i,txt,x,732,w,70,44,C.bg,600)]),
  t('plan-limit','观察：资料是否完整 / 是否确认接收 / 卡在哪一步。此页为计划，非已完成结果。',116,890,1680,50,28,'#CFD9CD'),...footer(4,true)]}
 ]
};
if(process.argv[1]===import.meta.filename)fs.writeFileSync(process.argv[2]||'/tmp/dawang-showcase-authored.json',JSON.stringify(authored,null,2));
