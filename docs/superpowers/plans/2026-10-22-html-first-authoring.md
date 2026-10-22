# Dawang-PPT：HTML 默认交付与制作提速 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 用户指定在另一个对话执行；本对话只规划。执行方式不默认启用子代理。

**Goal:** 保留内容策划、Kimi 原规则、自主设计和内容/视觉复核，将默认交付改成一个可独立打开、编辑、保存的 HTML；PPTX/PDF/图片由用户按需导出，同时解决裁切误报、反复查源码、排版估算和删除重建问题。

**Architecture:** ProjectV2 继续作为内部工程的唯一保存状态，网页呈现由其派生。交付 HTML 内嵌一致的 ProjectV2 快照、必要运行资源和媒体，可离线编辑并下载更新后的 HTML；它是可移交的工程快照，重新导入内部工程必须显式处理 revision 冲突。工程编写与检查通过轻量工具完成，不新增固定模板选页层。

**Tech Stack:** 现有 Node >=22、ESM、React 18、tsx、esbuild、Playwright、JSZip、PptxGenJS、pdf-lib、html-to-image。优先复用已有依赖，不为本轮引入服务端框架或其他 PPT 引擎。

**Spec:** 本文件第1节为已确认需求规格；源依据为用户本次对话的两次纠正。桌面《Dawang-PPT速度问题诊断与优化建议_20261022_Codex.md》仅作为诊断证据，其中“默认全格式交付”已被本规格替代。执行无需重新解释两份复盘里的建议。

**状态：** 2026-10-22 已按 T0–T8 实施并分项提交；最终全量回归171/171通过。HTML默认交付、候选快照已验证；现有全局安装未切换，未合主线/推送/正式发布。真实四页已内容与实际看图复核，用户视觉认可、首次制作速度目标仍待验证。执行证据见 `docs/kimi-web/html-first-acceptance.md`。原规划日期2026-10-22。

## 1. 已确认需求与约束

### 1.1 用户确认的产品行为

1. 正常制作流程是：材料 → 读取适用原规则 → 内容策划 → 自主设计 → HTML → 内容/视觉检查 → 交付HTML。
2. 默认交付目录只有一个用户命名的`.html`文件。不自动生成PPTX、PDF、逐页PNG、总览、ZIP、源目录副本或交付报告。
3. 用户打开HTML后，自行选择导出PPTX、PDF或图片；用户明确在任务中要求某种格式时也可主动生成该格式。
4. 内容质量要求保持：事实、主线、受众、证据与必要限定；Kimi原规则；字体层级、构图、图片取景、富文本强调；内容复核和实际看图检查。
5. “契约更容易使用”指明确工程字段、单位和工具调用，不是删减规则、摘要替代原文或固定页面模板。辅助API应保留直接元素和自定义布局能力。
6. QA截图允许临时使用，默认不成为交付物；浏览器直接检查也可。内部工程、必要来源及简短记录由程序统一管理，不能把临时文件转移到别处后无上限堆积。
7. 修复crop缺图误报；正常裁切、坏图识别、保存重开和按需导出同时成立。
8. 后续修改按稳定元素ID更新已保存工程，保留手工位置、字体、裁切、runs和历史，不用“删除JSON后重建”代替修改。
9. 文字采用实际字体测量，支持中英文、runs、换行和行高；不承诺数学公式保证零溢出，不自动缩字或删事实。
10. 单稿不重复做整套通用引擎回归；版本发布时完整验证编辑/导出能力，单稿保留必要的检查与保存一致性验证。

### 1.2 明确不做

- 不重写Kimi/dashi融合架构，不引入固定模板规划器，不把自由HTML当作任意可编辑导入格式。
- 不承诺PowerPoint原生Morph、任意SVG/SmartArt或任意HTML/PPTX无损导入。
- 不把原图永久预裁切或整页栅格化作为默认修法。
- 不自动清理旧稿、旧附件、旧快照或其他宿主配置；不扫描整个主目录或node_modules找范例。
- 不为提速自动切换模型、减少推理配置或降低质量标准。
- 不在每份新稿上自动导出Office文件做检查；开发测试中的导出样本仅保留在临时/测试目录。

## 2. 当前基线与优先复用点

2026-10-22只读核查：

| 项目 | 实际状态 |
|---|---|
| 源码仓库 | `/Users/meimaodawang/Documents/Dawang-ppt-fusion-v1` |
| 分支 / HEAD | `main` / `d4c19a3`；当时工作区干净 |
| Codex实际安装 | `~/.codex/skills/dawang-ppt` → `~/.dawang-ppt/install-snapshots/main-unified-20261021-d4c19a3` |
| 默认构建入口 | `build` → `render:authored` |
| 另一个常见技能入口 | `~/.agents/skills/dawang-ppt` 本次doctor报告 missing-or-broken；未检查WorkBuddy/Antigravity内部实际加载记录 |
| 测试入口 | 仓库根 `npm test -- --test-concurrency=1` |

