import test from 'node:test';
import assert from 'node:assert/strict';
import * as styles from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import {materializeElements} from '../../skills/dawang-ppt/project/src/fusion/scene/model.mjs';
test('per-deck palette is preserved through semantic derivation without changing original themes',()=>{
 assert.equal(typeof styles.resolveSlideStyle,'function');
 const before=styles.resolveStyle('legacy/theme14');
 const slide={styleId:'legacy/theme14',appearance:{palette:{bg:'#ffffff',ink:'#16283C',header:'#16283C',accent:'#C0652B'}},elements:[],objects:[{objectId:'t',kind:'table',bounds:[0,0,400,200],data:{columns:[{columnId:'a',label:'合成列'}],rows:[{rowId:'r',cells:{a:'合成文字'}}]},overrides:{}}]};
 assert.equal(styles.resolveSlideStyle(slide).palette.bg,'#ffffff');
 assert.equal(materializeElements(slide).find(e=>e.type==='text'&&e.id.includes('/cell/')).style.color,'#16283C');
 assert.deepEqual(styles.resolveStyle('legacy/theme14'),before);
});
