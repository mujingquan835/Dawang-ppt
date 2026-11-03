// Detect ONE primary presentation scenario (+ optional auxiliary) from the user's outline/audience/purpose.
// Deterministic keyword evidence; the agent may override, and the decision is recorded with its evidence.
import { SCENARIOS } from "./index.mjs";
const KEYWORDS = {
  "analysis-decision": ["咨询", "行业研究", "市场机会", "投资", "竞争", "战略", "决策", "选项", "对比方案", "尽调", "估值", "财务分析", "研判"],
  "business-plan": ["提案", "方案", "营销", "销售", "融资", "招商", "合作", "商业计划", "产品方案", "路演", "报价", "客户价值"],
  "management-report": ["汇报", "述职", "复盘", "季度", "月度", "年度总结", "周报", "OKR", "KPI", "完成率", "目标达成", "经营", "管理层", "下季度", "工作总结", "进度", "问题与对策", "业绩"],
  "academic-research": ["论文", "答辩", "开题", "课题", "研究方法", "样本", "实验", "文献", "中期报告", "结题", "学术"],
  "education-training": ["课件", "培训", "教学", "课程", "学员", "知识点", "练习", "科普", "新员工", "操作规范"],
  "tech-engineering": ["架构", "接口", "系统", "研发", "工程", "部署", "运维", "安全", "数据平台", "技术方案", "性能", "AI"],
  "brand-creative": ["品牌", "创意", "设计提案", "作品集", "文化", "活动", "故事", "视觉"]
};
const textOf = (o) => [o.title, o.audience, o.purpose, o.brief, ...(o.contentSlides || o.slides || []).flatMap((s) => [s.title, ...(s.points || []).map((p) => typeof p === "string" ? p : `${p.title || ""} ${p.detail || ""}`)])].filter(Boolean).join("\n");
function detectScenario(outline, { override } = {}) {
  if (override) {
    if (!SCENARIOS.some((s) => s.id === override)) throw new Error("Unknown scenario " + override);
    return { primary: override, auxiliary: null, source: "user", evidence: [], scores: {} };
  }
  const text = textOf(outline), head = [outline.title, outline.audience, outline.purpose].filter(Boolean).join("\n");
  const scores = {}, evidence = {};
  for (const [id, words] of Object.entries(KEYWORDS)) {
    evidence[id] = words.filter((w) => text.includes(w));
    // Title/audience/purpose words count double: they state the reader task most directly.
    scores[id] = evidence[id].length + words.filter((w) => head.includes(w)).length;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [pid, ps] = ranked[0], [aid, as] = ranked[1];
  if (!ps) return { primary: null, auxiliary: null, source: "undetermined", evidence: [], scores, needsUser: true, message: "无法从大纲判断主场景，请用户确认" };
  const auxiliary = as > 0 && as >= ps * 0.6 ? aid : null;
  return { primary: pid, primaryZh: SCENARIOS.find((s) => s.id === pid).zh, auxiliary, auxiliaryZh: auxiliary ? SCENARIOS.find((s) => s.id === auxiliary).zh : null, source: "keywords", evidence: evidence[pid], scores, confidence: +(ps / (ps + as || 1)).toFixed(2) };
}
export { detectScenario, KEYWORDS };