以上可能变化，执行者先重新核查。开发仓库和安装快照分别验证，不直接编辑安装快照，也不把Git变更视为安装已更新。

可复用现有能力：

- `project/assets/template-swiss.html` 已有 `window.__exportDeckHtml`、HTML克隆/脚本内嵌/资源序列化、浏览器端PDF与PPTX导出逻辑。先测完整性，提取共用部分，避免再写第二套HTML打包器。
- `project/src/fusion/editor/browser.jsx` 已有ProjectV2编辑、草稿、保存队列、`commitPendingEdits`与浏览器PPTX导出；其服务端导出入口仍直接请求`/api/*`，与模板的降级入口可能相互覆盖，须统一。
- `project/src/fusion/editor/commands.mjs` 已有 `applyEditCommand`、撤销重做，CLI修改复用它。
- `project/src/fusion/planning/measure-layout.mjs` 已有 `createLayoutMeasurer`，但当前简单文本测量未完整处理runs；扩展它，不把旧规划器引回新稿路径。
- `project/src/fusion/qa/readiness.mjs` 检查真实img；`qa/measure.mjs`却直接对裁切外层div读取complete/naturalWidth，已复现假阳性。
- `project/src/fusion/project/store.mjs` 已有原子保存、revision冲突保护和锁，不绕开。
- `project/scripts/benchmark-authoring.mjs` 已区分制作与程序回放，拓展记录即可。

本次证据：`/Users/meimaodawang/Documents/New project/outputs/dawang-ppt-speed-audit-20261022/`。脚本含当时临时目录，重跑应创建新副本。既有四页已排版工程渲染0.237秒、QA加截图3.016秒、PPTX导出2.505秒、PDF导出3.446秒，均为单次回放测量，不能充当新稿制作时间。

真实质量验收输入位于`/Users/meimaodawang/Documents/New project/outputs/dawang-ppt产品介绍_4页大纲_20261021/`：使用`Dawang-PPT产品介绍_4页大纲.md`、`配图清单.md`及原素材，参照现有`preview/`工程。另有桌面历史稿`/Users/meimaodawang/Desktop/Dawang-PPT产品介绍-4页-20261021/`。均在副本中使用，不回写，不将其私人内容写入合成测试或公开Git。

## 3. 核心设计决策

### 3.1 内部工程与交付文件

新增自然语言制作推荐入口`make`，在 `~/.dawang-ppt/workspaces/<projectId>/` 保存内部工程，`DAWANG_WORKSPACE_ROOT`可覆盖工作区根，便于测试和其他宿主配置。内部复用现有`deck-project.json`、必要素材、规则记录；不在用户交付目录展开这些文件。

projectId复用已有`project.requirements.projectId`，不在ProjectV2顶层再建一套ID。doctor增加`defaultAuthoringCommand:"make"`及`defaultDeliverable:"html"`，原`defaultBuild:"render:authored"`继续如实表示低层build的映射，不通过改字段含义破坏旧调用者。

`build`、`render:project`、`render:brief`、`render:goal`保留兼容行为，避免破坏历史脚本。文档明确日常新稿使用`make`，低层工程入口用于开发/兼容，不能再把`build`写成默认最终交付命令。

交付路径：用户指定的`报告名称.html`。同一任务修改复用同一个内部工程，不为每轮建立新目录或复制全套assets。临时截图、测量页、导出样本按run使用操作系统临时目录，成功后清理；异常只在内部保留最近一次失败的必要证据，并在后续成功/下一次失败时替换。用户显式要求调试证据时可保留。历史用户文件不自动删除。

不重复持久化可推导的截图与总览。简短计时、检查结果和已读规则指纹优先汇入一个内部run记录，不新增多套内容台账。Kimi原文保留本机来源，不复制进公开仓库。

### 3.2 单文件HTML的完整性

- 内嵌CSS、实际用到的JS、图片/图标及这些资源的传递依赖。CSS `url()`、内嵌工程媒体引用、富文本及原图裁切引用也必须处理。
- 保留用户原图与归一化裁切参数，不能仅嵌入裁后的截图；页面顺序、跳过/删除状态不能在重开后复活。
- 字体：当前版本自带且允许分发的字体资源随HTML内嵌；任意用户本机字体不自动重新分发或声称已嵌入。保留字体声明并检查可用性，已有跨电脑字体边界不扩大。本轮同机离线验收必须通过。
- 编辑器及按需导出依赖也要可独立使用；PptxGenJS等可以内嵌后点击时初始化，但不能点击时再读取原`assets/`或CDN。
- HTML从`file://`打开，关原服务、改文件名、移目录、使用全新浏览器上下文后，仍可播放、编辑、保存更新版HTML并按需导出。
- 浏览器通常不能无提示覆盖原文件。离线“保存HTML”默认下载包含最新状态的新HTML，界面写明“下载修改后的HTML”；IndexedDB草稿不是磁盘保存成功，不显示虚假的“已写入原文件”。不强制采用File System Access API。
- 内部工程和HTML内嵌的快照使用相同ProjectV2结构。离线修改生成新revision；重新载入内部工程通过专用`import:html`入口校验，旧revision冲突保留双方，不静默覆盖。只接受本产品受支持的内嵌工程，不扩展为任意HTML导入。

