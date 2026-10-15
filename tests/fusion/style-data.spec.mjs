import test from 'node:test';
import { execFileSync } from 'node:child_process';
test('four skins retain original editor, appearance geometry, undo, save/reopen and editable export', () => {
  execFileSync('skills/dawang-ppt/project/node_modules/.bin/tsx', ['tests/fusion/helpers/style-data-run.jsx'], { stdio: 'pipe', timeout: 180000 });
});
