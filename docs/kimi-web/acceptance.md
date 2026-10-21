# Kimi 制作路径验收记录

2026-10-21 更新：W4工程检查点已交付，W5候选入口开发检查已通过。工程、真实材料与本机客户端证据分开记录；日常安装未启用候选。

## 验收状态

| 项目 | 状态 | 证据与限制 |
|---|---|---|
| W0—W3 工程 | 已通过 | 规则来源、直接制作、编辑回环、可信QA和同revision导出；W3全量138/138 |
| 旅行导演完整原稿 | 已扩展4页 | 封面→痛点和5步流程→确认台→现状和下一步；3张原始截图全部保留，状态明确按历史原材料 |
| 第二真实场景 | 已制作8页 | 天津市场管理汇报；沿用已确认大纲、白底蓝橙方向、12pt正文与12张原图；直接按内容关系绘制，不调用旧规划器 |
| 必需内容和媒体 | 工程通过 | 两稿coverage为空，12页readiness/finiteBounds/QA全部通过；不以此代替视觉认可 |
| 编辑保存导出 | 两稿通过 | 独立验收副本在实际Chromium中改字、撤销重做、保存重开，同保存revision导出PPTX；审核原稿未被测试改字覆盖 |
| HTML/PDF/PPTX | 两稿同revision | 完整HTML源目录；PDF为截图、文字不可选；PPTX文字与基础形状可编辑，截图内部为图片，字体未嵌入 |
| PowerPoint | 本机打开抽查通过 | 4页/8页均无修复提示，分别查看第4/6页；本轮未重复声明全稿native改字保存重开，W3两页已有该证据 |
| LibreOffice | 独立渲染通过 | 两份PPTX分别转为4页/8页PDF并查看全稿总览；不承诺跨客户端像素一致 |
| 旧八页对象/内容/布局 | 完全一致 | 原工程SHA未变；14个语义对象、全部materialized元素及图片内容指纹相同；DOM测量一致 |
| 旧八页截图 | 7页逐像素相同，1页有差异 | 第3页仅三张原照片内部存在小像素差异，最高通道差30，整页均值约0.13；前后图已看，未见构图/文字/主体变化，推测为栅格采样差异但未证实原因。严格逐像素断言仍保留失败，未改成通过 |
| 全量回归 | 144/144通过 | 新增6项benchmark测试，含CLI；npm test -- --test-concurrency=1，132.6秒，0失败 |
| 用户最终视觉认可 | 待确认 | 旅行导演4页和管理汇报8页须分别确认；正文截图内部小字、长图证据仍需放大查看 |
| 实际模型token/达到认可的总成本 | unavailable | 历史路径模型/用量不可归属，本轮也无分稿实际usage；没有用字符数、文件大小或账户窗口用量估算 |
| W5候选入口 | 工程检查通过 | build→render:authored、authored/custom、显式旧入口、保存工程保护、doctor安装区分及回退测试；详见 [W5入口与回退](w5-entry-and-rollback.md) |
| W5日常启用 | 待单独执行 | 日常安装固定开发前2948a42快照；视觉认可与成本证据限制未被开发授权自动消除 |

## 对照与本地证据

原始材料、生成稿、完整规则原文、图片、Office文件及运行记录只保存在忽略目录 `output/kimi-web/w4/`，不进入公开Git。

- `travel/`：4页新稿，`travel-legacy/`：固定失败稿快照的4页旧路径回放。两者基于相同产品大纲与截图、深色外观方向；没有为新稿补当前产品事实。
- `management/`：8页新稿，`legacy-replay/`：已验收旧八页的当前渲染回放。来源内容节点与必需媒体完全一致；原稿本身不改。
- `legacy-regression.json` 保留最初严格像素比较的失败；`legacy-review.json` 单独记载后续DOM、素材和图片检查结论，不覆盖失败。
- `travel/qa.json`、`management/qa.json`、`edit-report.json`、`delivery-report.json`、`review-report.json`、`rules-manifest.json`、`screenshots/`、`pdf-overview.png`、`lo-overview.png` 与Office截图为实物证据。
- `delivery/travel/`、`delivery/management/` 为审核包，包含PPTX、截图PDF、完整HTML源目录、规则清单与QA/交付报告。
- 管理汇报经两轮修正：先解决文本框高度与双行标识重叠，再增高第6页长中文段落并移动后续内容；没有缩小正文或删事实。原日志在 `qa-round1.log`、`qa-round2b.log`、`qa-final.log`。首次重建被已有工程保护拒绝，草稿已归档后重新生成；未绕过覆盖保护。

