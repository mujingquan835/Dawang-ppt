// Warnings request a content decision, never infer business outcomes from digits.
const quantity=/\d[\d,.]*\s*(?:万元|元|张|家|份|单|箱|个|套|%|％)/u;
const natures=new Set(['result','resource','method','context']);
function reviewContent(content){
 const issues=[];
 for(const r of content.regions||[]){
  for(const p of r.paragraphs||[]){
   if(quantity.test(p.text||'')&&!(natures.has(p.dataDecision?.nature)&&p.dataDecision?.presentation==='prose'&&p.dataDecision?.reason?.trim()))issues.push({rule:'quantity-review-required',severity:'warning',regionId:r.regionId,contentRef:p.contentRef,message:'含数量的段落须判断结果/投入/背景；提为指标或记录保留正文的理由'});
  }
  if(r.kind==='metrics')for(const item of r.data?.items||[])if(content.contentReview==='required'&&(!natures.has(item.nature)||!item.valueRef||!item.labelRef))issues.push({rule:'metric-basis-required',severity:'warning',regionId:r.regionId,message:'重点值须有性质、数值来源和口径来源；合作方式不能当业绩数值'});
 }
 return issues;
}
function reviewVisualStructure(content,regions,contentBounds){
 const bottom=Math.max(contentBounds[1],...regions.map(r=>r.bounds[1]+r.bounds[3]));
 const trailingSpace=Math.max(0,contentBounds[1]+contentBounds[3]-bottom);
 const issues=[];
 if(regions.length>=3&&trailingSpace>contentBounds[3]*.25)issues.push({rule:'bottom-space-review',severity:'warning',message:'多个模块集中在上部，检查行高、模块间距与页面重心'});
 return {trailingSpace,issues,manualChecks:['重点事实是否一眼可见','标签、正文、辅助说明是否分层','单元格垂直对齐与整页重心','与原图对照并检查PowerPoint实际效果']};
}
export {reviewContent,reviewVisualStructure};
