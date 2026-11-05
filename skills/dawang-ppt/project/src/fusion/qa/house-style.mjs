// Dawang house style: the original-rule clauses the user has replaced, one sub-rule at a time. Each entry names the
// clause, what it now allows, what it still forbids and when the user decided it. The reviewer judges these clauses
// against this table and every other requirement of the same chapter as written; authors cite the id (HS-01 …) in
// the chapter's `how` instead of overriding the whole chapter. This table is the single source: the reviewer prompt
// and references/fusion/house-style.md are generated from it.
export const HOUSE_STYLE_TABLE = [
  {
    id: 'HS-01', chapters: ['general#Strictly forbidden', 'scenario#Key Requirements'],
    clause: '禁止用圆角矩形、矩形卡片或带色条的卡片建立层级与对齐',
    allows: '数字色块（含强调色竖条与图标）、答案块、对照组、左右对照、指标带、反白色块、结论条、深色侧栏、照片拼板、编号方块与流程圆点',
    still: '不用普通卡片包裹大段正文，不在每页套同一卡片墙；正文层级仍靠字号、字重、留白和细线',
    basis: '用户确认 2026-11-04'
  },
  {
    id: 'HS-02', chapters: ['scenario#Key Requirements'],
    clause: '除非别无选择，禁止均分构图（三等分、四等分、2×2、“三栏＋标题＋结论”）',
    allows: '同级并列的指标（数字色块、指标带）、按时期展开（时期色带、时期分栏）、两侧对照（对照组、左右对照）可以等宽',
    still: '页面主体（正文与图文、主张与证据）按内容分主次，不默认三栏或四栏等分',
    basis: '用户确认 2026-11-05'
  },
  {
    id: 'HS-03', chapters: ['scenario#Visual References'],
    clause: '所有矩形组件共用一种圆角，不混用',
    allows: '色块、面板、照片共用主题圆角；页头章节标签与通栏色带（时期色带、指标带）为直角',
    still: '同类组件不混用不同圆角；不加阴影、3D 或渐变文字',
    basis: '用户确认 2026-11-04'
  },
  {
    id: 'HS-04', chapters: ['scenario#Color Palette Reference'],
    clause: '按场景建议配色，背景偏暖白/浅石色，拒绝 Office 默认蓝、大促红金等平庸配色',
    allows: '以九组汇报配色为主选（白底、一深一浅一跳）；场景建议配色只在用户要求或九组都不适合时补充',
    still: '红金不用于大促/促销类活动复盘（即原文拒绝的“大促红金”），问题页控制红色面积；三原色不用于正式汇报',
    basis: '用户确认 2026-11-04（九组为主选）、2026-11-05（红金与三原色保留但限用）'
  },
  {
    id: 'HS-05', chapters: ['general#Strictly forbidden'],
    clause: '禁止红、紫、黄、绿聚在同一页的 AI 配色',
    allows: '三原色配色（粉红、蓝、黄）',
    still: '使用三原色时同页不再加入紫色或绿色；其他配色照常遵守原文',
    basis: '用户确认 2026-11-05'
  }
];

export const houseStyleFor = (chapter) => HOUSE_STYLE_TABLE.filter((h) => h.chapters.includes(chapter));

// Reviewer instructions: exempt clauses are judged against the table; the rest of each chapter is judged as written.
export function houseStylePrompt() {
  return [
    'Dawang 版式例外（用户确认，按子规则替换原规则的个别条款；同一章节的其他要求照常判断）：',
    ...HOUSE_STYLE_TABLE.map((h) => `- ${h.id}｜原文：${h.clause}｜现在允许：${h.allows}｜仍然要求：${h.still}｜${h.basis}`),
    '页面上的做法属于“现在允许”时，不得因这条原文判 fail；违反“仍然要求”的照常判 fail。清单的 how 引用了 HS 编号的章节，只按表中范围豁免，不把整章当成豁免。'
  ].join('\n');
}

export function houseStyleMarkdown() {
  return [
    '# Dawang 版式例外',
    '',
    '原规则里被用户决定替换的个别条款，按子规则列出。复核者按这张表判断这些条款，同一章节的其他要求照常执行。写规则清单时，这些章节照常记为 `applied`，在 `how` 里引用编号（如“卡片类组件按 HS-01”），不要把整章记成 `user-override`。本文件由 `project/src/fusion/qa/house-style.mjs` 生成，改动请改那张表。',
    '',
    '| 编号 | 原规则条款 | 现在允许 | 仍然要求 | 依据 |',
    '|---|---|---|---|---|',
    ...HOUSE_STYLE_TABLE.map((h) => `| ${h.id} | ${h.clause} | ${h.allows} | ${h.still} | ${h.basis} |`),
    ''
  ].join('\n');
}