HTML另内嵌一个小型`portable-project-meta` JSON：`{version:1,projectId,baseRevision,snapshotRevision,runtimeFingerprint}`。baseRevision为本次导出所基于的内部已保存revision，在离线连续修改/保存时保持；snapshotRevision跟随当前快照。导入既有工程时，既检查调用方expectedRevision，也检查baseRevision与磁盘revision一致，防止实现者只读取最新revision再传入expectedRevision而绕过旧快照冲突。元数据不是第二份可写ProjectV2，也不携带原规则全文。

### 3.3 检查与按需导出

- HTML发布前做全稿程序检查及内容/视觉复核；程序结果不能代表用户认可。
- 详细截图默认是1920×1080的临时检查输入，可返回内存buffer/临时文件；只在显式`--screenshots <dir>`时长期写出。
- 每次局部修改可检查改动页，但字体、共享媒体、全局样式、页面顺序变化必须扩大范围，最终发布仍全稿检查。
- 默认`make`或`publish:html`不能调用PPTX/PDF导出端点、不能启动后台预导出、不能生成图片交付物。
- 用户点击导出时：确认未提交文字/裁切 → 取一致快照 → 检查readiness/支持范围 → 仅生成所选格式。离线直接走浏览器能力；服务模式复用已保存revision。失败可重试但不改格式、不丢当前编辑、不触发第二个格式。
- 同一快照可在当前操作中共享采集；本轮不实现跨会话导出缓存或长期常驻浏览器池。操作结束释放页面、对象URL及临时资源。

### 3.4 质量与规则读取

提供“原文定位＋实际原文内容＋SHA”批量入口，一次读取当前稿适用制作步骤、通用规则、主场景与确实需要的辅场景/格式规则。按来源指纹判断是否变更；不能仅因磁盘缓存命中，就声称新会话智能体已阅读规则。

辅助API处理元素构造、测量、ID及单位，不替智能体判断主线、选择证据、构图与删并。直接`elements`及自定义样式仍可使用。样例是工程用法展示，不是限制性设计模板。结构清单自动生成，逐页适用性与内容取舍仍由制作智能体判断并简短记录。

## 4. 文件结构与接口约定

以下路径均相对源码仓库。`P`表示`skills/dawang-ppt/project`。新增模块名是本计划规定的待开发接口，当前不存在的命令不得写成已可用。

| 文件 | 操作与责任 |
|---|---|
| `P/src/fusion/qa/measure.mjs`, `qa/readiness.mjs` | 修复crop误报；可注入已启动page、选择页、临时原尺寸截图；不重复检测两套图片状态 |
| `P/src/fusion/authoring/elements.mjs`（新增） | text/image/line轻量辅助；直接元素入口保留 |
| `P/src/fusion/planning/measure-layout.mjs` | 在既有DOM测量器中支持runs和真实CSS文本属性 |
| `P/src/fusion/project/patch.mjs`（新增） | 批量applyEditCommand、revision冲突、事务式保存、changedSlideIds |
| `P/src/fusion/project/store.mjs` | 必要时补充锁诊断；保留原子写与历史，异常不无条件删锁 |
| `P/src/fusion/portable/html.mjs`（新增） | 共用HTML序列化、资源内嵌、ProjectV2提取与自包含校验 |
| `P/src/fusion/editor/browser.jsx`, `drafts.mjs` | 服务/单文件模式分流；离线保存语义、草稿失败降级、统一导出入口 |
| `P/assets/template-swiss.html` | 对接共用打包器和导出入口，保留已有UI；避免两套全局函数覆盖 |
| `P/src/fusion/export/collect.mjs`, `from-url.mjs` | 复用readiness与快照采集；仅按需导出，清理资源 |
| `P/src/fusion/authoring/workspace.mjs`（新增） | 任务级内部工程定位、临时资源与单次失败证据管理 |
| `P/src/fusion/authoring/pipeline.mjs`（新增） | make/publish串联及简短内部计时，默认仅HTML |
| `P/scripts/fusion-cli.jsx`, `skills/dawang-ppt/scripts/dawang.mjs` | 新命令参数分发；兼容旧入口；doctor/路径信息完善 |
| `P/src/fusion/kimi/reference-index.mjs`, `rule-manifest.mjs` | 原文批量读取、来源SHA和内部记录复用 |
| `P/scripts/benchmark-authoring.mjs` | 记录html-first交付与版本信息，延续实际token unavailable规则 |
| `skills/dawang-ppt/SKILL.md`, `references/contracts.md`, `references/fusion/{production,visual-review}.md` | 同步新的默认交付、质量标准、临时检查、按需导出语义 |
| `skills/dawang-ppt/examples/authored-minimal.mjs`（新增） | 不依赖私人素材的完整工程用法，不设固定构图要求 |
| `skills/dawang-ppt/references/authoring-api.md`（新增） | 单位、参数、错误与最短工作流，避免制作时读源码 |

