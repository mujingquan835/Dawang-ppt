import { planSlide } from './plan-slide.mjs';
import { composeFrame } from '../styles/frame-presets.mjs';
import { bindElementAppearance, geometryTokens } from '../styles/appearance.mjs';
import { assignElementRoles } from '../project/roles.mjs';

// These shared presets express relationships; skins contribute preferences and frame data.
function generateLayoutCandidates(content, style, measurements = {}) {
  const decision = planSlide(content, style);
  if (!decision.ok || decision.mode !== 'composition') return [];
  const kind = decision.objectKind, id = content.slideId;
  if (!id) throw new Error('Stable slideId required for planning');
  const { elements, bounds: originalBounds, sourceAdaptation } = composeFrame(content, style, kind === 'images' ? 'text' : kind);
  const title = elements.find(e => e.role === 'title');
  const description = elements.find(e => ['scope','explanation'].includes(e.id));
  const titleH = measurements.titleHeight || title.bounds[3];
  title.bounds[3] = titleH;
  if (content.titleRef) title.contentRef = content.titleRef;
  let bodyY = title.bounds[1] + titleH + 28;
  if (description) {
    description.bounds[1] = bodyY;
    description.bounds[3] = measurements.descriptionHeight || description.bounds[3];
    bodyY += description.text ? description.bounds[3] + 28 : 0;
    if (content.scopeRef || content.explanationRef) description.contentRef = content.explanationRef || content.scopeRef;
  }
  const rule = elements.find(e => ['content-rule','evidence-rule'].includes(e.id));
  if (rule) { rule.bounds[1] = bodyY; bodyY += 30; }
  const bounds = [originalBounds[0], bodyY, originalBounds[2], 990 - bodyY];
  // Keep judgment/method rails. They are genuine supplied content, not invented filler.
  const specs = kind === 'images' ? [{id:'images/balanced-rows',maxRows:3},{id:'images/single-row',maxRows:1},{id:'images/two-rows',maxRows:2}]
    : ['process','causal','comparison','timeline'].includes(kind) ? [{id:'relation/vertical',direction:'vertical'},{id:'relation/horizontal',direction:'horizontal'},{id:'relation/alternating',direction:'alternating'}]
    : kind === 'text' ? [{id:'text/reading',bodySize:34},{id:'text/compact',bodySize:30},{id:'text/large',bodySize:38}]
    : [{id:'evidence/normal',bodySize:32},{id:'evidence/compact',bodySize:28},{id:'evidence/large',bodySize:36}];
  return specs.map(spec => {
    const object = {objectId:id+'-primary',kind,layoutVersion:2,bounds:[...bounds],data:{...structuredClone(content.data || {}),...spec.direction ? {direction:spec.direction} : {},...spec.maxRows ? {arrangement:'justified',maxRows:spec.maxRows} : {},fontSize:spec.bodySize || 28},overrides:{},geometryTokens:geometryTokens(style),relationshipPolicy:content.relationships !== undefined ? 'explicit' : 'sequence',...content.relationships !== undefined ? {relationships:structuredClone(content.relationships)} : {}};
    const slide = {slideId:id,mode:'composition',styleId:style.id,styleBindingVersion:1,compositionId:spec.id,label:content.title,elements:structuredClone(elements.filter(e=>!['scope','explanation'].includes(e.id)||e.text)),objects:kind === 'text' ? [] : [object],readerTask:content.readerTask,requiredContentRefs:content.requiredContentRefs || [],sourceAdaptation};
    const frameHasExplanation = elements.some(e=>e.id==='explanation' && e.text);
    const items = [...(!frameHasExplanation && content.explanation ? [{body:content.explanation,contentRef:content.explanationRef}] : []), ...(content.points || [])];
    if (kind === 'text' || items.length) {
      const textBounds = [...bounds];
      if (kind !== 'text') {
        const rail = bounds[2]*.34, gap = style.grid.gap;
        textBounds[2] = rail;
        object.bounds = [bounds[0]+rail+gap,bounds[1],bounds[2]-rail-gap,bounds[3]];
      }
      const [tx,ty,tw,th] = textBounds;
      const rowH = (th - (items.length - 1)*32) / Math.max(1,items.length);
      items.forEach((item,i) => {
        const v = typeof item === 'string' ? {body:item} : item;
        const y = ty+i*(rowH+32), heading = v.heading || v.title;
        if (heading) slide.elements.push({id:'point/'+i+'/heading',type:'text',role:'heading',text:heading,bounds:[tx,y,tw,50],style:{fontSize:(spec.bodySize || 32)+6,color:style.palette.accent}});
        slide.elements.push({id:'point/'+i+'/body',type:'text',role:'body',text:v.body || v.detail || '',contentRef:v.contentRef,bounds:[tx,y+(heading?62:0),tw,rowH-(heading?62:0)],style:{fontSize:spec.bodySize || 32,color:style.palette.ink,lineHeight:1.3}});
      });
    }
    assignElementRoles(slide);
    slide.elements=slide.elements.map(e=>bindElementAppearance(e,style));
    return {presetId:spec.id,slide,contentBounds:bounds,reason:decision.reason};
  });
}
export { generateLayoutCandidates };
