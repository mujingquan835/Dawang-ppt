export function composeEditablePptx(PptxGenJS,collection,{title='Dawang-PPT'}={}){
 const issues=collection.slides.flatMap(s=>s.issues||[]);if(issues.length)throw new Error('Export blocked: '+JSON.stringify(issues));
 const pptx=new PptxGenJS();pptx.defineLayout({name:'DAWANG',width:13.3333333333,height:7.5});pptx.layout='DAWANG';pptx.title=title;pptx.subject=`ProjectV2 revision ${collection.revision}`;pptx.author='Dawang-PPT';pptx.lang='zh-CN';
 const color=(v,fallback)=>v?.replace('#','')||fallback;const report={revision:collection.revision,texts:0,images:0,shapes:0,lines:0,decorations:[],issues:[]};
 for(const s of collection.slides){const slide=pptx.addSlide();
 for(const o of s.objects){const [x,y,w,h]=o.bounds.map(v=>v/144);if(w<=0||h<=0)continue;const st=o.style||{};const box={x,y,w,h};
 if(o.type==='text'){slide.addText(o.text,{...box,margin:0,wrap:st.wrap!==false,breakLine:false,fontFace:(st.fontFamily||'Arial').split(',')[0].replaceAll('"','').trim(),fontSize:(st.fontSize||34)/2,bold:Number(st.fontWeight)>=600,italic:st.fontStyle==='italic',color:color(st.color,'111111'),align:['left','right','center','justify'].includes(st.textAlign)?st.textAlign:'left',valign:'top',paraSpaceAfter:0,charSpacing:0});report.texts++;}
 else if(o.type==='image'){const opts=o.src.startsWith('data:')?{data:o.src}:{path:o.src};const ratio=o.naturalWidth/o.naturalHeight;if(!Number.isFinite(ratio)||ratio<=0)throw new Error('Image intrinsic dimensions missing: '+o.id);if(o.fit==='cover'){slide.addImage({...opts,x,y,w:ratio,h:1,sizing:{type:'cover',w,h}});}else{const iw=Math.min(w,h*ratio),ih=iw/ratio;slide.addImage({...opts,x:x+(w-iw)/2,y:y+(h-ih)/2,w:iw,h:ih});}report.images++;}
 else if(o.type==='shape'){slide.addShape(o.shape==='ellipse'?pptx.ShapeType.ellipse:st.radius>0?pptx.ShapeType.roundRect:pptx.ShapeType.rect,{...box,rectRadius:(st.radius||0)/144,rotate:st.rotate||0,fill:{color:color(st.fill,'FFFFFF'),transparency:st.fill?(st.fillTransparency||0):100},line:{color:color(st.stroke,'FFFFFF'),transparency:st.stroke?(st.strokeTransparency||0):100,width:(st.strokeWidth||0)/2}});report.shapes++;}
 else if(o.type==='line'){const pts=o.points||[0,0,o.bounds[2],o.bounds[3]];slide.addShape(pptx.ShapeType.line,{x:x+pts[0]/144,y:y+pts[1]/144,w:(pts[2]-pts[0])/144,h:(pts[3]-pts[1])/144,line:{color:color(st.stroke,'111111'),transparency:st.strokeTransparency||0,width:(st.strokeWidth||3)/2,beginArrowType:o.startArrow,endArrowType:o.endArrow}});report.lines++;}
 else throw new Error('Unsupported core object '+o.type);
 }
 }
 return{pptx,report};
}