### 4.1 待新增CLI

```text
dawang doctor
dawang rules:read <scenarioId> [--design <doc>] [--format <doc> ...]
dawang text:measure <specs.json> [--project <内部工程目录>]
dawang make <authored.json> <交付.html> [--workspace <内部工程目录>]
dawang patch:project <内部工程目录> <patch.json>
dawang check <内部工程目录> [--slides id1,id2] [--screenshots <dir>]
dawang publish:html <内部工程目录> <交付.html>
dawang import:html <单文件.html> <内部工程目录> [--expected-revision <revision>]
```

调用统一用`node <skill>/scripts/dawang.mjs ...`，它负责定位自身tsx。没有直接要求用户写JSON；这些是制作智能体的内部操作。

`make`负责新建，若目标内部工程已存在，返回其路径并要求走patch/publish，不静默覆盖。用户明确要求某格式时，已有`export:pptx`/`export:pdf`仍可显式调用；没有`export:all`默认行为。

### 4.2 关键函数边界

```text
textElement({id, text?, runs?, bounds, style, contentRef?}) -> TextElement
imageElement({id, mediaRef?, src?, bounds, fit?, crop?, focal?}) -> ImageElement
lineElement({id, from:[x,y], to:[x,y], style?}) -> LineElement

createLayoutMeasurer(options).texts(specs, style) -> Promise<TextMeasure[]>
TextMeasure = {id,height,width,naturalWidth,fontFamily,fontSize,fontAvailable}
// specs沿用元素字段；runs/text的含义与正式渲染一致，字号为逻辑px。

patchProject(dir, {expectedRevision, commands})
  -> {ok:true,revision,changedSlideIds} | {ok:false,conflicts}
// commands复用既有applyEditCommand契约；一项失败则整个patch不写盘。

measureProject(url, project, options)
// 保留原接口；options增加page?/slideIds?/capture?；capture输出临时buffer或明确目录。

serializePortableHtml({document,project,resolveAsset}) -> Promise<string>
extractPortableProject(html) -> ProjectV2
validatePortableHtml(html) -> {ok,unresolvedResources,issues}
// document为已物化的文档；resolveAsset(url,baseUrl)返回{bytes,mime}。
// 节点CLI可通过浏览器页内调用共用序列化逻辑，不能把浏览器DOM对象直接当Node对象传递。

publishHtml({workspaceDir,outFile}) -> Promise<{ok,projectId,revision,outFile,issues}>
// 内部全稿程序检查，原子写交付HTML；不主动导出其他格式。
```

资源URL转换只针对实际支持的HTML/CSS/工程资源字段，不对所有字符串盲目递归替换；JSON中的`<`和脚本结束标签必须安全转义。不要重新发明整个CSS/JS解析框架，先复用现有序列化器和资源清单。

## 5. Review Focus：最容易漏掉的五类情况

1. **移目录并停服务后导出失效：** 单文件仍偷偷读取原assets、CDN或`/api`。归属T4/T5，测试断网、新上下文、file协议、原服务关闭。
2. **保存时还有未确认裁切/输入：** 下载HTML或PPTX缺最后一次操作，或把草稿当作文件保存。归属T4/T5，测试操作后立即保存/导出再重开。
3. **富文本与裁切发生退化：** 测量忽略runs，patch摊平强调，HTML只嵌入裁后图片。归属T1/T2/T3/T4，以原图、run样式和crop参数断言。
4. **并发与历史被覆盖：** CLI、网页与离线快照revision不一致；一批命令部分写盘。归属T3/T4，测试旧revision、批次失败、导入冲突及原文件不变。
5. **默认交付看起来精简，后台仍导出/堆文件：** 无点击产生PPTX/PDF/PNG或每次新建内部副本。归属T6/T7，监测网络、下载、文件树和重复运行。

## 6. 分任务实施清单

执行次序：T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8。先解决真实阻塞，再完成单文件闭环，最后切换推荐流程。每项按“补失败用例 → 最小实现 → 针对性检查 → 独立提交”完成；不为文案改动编写机械镜像测试。任务完成后更新勾选和简短证据，不复制大量执行日志进规划。

### T0：确认现场与复现基准

**Files:** 读取`AGENTS.md`、本计划、doctor与现有测试；证据写入被忽略的`output/html-first/`。

