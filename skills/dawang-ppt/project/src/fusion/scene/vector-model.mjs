const allowed = new Set(['fill','stroke','strokeWidth','strokeLinecap','strokeLinejoin','opacity']);
export function validateVector(element) {
  const issues=[];
  const box=element.viewBox;
  if(!Array.isArray(box)||box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0)issues.push('vector viewBox must contain four finite numbers with positive width and height');
  if(typeof element.path!=='string'||!/^\s*[Mm][MmLlHhVvCcSsQqTtAaZz\d.eE+,\s-]+$/.test(element.path)||[...element.path.matchAll(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)].some(m=>!Number.isFinite(Number(m[0]))))issues.push('vector path must contain SVG path commands and finite coordinates only');
  if(element.style!==undefined&&(!element.style||typeof element.style!=='object'||Array.isArray(element.style)))return [...issues,'vector style must be an object'];
  for(const [key,value] of Object.entries(element.style||{})){
    if(!allowed.has(key))issues.push('unsupported vector style '+key);
    else if(['strokeWidth','opacity'].includes(key)){if(!Number.isFinite(value)||value<0||(key==='opacity'&&value>1))issues.push('invalid vector style '+key);}
    else if(typeof value!=='string'||/[;{}<>]|url\(/i.test(value))issues.push('invalid vector style '+key);
    else if(key==='strokeLinecap'&&!['butt','round','square'].includes(value))issues.push('invalid vector strokeLinecap');
    else if(key==='strokeLinejoin'&&!['miter','round','bevel'].includes(value))issues.push('invalid vector strokeLinejoin');
  }
  return issues;
}
