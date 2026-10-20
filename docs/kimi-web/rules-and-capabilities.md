# Kimi 网页制作：规则来源与能力记录

2026-10-20，整合方案 v4 的 W0 开发检查点。状态：规则接口已实现，真实失败稿的两次版本对应待核；W1/W2 工程与两页预览已完成，详见 [W2检查点](w2-checkpoint.md)；W3—W5 未开始。

## 本轮行为

- `authoringRuleSources({scenarioId, root?, designDoc?, formatDocs?})` 按需列出制作步骤、通用规则、一个主场景及显式指定的设计/格式文档。返回来源描述，不读全库、不选择旧 preset、不生成页面。
- `createRuleManifest({sourceFiles, decisions})` 返回 `{sources, decisions}`。来源保存稳定 ID、绝对路径、文件字节 SHA-256、section；缺失/不可读文件的哈希为 null，随后验证必须报告。
- `validateRuleManifest(manifest)` 返回结构化 `issues[]`，每项包含 `code/severity/message` 及适用的 `sourceId/ruleId`。重新读取来源比对指纹；不会自动更新旧指纹以掩盖变化。
- 空清单、来源缺失/不可读、哈希变化、重复 ID、未知来源、非法状态、字段格式错误均报告问题。非 applicable 状态必须说明理由；unsupported 即使带证据也产生 `rule-unsupported`，不能称为通过。

接口是本机 Node 工具，不直接打包到浏览器。单个清单内 ruleId 唯一，相同规则跨页共用 slideIds；不同条款或不同处理决定使用可区分的规则 ID。slideIds/evidencePaths 可为空数组，分别表示全稿决定或尚无附件；程序不以空证据或 issues=[] 证明规则已执行、页面美观或用户已认可。section 可为空字符串表示整份文档。

```js
import { authoringRuleSources } from '../../skills/dawang-ppt/project/src/fusion/kimi/reference-index.mjs';
import { createRuleManifest, validateRuleManifest } from '../../skills/dawang-ppt/project/src/fusion/kimi/rule-manifest.mjs';
const sourceFiles = authoringRuleSources({ scenarioId: 'business-plan', formatDocs: ['pptd.md'] });
const manifest = createRuleManifest({ sourceFiles, decisions: [{
  ruleId: 'cover-reader-task', sourceId: 'general', status: 'applicable',
  reason: '封面先解释产品用途', slideIds: ['cover'], evidencePaths: []
}] });
const issues = validateRuleManifest(manifest);
```

示例为接口用法，不是旅行导演的正式规则判定。本轮没有重制幻灯片；实际出稿时仍需智能体读取原文并逐条判断适用性，缺少来源不得静默降级。仅 reference/ 目录但没有制作步骤 SKILL.md 的安装会明确报缺，不能视为完整规则安装。

## 能力与边界

| 项目 | 当前状态 | 验证方式/下一阶段 |
|---|---|---|
| 来源定位、SHA-256 与决定校验 | W0 已实现 | 8 项合成测试，覆盖缺文件、改文件、非法状态和缺理由等 |
| 真实基准快照 | 部分完成 | 原材料、第一版失败稿、Kimi 参考稿及对比图已本地归档；用户已确认失败稿目录，4份历史修订已一并固定；两次失败对应的 revision 待核 |
| 两张代表页读者任务与视觉问题 | 已记录 | 本地 baseline/review-targets.md；依据原大纲及已查看对比图 |
| 直接元素制作入口 | W1 已实现 | 7项行为测试；两页实际浏览器预览，效果待用户确认 |
| runs/vector、编辑保存回环 | W2 已实现 | 实际浏览器及两页真实回环通过，效果待用户确认 |
| 同 revision HTML/PDF/PPTX、Office 验收 | 未开始 | W3 |
| 整稿、第二真实场景、速度与实际 token 对照 | 未开始 | W4 |
| 日常入口/全局安装切换 | 未开始 | W5，需前置验收 |

## 本地证据与验收规则

真实稿与业务内容仅位于忽略目录 `output/kimi-web/`；`baseline/inventory.json` 保存来源路径、快照路径、文件大小、SHA-256 和缺失项。用户已确认失败稿位于原目录，4份历史修订已一并归档；未擅自指定哪份修订对应第二次失败，也未用其他业务汇报替代真实产品基准。

本轮看过已有 Kimi/Dawang 四页对比图。参考 PPTX 原文件已固定，但本轮没有在 Office 打开或声称客户端验收通过。历史分析只作问题线索，不继承其中全稿填满率、固定图标数量等建议作为 v4 强制规则。后续两页分别验证封面表达和功能扫读，以实际截图与用户认可判断。

测试记录：`output/kimi-web/w0-red.log`（新增模块不存在，接口缺失失败）、`w0-green.log`（8/8）及 `w0-full.log`（全量 114/114，0失败）。程序检查与效果验收分开；本轮不证明新路径已能制作或导出。