**Consumes:** 当前仓库、安装与真实四页材料。**Produces:** 实际HEAD、工作区状态、技能路径、失败复现与测试命令。

- [x] 运行`git status --short --branch`、`git log -1 --oneline`和实际技能`doctor`，保留现有改动，不切分支或重置用户文件。
- [x] 开发以当前main为基线；如执行环境需要隔离，按工作树规则在执行窗口处理。不得照抄历史分支名或直接在安装快照开发。
- [x] 在临时副本复现普通图通过、`crop:[0,0,1,1]`却报missing-image。现有原稿不改。
- [x] 先定位并运行相关现有测试，确认失败是否已存在，不把旧缺陷归给新改动。
- [x] 记录现有HTML按钮离线打开、保存、导出哪些已可用，哪些因函数覆盖或assets缺失失败，作为T4/T5最小改动依据。

**完成标准：** 无运行代码变更；后续任务知道真实基线，未声称全部历史测试已通过。

### T1：修复crop误报与原尺寸临时检查

**Files:** 修改`P/src/fusion/qa/{measure,readiness}.mjs`；测试`tests/fusion/qa-readiness.spec.mjs`与新增`tests/fusion/qa-project.spec.mjs`。

**Consumes:** 既有图片readiness。**Produces:** crop正确识别、`measureProject`可选注入page/页ID/截图策略，不改变旧调用者返回结构。

- [x] 添加失败用例：相同正常图片在img和crop外层div下均通过；坏图在两种结构中均失败；未加载图有有界超时。
- [x] 添加截图用例：缩放编辑器在不同视口下捕获均为1920×1080；截图后编辑器缩放/当前页恢复；不靠放大低分辨率PNG冒充原尺寸。
- [x] 实现统一读取真实img加载信息，消除对div读取naturalWidth的错误；readiness失败仍阻止发布。
- [x] 原尺寸捕获只临时调整隔离页面的布局/scale并恢复。注入page时不关闭调用者拥有的浏览器；自建浏览器必须关闭。
- [x] 执行 `node --test tests/fusion/qa-readiness.spec.mjs tests/fusion/qa-project.spec.mjs`；预期新用例与原有小视口、零scale、缺字体检查全部通过。
- [x] 独立提交T1修复及相关测试。

### T2：完整工程用法与真实文本测量

**Files:** 新增`P/src/fusion/authoring/elements.mjs`、`skills/dawang-ppt/examples/authored-minimal.mjs`、`references/authoring-api.md`；修改`measure-layout.mjs`、`reference-index.mjs`与CLI；新增`tests/fusion/authoring-api.test.mjs`、`text-measure.spec.mjs`，沿用`kimi-rule-manifest.test.mjs`。

**Consumes:** 正式SceneElement的CSS、authoringRuleSources和原规则。**Produces:** 元素辅助、批量测量、`rules:read`、`text:measure`。

- [x] 单位/元素用例：CSS64px对应导出32pt；横线、竖线和斜线的bounds均为正且端点一致；参数未指定时使用渲染器真实默认值。
- [x] DOM测量用例：中文、中英数字混排、显式换行、不同字重、runs内不同字号/字体、letterSpacing及窄文本框。与正式页面自然高度比较误差≤2逻辑px；指定字体缺失时明确报错，不返回伪成功。
- [x] 扩展原测量器，按实际runs生成span；测量无需调用旧规划器，结束关闭浏览器/删除测量页。line辅助函数统一计算端点与bounds。
- [x] `rules:read`返回选定原文、来源路径和SHA，不输出整套风格库；缺必读来源明确失败。辅助样例包含完整requirements/sources/media/contentPlan/designChoice/slides，用合成资源，不绑定用户目录。
- [x] 文档给出完整可运行命令与字段速查，区分px、pt和裁切比例；保留任意受支持直接元素写法。
- [x] 执行 `node --test tests/fusion/authoring-api.test.mjs tests/fusion/text-measure.spec.mjs tests/fusion/kimi-rule-manifest.test.mjs`，并由样例构建工程；预期无需翻源码或临时写辅助脚本。
- [x] 独立提交T2。

### T3：按ID批量修改与保存冲突

**Files:** 新增`P/src/fusion/project/patch.mjs`；修改CLI、必要的store锁诊断；新增`tests/fusion/project-patch.test.mjs`，沿用`project.test.mjs`与`kimi-edit-roundtrip.test.mjs`。

**Consumes:** `applyEditCommand`、`saveProject`。**Produces:** `patchProject`及`patch:project`，返回changedSlideIds供T6使用。