时间对照记录在 `runs.json` 与 `benchmark-report.json`：4条实测回放记录、2组旧新对照。阶段均有render、QA、PPTX/PDF导出，但时间不是同一连续计时实验，部分步骤与测试并行，机器负载未控制。只能复核各次程序运行时间，不用于比较模型制作速度或达到认可的成本。`wallClockMs` 包括记录间空档，`measuredActiveMs` 对重叠测量只计一次，二者不混用；各阶段总和可能有重叠。

## 成本记录工具

```sh
node skills/dawang-ppt/project/scripts/benchmark-authoring.mjs runs.json report.json
```

输入为 `{version:1,runs:[...]}`；每条记录必须提供唯一id、scenarioId、route（legacy/authored）、scope（authoring/program-replay）、正整数pageCount、model、materialFingerprint、requirementsFingerprint、intervals、correctionRounds与acceptance。时间段为 `{stage,start,end}`，时间字符串带时区；无法计时用空数组。acceptance.visual为pending/accepted/rejected，editing为pending/passed/failed。

`tokens.initial` 是实际usage记录 `{input,output,total,source}`；`tokens.corrections` 是同结构记录数组。总量必须等于输入加输出，source必须说明可追溯的实际用量来源。任何阶段无法取得时用null，汇总明确输出unavailable；已确认零修正可用空数组，不能把未知修正成本当零。工具只能校验记录形状，不能自行证明调用方提供的数据真实。

输出保留页数、模型、阶段并集时间、墙钟范围、实际token或unavailable、修正轮数、视觉/编辑状态与对照不满足条件的理由。材料/要求/页数/模型不一致、实际用量缺失、用户未认可、编辑未通过或只是程序回放，均不能宣称制作成本节省。达到用户认可的总成本另需连续实验，不能由本轮回放推导。

## 本轮结论

W4 的工具开发、双场景稿件及工程检查点已交付；视觉认可与可比成本的验收门槛未完成。保留当前入口，W5候选开发另见下方记录，日常启用待前置验收；不合main、不发布，不把GitHub开发分支同步视为正式发布。


## W5候选开发记录（2026-10-21）

- 默认build迁到render:authored。旧brief/goal给出显式迁移提示；保存的ProjectV2要求render:project，不允许丢弃editorState重建。旧render:brief/render:goal/render:project保留。
- 新增authored/custom中性绘制默认值，仅对显式kimi-authored-v1页面开放。直接设计不再依赖六种已适配外观，不放宽旧composition契约或宣称未适配模板已迁入。
- 更新SKILL、contracts、production、visual-review：实际读原规则、自然语言材料、逐页自主设计、规则清单与同revision交付；保留字体/PDF/可编辑程度限制。
- doctor显示当前源码与实际安装。原日常symlink指向开发树，修改前已把同内容2948a42快照固定到本机install-snapshots并重指链接，防止开发自动激活。快照只在本机，依赖仍链接原安装的node_modules；无锁文件变更。
- 新增7项入口检查和1项安装回退检查。实际Chromium侧栏改字、撤销重做、保存重开、自由几何和用户导出接口同revision验证；临时安装已验证候选启用和恢复旧快照。
- 保留原失败记录：初轮入口测试发现六外观依赖和保存工程重建风险；浏览器测试夹具曾选择到目录缩略图、撤销后直接读缺省text字段，安装夹具曾混用macOS /var与/private/var路径，均已按真实契约修正。
- 首轮全量152项中151通过，唯一失败是测试缓存QA前revision后裸POST，期间自动保存更新版本。独立诊断复现并确认服务端正确拒绝；helper改走真实用户__exportDeckPptx入口，再比对返回、当前工程与磁盘revision。生产版本冲突保护未放宽。
- 独立只读审查未发现阻断W5的生产Critical/Important问题；上述Important验证问题已修正。审查不替代用户视觉验收或目标机Office检查。

最终全量 `npm test -- --test-concurrency=1`：152/152，0失败，105.1秒（`output/kimi-web/w5/full-final.log`）。7项新入口检查、3项安装检查及5项旧入口检查均通过；持久目录浏览器复测和两页实际截图亦已核对。开发源码、日常安装、用户视觉认可和发布四种状态继续分开；本轮不宣称整个v4效果验收完成。
