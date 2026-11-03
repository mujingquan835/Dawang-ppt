import fs from 'node:fs';
import path from 'node:path';
// Stand-in reviewer for tests: passes every claim except ids listed in FAKE_REVIEW_FAIL (comma separated).
const dir = process.env.PACKET_DIR, fail = new Set((process.env.FAKE_REVIEW_FAIL || '').split(',').filter(Boolean));
const claims = JSON.parse(fs.readFileSync(path.join(dir, 'claims.json'), 'utf8'));
for (const file of ['prompt.txt', 'schema.json']) if (!fs.existsSync(path.join(dir, file))) process.exit(2);
if (!fs.readdirSync(path.join(dir, 'images')).some((f) => f.endsWith('.png'))) process.exit(3);
const items = claims.map((c) => ({ id: c.id, verdict: fail.has(c.id) ? 'fail' : 'pass', reason: fail.has(c.id) ? '截图上看不到' : '截图可见' }));
fs.writeFileSync(path.join(dir, 'verdict.json'), JSON.stringify({ items }));