- [x] 失败用例：修改一个标题后，其他文字runs、图片原图/crop/focal、位置、图层和页序保持；撤销重做仍生效。
- [x] 冲突用例：旧expectedRevision拒绝且磁盘不变；第二项命令非法时整批不写盘；活跃锁存在时不删锁；富文本整段重置继续要求显式resetRuns。
- [x] 在内存克隆上顺序调用已有命令，全部成功后以批次开始revision原子保存一次；不要先保存中间状态再回滚。
- [x] CLI明确输出工程路径/revision/改动页；现有`build`覆盖保护不删除。锁遗留只诊断，不自动“rm lock/tmp”。
- [x] 执行 `node --test tests/fusion/project-patch.test.mjs tests/fusion/project.test.mjs tests/fusion/kimi-edit-roundtrip.test.mjs`；预期保存冲突、历史及网页编辑回环均通过。
- [x] 独立提交T3。

### T4：单文件HTML打包、保存和受控导入

**Files:** 新增`P/src/fusion/portable/html.mjs`；修改`template-swiss.html`的现有HTML导出链、`editor/browser.jsx`、`drafts.mjs`及CLI；新增`tests/fusion/portable-html.spec.mjs`、`portable-import.test.mjs`。

**Consumes:** T1检查与现有HTML克隆/内嵌函数。**Produces:** 共用序列化/提取/自包含校验、离线保存HTML、`import:html`。

- [x] 先从既有HTML导出链提取最小共用模块，已有菜单和新CLI共用，不增加第二套序列化逻辑。
- [x] 失败用例：交付HTML移到空目录并改名，原服务关闭、新浏览器上下文断网，页面、富文本、图片及必要动画正常，无assets/CDN/API资源依赖；不测试远程视频作为本轮默认能力。
- [x] 操作用例：未确认裁切/刚改文字立即“保存HTML”，下载的新HTML重开后保留最新runs、crop、图框、页序、隐藏/跳过状态。原图资源仍在，裁切可再次调整。
- [x] 修复内嵌的ProjectV2、VM状态及资源引用一致性；防止切页时从旧seed恢复旧内容，处理`</script>`和中文文件名。
- [x] 离线IndexedDB不可用时允许编辑/下载保存，明确草稿恢复不可用，不能阻断文稿或冒充已写磁盘。
- [x] 导入用例：本产品快照可建立新内部工程；导入到已有工程需同时匹配expectedRevision和portable元数据baseRevision，离线保存多次后baseRevision仍不漂移；冲突不改任何文件。未知任意HTML、无效schema或不受支持的版本明确拒绝，不执行导入文档里的脚本来提取数据。
- [x] 执行 `node --test tests/fusion/portable-html.spec.mjs tests/fusion/portable-import.test.mjs`；预期以上均通过并保留已有HTML导出行为。
- [x] 独立提交T4。

### T5：统一用户按需导出

**Files:** 修改`editor/browser.jsx`、`template-swiss.html`、`export/{collect,from-url}.mjs`与必要预览路由；新增`tests/fusion/on-demand-export.spec.mjs`，沿用`image-crop.test.mjs`、`export-integrity.test.mjs`、`kimi-export.spec.mjs`。

**Consumes:** T4单文件与一致快照。**Produces:** 唯一的菜单调度，HTML/PPTX/PDF/图片均在用户选择时执行对应动作。

- [x] 用例：打开/编辑/保存HTML均无PPTX/PDF/图片下载，也无导出端点请求；点击某格式只下载该格式一次。
- [x] 离线用例：新上下文file协议断网，PPTX含可编辑文字/形状和原图crop，PDF页数/顺序正确，图片按用户选定页面生成；依赖不再读取assets相对路径。
- [x] 同时存在模板与fusion代码时，全局导出函数只有一个最终调度入口；离线不先尝试API再耗时降级，服务模式保持revision检查。
- [x] 操作前统一确认pending edits、字体/图片readiness，并采集一致ProjectV2快照。导出中新的编辑不混入旧快照；失败和取消不破坏编辑状态、当前页与视图。
- [x] 真坏图/不支持元素保持显式失败；PPTX不静默变整页截图。PDF仍明确是截图型，字体未嵌入等边界放相应导出提示或帮助中，不塞进日常页面主流程。
- [x] 执行 `node --test tests/fusion/on-demand-export.spec.mjs tests/fusion/image-crop.test.mjs tests/fusion/export-integrity.test.mjs tests/fusion/kimi-export.spec.mjs`；预期单文件和服务模式均通过。
- [x] 独立提交T5。

### T6：HTML优先流水线与文件生命周期

**Files:** 新增`authoring/{workspace,pipeline}.mjs`；修改CLI、`scripts/dawang.mjs`、规则记录模块；新增`tests/fusion/html-first-pipeline.test.mjs`及必要浏览器helper。

**Consumes:** T1检查、T3改动页、T4打包、T5按需能力。**Produces:** `make`、`check`、`publish:html`和内部工程定位。

