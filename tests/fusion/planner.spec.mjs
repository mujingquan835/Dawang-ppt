import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('shared measured planner renders four skins through the original editor and editable export',()=>{
  execFileSync('skills/dawang-ppt/project/node_modules/.bin/tsx',['tests/fusion/helpers/planner-run.jsx'],{stdio:'pipe',timeout:180000});
});
