import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildOutlineBaseline } from '../project/src/fusion/authoring/outline-baseline.mjs';
import { composeReportDeck, draftDeckClaims } from '../project/src/fusion/authoring/report-deck.mjs';
import { createLayoutMeasurer } from '../project/src/fusion/planning/measure-layout.mjs';

// The default way to build a work report: write the outline, let composeReportDeck do the page.
// Usage: node <skill>/examples/report-modules.mjs <new-directory>, then make <new-directory>/authored.json <output.html>.
// Synthetic content. No coordinates anywhere: the outline holds the words and the reading order, the composer does the rest.
const note = (locator, excerpt) => ({ locator, excerpt });
function writePng(file, width, height, [r, g, b]) {
  const crc = (buf) => { let c, n = 0xffffffff; for (const byte of buf) { c = (n ^ byte) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; n = c ^ (n >>> 8); } return (n ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const head = Buffer.from(type), len = Buffer.alloc(4), sum = Buffer.alloc(4); len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(Buffer.concat([head, data]))); return Buffer.concat([len, head, data, sum]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3).map((_, i) => [r, g, b][i % 3])]);
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(height).fill(row)))), chunk('IEND', Buffer.alloc(0))]));
}

const dir = path.resolve(process.argv[2] || '');
if (!process.argv[2] || fs.existsSync(path.join(dir, 'content-baseline.json'))) throw new Error('usage: report-modules.mjs <new-directory>');
fs.mkdirSync(dir, { recursive: true });
writePng(path.join(dir, 'poster.png'), 900, 1200, [70, 110, 190]);

const outline = {
  kind: 'report', scope: 'part', title: '活动复盘（合成示例）', audience: '业务管理层', period: '2026年第三季度',
  sources: [{ sourceId: 'note', kind: 'synthetic', title: '合成材料' }],
  pages: [{
    // The cover says how the period went; it takes no page number. keyLine is the status sentence, focus its key part.
    id: 'cover', role: 'cover', readerTask: '一眼知道这一期的整体结果', eyebrow: '活动复盘 · 2026 年第三季度',
    keyLine: { text: '案例传播带动新签 20 单、续费 30 单，四季度继续复用', source: 'distilled', from: '第 5 段' }, focus: '新签 20 单、续费 30 单',
    data: [{ label: '辅助新签', value: '20', unit: '单', from: note('第 5 段', '辅助新签 20 单') }, { label: '辅助续费', value: '30', unit: '单', from: note('第 5 段', '辅助续费 30 单') }],
    photos: [{ src: 'poster.png', caption: '活动海报' }]
  }, {
    id: 'p1', role: 'results', readerTask: '从标签读出问题、动作、结果和判断',
    // "X：结论" puts X in the eyebrow; focus is the part of the title set in the accent colour.
    keyLine: { text: '夏季活动：案例传播＋促销政策，承接新签与续费', source: 'quoted', from: '第 1 段' }, focus: '案例传播＋促销政策',
    // Each labelled sentence becomes a module. A review verdict goes to the bottom in the warm tone by its label.
    statements: [
      { id: 'problem', label: '业务问题', text: '客户需要看到平台使用效果，促销需要持续的传播内容。', from: note('第 1 段', '客户需要看到平台使用效果') },
      { id: 'verdict', label: '复盘判断', text: '案例提供信任依据，政策提供参与入口，销售跟进承接合作。', from: note('第 6 段', '案例提供信任依据') },
      { id: 'tool', label: 'AI 提效', text: '后台批量出图，业务线可自行制作并转发。', from: note('第 7 段', '后台批量出图') }
    ],
    // title is a short handle distilled from the sentence; detail keeps the sentence whole.
    itemsHeading: '关键动作（收集凭证 → 组合传播 → 销售承接）',
    items: [
      { title: '收集凭证', detail: '门店提交成交截图，作为案例依据', from: note('第 2 段', '门店提交成交截图') },
      { title: '组合传播', detail: '案例与活动政策持续组合传播', from: note('第 3 段', '案例与活动政策持续组合传播') },
      { title: '销售承接', detail: '销售跟进客户关注，推动新签与续费', from: note('第 4 段', '销售跟进客户关注') }
    ],
    data: [
      { label: '辅助新签', value: '20', unit: '单', from: note('第 5 段', '辅助新签 20 单') },
      { label: '辅助续费', value: '30', unit: '单', from: note('第 5 段', '辅助续费 30 单') },
      { label: '收集案例', value: '150', unit: '份', from: note('第 5 段', '收集案例 150 份') }
    ],
    photos: [{ src: 'poster.png', caption: '活动海报' }]
  }, {
    id: 'p2', role: 'other', readerTask: '看清钱怎么花、动线怎么走', eyebrow: '预算与动线',
    keyLine: { text: '预算四成投向现场，动线循环引导', source: 'distilled', from: '第 8 段' }, focus: '预算四成',
    // Two tables on one page: each gets its own title. highlight marks rows the title talks about.
    tables: [
      { title: '预算分配', columns: ['支出项', '金额', '占比'], highlight: [0], rows: [['现场布置', '4 万元', '40%'], ['传播投放', '6 万元', '60%']], from: note('第 8 段', '现场布置 4 万元') },
      { title: '效果预估', columns: ['指标', '预估值'], rows: [['到场人次', '2,000'], ['留资组数', '400']], from: note('第 9 段', '到场人次 2,000') }
    ],
    // returnTo: the last step leads back to step 2, drawn as a return line.
    flows: [{ title: '现场动线', steps: ['入口签到', '主舞台', '商户区', '返回主舞台'], returnTo: 2, from: note('第 10 段', '入口签到') }]
  }, {
    id: 'p3', role: 'issues', readerTask: '知道问题对应什么改进、什么时候做', eyebrow: '问题与计划',
    keyLine: { text: '问题集中在跟进时效，下季度分三步改进', source: 'distilled', from: '第 11 段' }, focus: '跟进时效',
    // compare becomes two sides whose rows answer each other, tied by arrows, with the way forward in the primary colour; periods becomes an arrow band.
    compare: { leftLabel: '问题', rightLabel: '改进', left: [{ title: '回访慢', detail: '无固定节奏' }], right: [{ title: '建台账', detail: '48 小时回访' }], from: note('第 11 段', '回访慢') },
    periods: [{ label: '10 月', title: '建机制', points: ['回访台账'], from: note('第 12 段', '10 月') }, { label: '11 月', title: '跑试点', points: ['两家门店'], from: note('第 12 段', '11 月') }, { label: '12 月', title: '全量推广', points: ['复盘'], from: note('第 12 段', '12 月') }]
  }]
};
const built = buildOutlineBaseline(outline, { baseDir: dir });
if (!built.ok) throw new Error(JSON.stringify(built.issues));
const { baseline, scaffold: deck } = built;

const measurer = await createLayoutMeasurer();
let composed;
try { composed = await composeReportDeck({ outline, deck, palette: 'blue-gold', measurer, footer: '合成材料', baseDir: dir }); } finally { await measurer.close(); }

// Through-line and checklist come from what was placed. Read each how against the finished pages and correct any that do not hold.
draftDeckClaims({ deck, outline, palette: 'blue-gold', projectId: 'report-modules-example' });
console.error(JSON.stringify({ sparse: composed.sparse, rearranged: composed.rearranged, focusGuessed: composed.focusGuessed }));
fs.writeFileSync(path.join(dir, 'content-baseline.json'), JSON.stringify(baseline, null, 2));
fs.writeFileSync(path.join(dir, 'authored.json'), JSON.stringify(deck, null, 2));
console.log(path.join(dir, 'authored.json'));
