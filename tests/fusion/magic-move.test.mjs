import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('magic move interpolates matching objects, survives cancellation and restores saved selection',()=>{
 execFileSync('skills/dawang-ppt/project/node_modules/.bin/tsx',['tests/fusion/helpers/magic-move-run.jsx'],{stdio:'pipe',timeout:90000});
});