- [x] 默认行为用例：调用make后，干净交付目录只新增一个HTML，无exports/qa/screenshots/delivery子目录；拦截验证从未调用PPTX/PDF导出或生成总览。
- [x] 生命周期用例：patch/publish连续三轮，复用同一工程及已存在素材，临时目录释放，不复制整套交付目录；原用户文件不删除。
- [x] 修改页检查用例：仅文字变化可以局部检查；共享字体/素材、页序、全局样式变化强制扩大检查；publish始终全稿检查。局部通过不能充当全稿通过。
- [x] publish在检查通过后原子写HTML，失败保留原交付HTML和当前内部工程；检查产物仅留最近一次必要失败证据，不积累每轮截图。
- [x] make若内部工程存在则拒绝重导入，返回明确patch/publish用法。publish不自动把离线快照覆盖回内部工程。
- [x] 在单次操作内复用浏览器/page及readiness，T2独立预排版测量不强行合并；不建立长期全局缓存或浏览器池。
- [x] 执行 `node --test tests/fusion/html-first-pipeline.test.mjs tests/fusion/kimi-entry.test.mjs`；预期新推荐入口仅HTML，旧低层入口仍兼容。
- [x] 独立提交T6。

### T7：技能规则、计时与真实质量验收

**Files:** 修改SKILL、contracts、production、visual-review、benchmark脚本；新增`tests/fusion/html-first-benchmark.test.mjs`，沿用`kimi-benchmark.spec.mjs`；本机证据留`output/html-first/`。

**Consumes:** T6产品闭环与原材料。**Produces:** 一致文档、实际计时记录、真实稿审核证据。

- [x] 同时更新技能description和默认流程，将“交付PPTX/PDF完整源目录”改为“HTML默认交付，其他格式按需”。删除每稿必须写出截图/总览/整套报告的要求，保留内容判断和看图检查。
- [x] 核对规则：原规则按需实际读取，自主设计不受样例限制；内部记录不要求用户填写JSON；用户未要求导出时不安排Office文件检查。完整引擎回归属于版本验收。
- [x] 扩展benchmark字段：installedFingerprint、host、deliveryProfile=html-first、冷/热启动、首版时间、端到端制作时间、分阶段时间、修正轮数、质量/编辑状态、实际可得tokens。程序回放单独标scope，不和制作混算。
- [x] 测试统计不重叠加总、缺失token不估计、不同模型/材料/要求不可宣称直接速度优劣；执行 `node --test tests/fusion/html-first-benchmark.test.mjs tests/fusion/kimi-benchmark.spec.mjs`。
- [x] 在私人四页材料副本做真实制作审核：7张素材逐项核对用途与删并理由；内容主线、证据作用、必要限定与页面可读性保留。与原稿比较截图，但不要求复制旧版设计。用户视觉认可单独记录。
- [x] 质量门槛优先：通过后才做每个固定条件至少3次速度记录，报告中位数和范围。原“多格式默认”与新“仅HTML默认”的结果分别列口径，不能全部归因于引擎提速；附同交付要求的比较。
- [x] 目标仅作待验证：同类4页首版≤10分钟、经一次内容/视觉复核的HTML交付≤20–30分钟。不承诺5–8分钟，不要求为了冲时间删内容或跳检查。未完成多次实测则如实标未验证，不阻止提交明确完成的功能修复。
- [x] 独立提交T7；真实素材、生成文件和原规则不进入公开Git。

### T8：全量回归、安装验证与交接

**Files:** 必要时修改`tests/fusion/install.test.mjs`；复用`scripts/install.mjs`和现有快照机制；证据留`output/html-first/`。

**Consumes:** T1–T7实现和可审阅commit。**Produces:** 开发状态、安装状态及回退信息分别明确。

- [x] 在仓库根运行`npm test -- --test-concurrency=1`与`git diff --check`。对失败定位相关改动，不能用跳过/删断言换绿。旧模板/历史ProjectV2兼容、网页编辑、裁切、runs、保存、导出专项必须覆盖。
- [x] 从两页合成稿验证端到端，再用真实四页HTML验证用户操作；Office独立渲染与PowerPoint打开/编辑/保存仅作为本次引擎版本导出验证，未能执行时写明未验，不冒充成功。
- [x] 新安装先建候选快照，独立跑doctor、make单HTML、离线保存重开、用户点击导出；开发源码通过不代表日常入口已切换。
- [x] 若执行窗口得到启用授权，沿现有安装器原子切换并保留旧快照/回退回执；从实际入口复测。未得到启用授权则交付候选及切换方法，不暗改全局链接。不自动修改WorkBuddy/Antigravity未确认的配置。
- [x] 合主线、推送、正式发布和用户视觉认可按该窗口实际授权分别处理。不得把本规划误读为已经完成验收或无条件发布授权。
- [x] 最终只给用户简短开发总结、一个真实HTML审核入口及必要未完成项；无需再生成全套附件。记录代码commit、候选/实际安装指纹、测试与回退路径即可。

