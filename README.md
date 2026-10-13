# Dawang-PPT

内容驱动的中文演示技能：先保存事实、材料与必须内容，再选择关系表达、风格和构图，生成浏览器可编辑的 HTML 与本地 PPTX。

**当前为 0.1.0 实验版。** 三类场景、六类正文构图、三种风格适配、自主参数风格、文字/图片编辑保存和原生对象导出已实现。工程验证与用户视觉评审分别记录，尚不宣称首期全项验收通过。

## 安装

要求 Node.js 22+。当前完整浏览器验收环境是 macOS + Chrome；独立导出复核使用 LibreOffice 与 pdftoppm。

```bash
git clone https://github.com/mujingquan835/Dawang-ppt.git
cd Dawang-ppt
npm ci
node skills/dawang-ppt/scripts/install.mjs
```

新会话使用 `$dawang-ppt`。安装的是指向完整项目的独立技能入口，保留原 dashiai-ppt 与 open-kimi-ppt。撤销：`node skills/dawang-ppt/scripts/install.mjs --uninstall`，源码保留。

## 复现

```bash
npm test
npm run examples
npm run build -- output/matrix/blue-line-courseware
npm run preview -- output/matrix/blue-line-courseware
npm run qa -- output/matrix/blue-line-courseware
npm run export:pptx -- output/matrix/blue-line-courseware
node runtime/verify-pptx.mjs output/matrix/blue-line-courseware/Dawang-PPT.pptx
```

浏览器点击文字或图片，应用草稿后“保存修改”；源台账与布局覆盖回流，刷新与导出保持一致。内容修改导致已有QA失效，导出会重新检测几何。用户视觉复核仍需逐页检查。

## 能力和限制

| 已实现并有工程样例 | 边界 |
|---|---|
| management / analysis / training 场景规则 | 扩展场景后续分批实现 |
| 结论证据、图文案例、比较、前后流程、明细表、行动计划 | 固定区域与受控比例，过量内容需要修正 |
| 靛蓝尽调、月白影像、蓝线课件，自主参数 | 实验适配，用户视觉评审待完成 |
| PPTX原生文本、图片、形状、连接线、表格 | 比较条形为形状，不是原生数据图表 |
| 旧主题显式绑定适配 | 旧媒体及全部编辑反向回流未统一 |

完整60份风格资料仅索引；原生数据图表、SmartArt、自动参考图迁移、任意PPTX模板导入尚未支持。Office/WPS的字体与换行一致性需要独立客户端验收。当前观察到LibreOffice的宋体标题回退差异，不保证像素一致。

[架构](docs/architecture.md) · [验收](docs/acceptance.md) · [来源与许可](docs/upstream-sources.md) · [融合方案基线](docs/fusion-plan.md)

## Git维护

保留上游历史；新能力采用独立版本。排除业务材料、生成稿、依赖与凭据。上游升级经差异审核和旧主题回归再合并。原代码采用仓库AGPL-3.0许可；原技能专有导出组件服从自身LICENSE，新运行时使用独立MIT依赖。
