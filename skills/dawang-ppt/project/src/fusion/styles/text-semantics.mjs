import {bodyPx} from './registry.mjs';
// Reading roles are independent of tables/flows; the saved project sets the body baseline.
function semanticTextStyle(role,s,size=bodyPx(s)){
 const colors={context:s.palette.muted,action:s.palette.body||s.palette.ink,body:s.palette.body||s.palette.ink,identity:s.palette.ink,support:s.palette.muted,emphasis:s.palette.accent,heading:s.palette.ink,empty:s.palette.quiet||s.palette.line};
 return {fontSize:role==='identity'?36:role==='heading'?32:Math.max(bodyPx(s),size),fontWeight:['identity','heading','emphasis'].includes(role)?600:400,color:colors[role]||colors.body,lineHeight:1.12};
}
function cellSemanticRole(o,row,col,value){return value==='—'?'empty':row.cellRoles?.[col.columnId]||col.semanticRole||'body';}
async function fitSemanticTable(o,s,measurer){
 const cols=o.data.columns,rows=o.data.rows,total=cols.reduce((v,c)=>v+c.width,0),hs=[];
 o.data.cellMetrics={};
 const headers=await measurer.texts(cols.map(c=>({id:c.columnId,type:'text',text:c.label,bounds:[0,0,o.bounds[2]*c.width/total-28,0],style:{...semanticTextStyle(c.headerRole||'context',s,bodyPx(s)),fontWeight:600}})),s);
 hs.push(Math.max(...headers.map(m=>m.height))+12);
 for(const row of rows){let rh=0;
  for(const col of cols){const secondary=row.secondaryCells?.[col.columnId],w=o.bounds[2]*col.width/total-28;
   const specs=[{id:'primary',type:'text',text:row.cells[col.columnId],bounds:[0,0,w,0],style:semanticTextStyle(cellSemanticRole(o,row,col,row.cells[col.columnId]),s,o.data.fontSize)}];
   if(secondary)specs.push({id:'secondary',type:'text',text:secondary.text,bounds:[0,0,w,0],style:semanticTextStyle(secondary.semanticRole||'support',s,bodyPx(s))});
   const ms=await measurer.texts(specs,s),primaryHeight=ms[0].height+2,secondaryHeight=ms[1]?ms[1].height+2:0;
   o.data.cellMetrics[row.rowId+'/'+col.columnId]={primaryHeight,secondaryHeight};rh=Math.max(rh,primaryHeight+(secondaryHeight?secondaryHeight+4:0)+12);
  }hs.push(rh);
 }
 o.data.headerWeight=hs[0];rows.forEach((r,i)=>r.height=hs[i+1]);return hs.reduce((a,b)=>a+b,0);
}
export {semanticTextStyle,cellSemanticRole,fitSemanticTable};
