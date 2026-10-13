import path from "node:path";
import fs from "node:fs";
import { save } from "../runtime/project.mjs";
import { buildLegacy } from "../runtime/legacy.mjs";
for (const theme of ["theme01", "theme09"]) {
  const definitions =
    theme === "theme01"
      ? {
          layout: "theme01_page006",
          bindings: {
            kicker: "title",
            value: "value",
            unit: "unit",
            sub: "body",
            caption: "caption",
          },
          props: { secondaries: [], secondaryCount: 0, highlightWord: "" },
        }
      : {
          layout: "theme09_page011",
          bindings: {
            titleCN: "title",
            titleEN: "english",
            bubbleText: "value",
            sectionNo: "unit",
          },
          props: {
            stackLabels: ["内容", "构图", "验收"],
            items: [
              { label: "公开合成输入", sub: "先保存事实，后选择旧主题页面" },
              { label: "显式映射", sub: "硬要求未绑定时阻断" },
              { label: "分别验收", sub: "预览、对象、导出各自核对" },
            ],
          },
        };
  const values = {
    title: "旧主题内容接入",
    value: "12",
    unit: "示例",
    body: "这是合成回归数据，不代表真实业绩。",
    caption: "内容先于选页，旧主题样式保持原样。",
    english: "LEGACY ADAPTER",
  };
  const used = Object.values(definitions.bindings);
  const nodes = Object.entries(values)
    .filter(([id]) => used.includes(id))
    .map(([id, text]) => ({ id, kind: "text", text, sourceId: "synthetic" }));
  const p = {
    sources: { entries: [{ id: "synthetic", type: "synthetic" }], nodes },
    media: { items: [] },
    contentPlan: {
      scenario: "management",
      audience: "技能维护者",
      purpose: "旧主题回归",
      pageCount: 1,
      cover: false,
      slides: [
        {
          slideId: "legacy-1",
          readerTask: "理解",
          relation: "claim-evidence",
          composition: "evidence",
          titleRef: "title",
          bodyRefs: used.filter((id) => id !== "title"),
          requiredContentRefs: used,
          requiredMediaRefs: [],
          legacy: definitions,
        },
      ],
    },
    designBrief: {
      styleId: "indigo-due-diligence",
      legacyTheme: theme,
      tokens: {},
    },
    editState: { overrides: {} },
  };
  const dir = path.resolve("output/legacy", theme);
  save(dir, p);
  buildLegacy(dir, p);
  console.log(dir);
}
