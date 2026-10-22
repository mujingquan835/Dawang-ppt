// Section labels for the pinned Kimi rules. Headings only; upstream text never lives in this repository.
// apply: follow as written. adapt: follow within the stated Dawang boundary. replaced: Dawang's own rule governs,
// see `by`. Headings missing from this table (new upstream sections) are reported as unreviewed.
export const DISPOSITION_LEGEND = Object.freeze({
  apply: '原文适用，照做',
  adapt: '原文适用，但按 note 中的 Dawang 边界执行',
  replaced: '由 Dawang 规则替代，按 by 指向的文档执行；原文仅供参考',
  unreviewed: '未在锁定版本中标注（上游新增或改动），由制作智能体逐条判断并向用户说明'
});

const SEARCH = '不擅自联网扩充：材料不足时列出缺口并询问用户，经同意后才搜索；不补造数据。';
const SHAPES = '不支持原生图表/SmartArt：用文字、形状、线条和受控 vector 构建结构图与图表。';
const QA = '用 `check --screenshots` 与 references/fusion/visual-review.md 复核；不运行 PPTD/kimi-slides 校验或导出脚本。';

const workflow = {
  '(preamble)': { disposition: 'replaced', by: 'SKILL.md#默认制作流程', note: '默认交付为单个 HTML；不生成 PPTD 工程，不默认导出 PPTX。' },
  'Definition': { disposition: 'replaced', by: 'references/contracts.md', note: 'Dawang 不使用 .pptd DSL，工程为 ProjectV2 / authored 元素。' },
  'The pptd format': { disposition: 'replaced', by: 'references/authoring-api.md' },
  'PPT production workflow': { disposition: 'apply' },
  'step0. Check local prerequisites': { disposition: 'replaced', by: 'SKILL.md#默认制作流程', note: '运行 `dawang.mjs doctor`；不需要 Python、agent-browser 或访问 kimi.com。' },
  'step1. Read the context thoroughly': { disposition: 'apply' },
  "step2. Understand the user's requirements": { disposition: 'adapt', note: '请求类型、设计方向、输入类型、页数判断照做；“默认搜索扩充”改为：' + SEARCH },
  'Clarification and follow-up questions': { disposition: 'apply' },
  "step3. Generate the presentation based on the user's requirements": { disposition: 'adapt', note: '“先读 pptd.md” 改为读 references/authoring-api.md。' },
  'Replicating a PPT': { disposition: 'replaced', by: 'SKILL.md#已有工程与历史输入', note: '可按图片手工搭建 authored 元素，但不宣称 1:1 复刻或任意导入。' },
  'Editing a PPT': { disposition: 'replaced', by: 'references/authoring-api.md', note: '已存工程用 patch:project / 网页编辑器；不转换 PPTX 为 PPTD。' },
  'Generating a PPT': { disposition: 'apply' },
  'Self-directed design': { disposition: 'apply' },
  'Generating content in other formats': { disposition: 'adapt', note: '海报/信息图同样做成 authored 页面；单图由用户在 HTML 中导出当前页图片。' },
  'Design system': { disposition: 'apply' },
  'Using a template': { disposition: 'replaced', by: 'SKILL.md#已有工程与历史输入', note: 'dashi 原样模板走 render:goal；不导入 PPTX 模板。' },
  'Style transfer': { disposition: 'apply' },
  'Images and Visual Materials': { disposition: 'adapt', note: '优先用户图片；搜索或生成图片需用户同意，且标明来源/生成属性。' + SEARCH },
  'Content Guidelines': { disposition: 'apply' },
  'step4. PPT validation': { disposition: 'adapt', note: '其中 7 项看图检查清单照做。' + QA },
  'step5. PPT output and delivery': { disposition: 'replaced', by: 'SKILL.md#默认制作流程', note: '只交付一个 HTML；不默认加淡入转场、不提示 npx serve；动画与讲者备注规则与原文一致。' }
};

const general = {
  'PPT category guide': { disposition: 'apply' },
  'step1. General rules': { disposition: 'apply' },
  'Requirements': { disposition: 'adapt', note: '第 3 条：' + SHAPES + ' 第 5 条：' + SEARCH + ' 第 7 条来源标注照做；无超链接能力时写明来源名称与日期。' },
  'Strictly forbidden': { disposition: 'apply' },
  'step2. Scenario determination': { disposition: 'apply' }
};

const scenarioDefault = { disposition: 'apply' };
const scenarios = {
  'reference/slides_categories/analysis-decision.md': {
    'Make data and structured information the body of the argument': { disposition: 'adapt', note: SEARCH + ' ' + SHAPES }
  },
  'reference/slides_categories/business-plan.md': {
    'Tell a more complete story through SmartArt structural diagrams': { disposition: 'adapt', note: SHAPES }
  },
  'reference/slides_categories/brand-creative.md': {
    'Identify the subject; build a deck whose subject is recognizable at a glance': { disposition: 'adapt', note: SEARCH }
  },
  'reference/slides_categories/education-training.md': {
    '5. Pre-Delivery Validation': { disposition: 'adapt', note: QA }
  }
};

export const DOCUMENT_DISPOSITIONS = Object.freeze({
  'SKILL.md': { sections: workflow },
  'reference/slides_categories.md': { sections: general },
  ...Object.fromEntries(['analysis-decision', 'business-plan', 'management-report', 'academic-research', 'education-training', 'tech-engineering', 'brand-creative']
    .map((id) => {
      const file = `reference/slides_categories/${id}.md`;
      return [file, { default: scenarioDefault, sections: scenarios[file] || {} }];
    })),
  'reference/pptd.md': { default: { disposition: 'replaced', by: 'references/authoring-api.md', note: 'PPTD 语法不适用；单位、字号换算见工程编写速查。' } },
  'reference/shapes.md': { default: { disposition: 'replaced', by: 'references/authoring-api.md', note: '只支持基础形状、线条与受控 vector，不使用 PPTD 预设形状名。' } },
  'reference/fonts.md': { default: { disposition: 'adapt', note: '只用本机可用或随 HTML 嵌入的字体；新制作缺字体会被 QA 判为错误，不引用 Google Fonts。' } },
  'reference/general-poster.md': { default: { disposition: 'adapt', note: '仅在用户要海报/信息图时读取；输出仍是 authored 页面，style.md 记录在制作说明中即可。' } },
  // Design systems are read only when the user names one; their visual rules apply as written.
  'reference/design_system/': { default: { disposition: 'apply' }, prefix: true }
});

export function dispositionFor(relativePath, heading) {
  const doc = DOCUMENT_DISPOSITIONS[relativePath]
    || Object.entries(DOCUMENT_DISPOSITIONS).find(([key, value]) => value.prefix && relativePath.startsWith(key))?.[1];
  const label = doc?.sections?.[heading] || doc?.default;
  return label ? { ...label } : { disposition: 'unreviewed' };
}