## 7. 总验收表

| 场景 | 必须看到的结果 | 归属 |
|---|---|---|
| 普通图、crop原图、真坏图 | 两种正常图通过；真坏图阻断 | T1 |
| 原尺寸检查 | 不同视口捕获均为1920×1080；不永久输出 | T1 |
| 自主设计 | 样例不限制构图；原规则和内容复核保留 | T2/T7 |
| 中英混排、runs、换行 | 测量与实际渲染一致，缺字体明确 | T2 |
| 局部修改 | 不删工程、不丢其他编辑；批次失败不写盘 | T3 |
| 单文件移目录、停服务、断网 | 播放、编辑、保存HTML、重开仍可用 | T4 |
| 刚输入/裁切即保存 | 最新状态进入HTML，原图可再次裁切 | T4 |
| 受控导入与冲突 | 有效本产品快照恢复；旧revision不覆盖 | T4 |
| 默认制作/打开/编辑 | 零主动PPTX/PDF/图片导出 | T5/T6 |
| 点击导出 | 只生成所选格式；PPTX可编辑；离线可用 | T5 |
| 目录与临时文件 | 交付目录仅一个HTML；内部任务复用、临时资源释放 | T6 |
| 真实稿质量 | 主线、事实、图片证据、限定、可读性不退化 | T7 |
| 性能数据 | 制作/回放分开，交付口径一致，token不可得如实记 | T7 |
| 安装与旧稿 | 新快照独立验收、可回退、旧稿不被重写 | T8 |

## 8. 执行窗口直接使用的任务说明

把本文件交给另一个对话，并使用以下文字：

> 请实施 `/Users/meimaodawang/Documents/Dawang-ppt-fusion-v1/docs/superpowers/plans/2026-10-22-html-first-authoring.md`。先读仓库AGENTS.md和本计划，核查实际仓库与安装状态，然后按T0–T8执行修复。用户已确认：保留完整内容/设计规则与自主设计；默认只交付一个可独立使用的HTML，PPTX/PDF/图片由用户按需导出；截图和报告不再默认交付。优先复用现有HTML打包、浏览器导出、ProjectV2编辑和测量代码。不要删工程重建、删规则、固定模板化或仅修改文档；按任务补关键失败用例并验证真实浏览器操作。不要让规划窗口的旧“全格式交付”建议覆盖本计划。开发、候选安装、实际启用和用户认可分别报告，遇到范围或编辑能力下降先说明。不要主动发送消息到原对话。

执行者不需要先追问已经确认的两个产品决策。环境/原规则/素材确实缺失时，先完成不依赖它的任务，再准确说明缺口；不能据缺少跨客户端证据声称验证通过。

## 9. 规划自检记录

- [x] 用户关于质量和默认HTML的两次纠正已进入规格，并覆盖旧多格式默认建议。
- [x] 每项需求对应任务与验收，关键新接口列出签名与数据形态。
- [x] 已核查当前仓库、安装、已有模块及测试位置；标明新增命令尚未实现。
- [x] 五类容易遗漏的输入/失败模式均有归属任务与验收用例。
- [x] 单文件独立性包含编辑、下载保存、草稿异常和按需导出，不仅是播放。
- [x] 保留唯一工程状态与离线快照显式导入边界，没有引入隐式双向覆盖。
- [x] 保留事实/内容/视觉质量，区分程序检查、Office验证与用户认可。
- [x] 未以默认全格式打包、跨会话导出缓存或大规模架构重写扩大本轮范围。
- [x] 本轮只新增本规划文档；所有开发任务仍未勾选。

## 10. 实施回执（2026-10-22）

- T0–T3：现场/安装区分；crop真实img检查；独立1920截图带像素断言；原文+SHA；runs自然高度对正式渲染误差≤2px；批次修改、revision与锁保护。
- T4–T6：统一单HTML打包、离线下载保存与受控导入；两页合成稿保留未确认crop、runs、页序/跳过状态；只按点击格式下载；三轮patch/publish复用工程、失败不覆盖交付。
- T7：技能与命令说明同步；真实四页、七张素材逐项核对，旧多格式口径只在副本中修订；3次记录明确为程序回放，不宣称首版制作或模型提速。
- T8：171项回归通过、diff检查通过；候选快照独立doctor/make/离线保存重开/点击导出；实际全局入口仍是旧统一快照。LibreOffice独立渲染及PowerPoint合成样本打开/编辑/保存/重开已实测。
- 独立审阅的Important（导出中撤销/重做混入快照）已通过真实快捷键失败回归修复；Minor代码格式整理延后。
- 勾选表示实现及该条要求的处置已完成；不表示有条件的“启用安装/合主线/推送/用户认可”已经发生。首次制作≤10分钟、端到端20–30分钟及同交付条件速度比较未验证，按原规划保留此状态。
