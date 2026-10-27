import test from 'node:test';
import assert from 'node:assert/strict';
import {resizeBounds,snapBounds,snapTargets} from '../../skills/dawang-ppt/project/src/fusion/editor/geometry.mjs';
test('each handle moves only its own edges and respects the minimum size',()=>{
 const b=[100,100,200,100];
 assert.deepEqual(resizeBounds(b,'se',50,20),[100,100,250,120]);
 assert.deepEqual(resizeBounds(b,'nw',50,20),[150,120,150,80]);
 assert.deepEqual(resizeBounds(b,'e',30,99),[100,100,230,100]);
 assert.deepEqual(resizeBounds(b,'n',0,-40),[100,60,200,140]);
 assert.deepEqual(resizeBounds(b,'w',500,0),[280,100,20,100]);
});
test('keepRatio anchors the opposite corner, or centres the other axis on an edge',()=>{
 const b=[100,100,200,100];
 assert.deepEqual(resizeBounds(b,'se',100,0,{keepRatio:true}),[100,100,300,150]);
 assert.deepEqual(resizeBounds(b,'nw',-100,0,{keepRatio:true}),[0,50,300,150]);
 assert.deepEqual(resizeBounds(b,'e',100,0,{keepRatio:true}),[100,75,300,150]);
 const tiny=resizeBounds(b,'se',-1000,-1000,{keepRatio:true});assert.equal(tiny[3],20);assert.equal(tiny[2],40);
});
test('moves snap the nearest of left/centre/right and report guides; resizes snap only moving edges',()=>{
 const t=snapTargets([[500,500,100,100]]);
 const moved=snapBounds([4,300,100,50],t,{threshold:8});
 assert.deepEqual(moved.bounds,[0,300,100,50]);assert.deepEqual(moved.guides.x,[0]);
 assert.deepEqual(snapBounds([497,0,100,50],t,{threshold:8}).bounds,[500,0,100,50]);
 assert.deepEqual(snapBounds([300,300,100,50],t,{threshold:8}).bounds,[300,300,100,50]);
 const r=snapBounds([100,100,396,50],t,{handle:'e',threshold:8});
 assert.deepEqual(r.bounds,[100,100,400,50]);assert.deepEqual(r.guides,{x:[500],y:[]});
 assert.deepEqual(snapBounds([5,100,30,50],t,{handle:'w',threshold:8,min:20}).bounds,[0,100,35,50]);
});
