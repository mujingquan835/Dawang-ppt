import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { save } from "../runtime/project.mjs";
import { build } from "../runtime/build.mjs";
export function sample(
  styleId = "indigo-due-diligence",
  scenario = "management",
) {
  const nodes = [];
  const text = (id, value) => {
    nodes.push({ id, kind: "text", text: value, sourceId: "demo.synthetic" });
    return id;
  };
  const titles = [
    "材料与结论通过稳定引用连接",
    "真实素材有独立的展示区域",
    "正负值、零值和缺失值保持区别",
    "流程调整保留前后全部步骤",
    "八行明细完整呈现并可编辑",
    "下一步按验证结果逐项推进",
  ];
  const body = [
    [
      "事实先进入台账，再规划页面表达。",
      "每一页说明读者任务、信息关系与必需内容。",
      "风格变化保留同一份内容计划。",
    ],
    [
      "这是程序生成的演示图，不是业务现场证据。",
      "替换图片时保留素材 ID，记录来源与裁切边界。",
    ],
    ["示例值仅用于验证，不代表真实业绩。", "零值绘于基线，缺失值单独标记。"],
    ["保留全部节点，连接线表达实际先后关系。"],
    [],
    [
      "负责人：示例维护者；时间：待确认；事项：核对源材料。",
      "负责人：示例维护者；时间：待确认；事项：复核独立导出。",
      "负责人：用户；时间：待确认；事项：评审代表样稿。",
    ],
  ];
  const relations = [
      "claim-evidence",
      "case-evidence",
      "comparison",
      "before-after-process",
      "detail",
      "sequence",
    ],
    compositions = [
      "evidence",
      "case",
      "comparison",
      "process",
      "table",
      "action",
    ];
  if (scenario === "analysis") {
    titles.splice(
      0,
      6,
      "比较方案前先确认评价依据",
      "演示素材用于解释方案边界",
      "成本项的增加、减少与缺失分别列示",
      "材料处理路径的差异需要逐节点核对",
      "八项评价维度保留完整口径",
      "先验证关键假设再做选择",
    );
    body[0] = [
      "比较依据来自合成输入，不是用户的业务判断。",
      "评价分为内容完整性、编辑可靠性与输出一致性。",
      "没有成本基准时不计算虚假的节省率。",
    ];
    body[2] = [
      "单位为示例项数，正负表示增减方向。",
      "缺失值需要补证据，不能参加合计。",
    ];
    body[5] = [
      "验证范围：核心假设；责任：待指定；时间：待确认。",
      "验证范围：输出一致性；责任：待指定；时间：待确认。",
      "决策依据：核对结果；审批人：待确认。",
    ];
  } else if (scenario === "training") {
    titles.splice(
      0,
      6,
      "制作演示先区分事实和表达",
      "图片证据与概念示意需要明确标注",
      "练习识别正数、负数、零值与空值",
      "学习从模板填空切换到内容规划",
      "使用八项清单逐项检查交付",
      "按三步练习完成一份可追踪演示",
    );
    body[0] = [
      "第一步：为材料建立稳定ID与来源。",
      "第二步：写清每页的读者任务和信息关系。",
      "第三步：选择能完整承载内容的构图。",
    ];
    body[2] = [
      "练习：指出哪些值可以参与合计。",
      "答案：缺失不能当零，需要单独补录。",
    ];
    body[5] = [
      "练习一：整理来源，给每个内容节点设置ID。",
      "练习二：换风格，检查内容引用有没有改变。",
      "练习三：保存编辑，重新打开并核对导出。",
    ];
  }
  const slides = titles.map((value, i) => ({
    slideId: `s${i + 1}`,
    readerTask: ["理解", "理解", "比较", "理解", "核对", "行动"][i],
    relation: relations[i],
    composition: compositions[i],
    titleRef: text(`title.${i}`, value),
    bodyRefs: body[i].map((value, j) => text(`body.${i}.${j}`, value)),
    mediaRefs: i === 1 ? ["demo.image"] : [],
    requiredMediaRefs: i === 1 ? ["demo.image"] : [],
    constraints: { maySplit: false, editableText: true },
  }));
  nodes.push({
    id: "demo.series",
    kind: "series",
    sourceId: "demo.synthetic",
    unit: "项",
    period: "演示周期",
    basis: "合成测试数据",
    values: [
      { label: "正数", value: 12 },
      { label: "负数", value: -6 },
      { label: "零值", value: 0 },
      { label: "缺失", value: null },
    ],
  });
  slides[2].dataRef = "demo.series";
  slides[3].beforeRefs = ["收集材料", "选择模板", "填写内容"].map((value, i) =>
    text(`before.${i}`, value),
  );
  slides[3].afterRefs = ["整理事实", "规划关系", "选择构图", "渲染复核"].map(
    (value, i) => text(`after.${i}`, value),
  );
  nodes.push({
    id: "demo.table",
    kind: "table",
    sourceId: "demo.synthetic",
    headers: ["编号", "演示对象", "验收重点"],
    rows: ["内容", "图片", "数据", "流程", "表格", "字体", "编辑", "导出"].map(
      (v, i) => [String(i + 1), v, "完整保留，可追踪"],
    ),
  });
  slides[4].dataRef = "demo.table";
  for (const s of slides)
    s.requiredContentRefs = [
      s.titleRef,
      ...s.bodyRefs,
      ...(s.beforeRefs || []),
      ...(s.afterRefs || []),
      s.dataRef,
    ].filter(Boolean);
  return {
    contentPlan: {
      schemaVersion: "1.0",
      audience: "技能使用者",
      purpose: "公开的合成验收样例",
      use: "mixed",
      scenario,
      pageCount: 6,
      cover: false,
      slides,
    },
    sources: {
      entries: [
        {
          id: "demo.synthetic",
          type: "synthetic",
          note: "全部为合成验证输入，不是用户业务材料",
        },
      ],
      nodes,
    },
    media: {
      items: [
        {
          id: "demo.image",
          src: "assets/demo.png",
          source: "程序生成的测试图形",
          intent: "concept",
          alt: "演示素材",
          allowCrop: false,
          fit: "contain",
        },
      ],
    },
    designBrief: { styleId, tokens: {} },
    editState: { overrides: {} },
  };
}
export function create(dir, styleId, scenario) {
  const p = sample(styleId, scenario);
  save(dir, p);
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  const image = new PNG({ width: 1000, height: 640 });
  for (let y = 0; y < 640; y++)
    for (let x = 0; x < 1000; x++) {
      const o = (y * 1000 + x) * 4,
        v = x > 70 && x < 930 && y > 75 && y < 565;
      image.data[o] = v ? 33 : 240;
      image.data[o + 1] = v ? 81 : 244;
      image.data[o + 2] = v ? 170 : 247;
      image.data[o + 3] = 255;
    }
  fs.writeFileSync(path.join(dir, "assets/demo.png"), PNG.sync.write(image));
  fs.writeFileSync(
    path.join(dir, "requirements.md"),
    "合成测试；6页正文，无封面；8行原生表；正负零空；完整图片；前后流程。\n",
  );
  build(dir);
  return dir;
}
if (process.argv[1] === import.meta.filename) {
  const root = path.resolve(process.argv[2] || "output/matrix");
  for (const style of [
    "indigo-due-diligence",
    "moon-white-imagery",
    "blue-line-courseware",
  ])
    create(path.join(root, style), style, "management");
  for (const scenario of ["analysis", "training"])
    create(path.join(root, scenario), "blue-line-courseware", scenario);
  const dir = create(
    path.join(root, "custom"),
    "indigo-due-diligence",
    "analysis",
  );
  const { load } = await import("../runtime/project.mjs");
  const p = load(dir);
  p.designBrief = {
    styleId: "custom",
    tokens: {
      accent: "#795548",
      panel: "#EFEBE9",
      evidenceRatio: 0.55,
      titleFont: "PingFang SC",
    },
  };
  save(dir, p);
  build(dir);
  console.log(root);
}
