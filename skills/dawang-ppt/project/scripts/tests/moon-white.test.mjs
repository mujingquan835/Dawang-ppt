import test from 'node:test';
import assert from 'node:assert/strict';
import { MOON_WHITE_PAGES } from '../../src/components/themes/theme17/metadata.mjs';
import { validateGoalSpec } from '../validate-goal-spec.mjs';
import { listLayouts, inspectLayout } from '../skill-workflow-utils.mjs';

const slide = n => ({ layout:`theme17_page${String(n).padStart(3,'0')}`, props:structuredClone(MOON_WHITE_PAGES[n-1].defaultProps) });
const goal = slides => ({ title:'验收样稿',goal:'检查内容容量和数据边界',themePack:'theme17',slides });
test('media query returns only actual writable picture layouts',()=>{
  const rows=listLayouts({theme:'theme17',providedImages:1,limit:20});
  assert.deepEqual(rows.map(r=>r.layout).sort(),['theme17_page002','theme17_page003','theme17_page007']);
  assert.equal(listLayouts({theme:'theme17',providedImages:2}).length,0);
});
test('eight table rows survive validation; overflow and missing headers fail',()=>{
  const s=slide(10);s.props.rows.forEach((r,i)=>{r.name=`检查项${i+1}`;r.evidence='已核对';r.detail=`第${i+1}项事实和用途`;r.action=`处理第${i+1}项`; });
  assert.deepEqual(validateGoalSpec(goal([s])),[]);
  s.props.rows.push({...s.props.rows[0],name:'第九项'});s.props.rowCount=9;
  assert.ok(validateGoalSpec(goal([s])).length>0);
  const missing=slide(10);missing.props.headers.pop();
  assert.ok(validateGoalSpec(goal([missing])).some(e=>e.includes('exactly 4')));
});
test('body layout reuse requires reasons; covers remain limited',()=>{
  const a=slide(6),b=slide(6);for(const s of [a,b]){s.props.metrics=s.props.metrics.slice(0,3);s.props.metrics.forEach((m,i)=>m.detail=`指标${i+1}的依据与解释`);}b.props.title='另一组同口径指标';
  assert.ok(validateGoalSpec(goal([a,b])).some(e=>e.includes('duplicate layout')));
  b.layoutReuseReason='同口径指标对照，保留一致版式便于比较';
  assert.deepEqual(validateGoalSpec(goal([a,b])),[]);
  const c=slide(1),d=slide(1);d.layoutReuseReason='测试封面重复不能豁免';
  assert.ok(validateGoalSpec(goal([c,d])).some(e=>e.includes('only one cover')));
});
test('chart keeps signed raw numbers and accepts zero; rejects invented text values',()=>{
  const s=slide(8);s.props.barCount=3;s.props.bars=[{label:'增长',value:12},{label:'减少',value:-7},{label:'持平',value:0}];
  assert.deepEqual(validateGoalSpec(goal([s])),[]);
  s.props.bars[0].value='待确认';
  assert.ok(validateGoalSpec(goal([s])).some(e=>e.includes('finite number')));
});
test('old theme contracts remain available',()=>{
  assert.ok(inspectLayout('theme13_page007'));
  assert.ok(inspectLayout('theme09_page006'));
  assert.equal(inspectLayout('theme17_page010').defaultVisibleCounts.rowCount,8);
});
