# W1：直接元素制作入口

2026-10-20。状态：代码与两页浏览器预览已完成；效果待用户确认，W2 未开始。分支 `codex/kimi-web-editor`，起点 `e22d3be`。

## 已实现

`createAuthoredProject(input) -> ProjectV2` 接受 requirements、sources、media、contentPlan、designChoice 和 slides/elements。保留稳定 ID、元素顺序、坐标、样式、逐页 palette、图片 fit/focal 以及来源台账；不调用 planContentSlide、REGION_PRESETS 或旧模板选页。每页新增 `authoring:{engine:"kimi-authored-v1"}`，仍为 composition 页。

```sh
node skills/dawang-ppt/scripts/dawang.mjs render:authored <input.json> <output/index.html>
node skills/dawang-ppt/scripts/dawang.mjs render:project <output/deck-project.json> <output/index.html>
```

新入口只新建工程；目录中已有 deck-project.json 时拒绝覆盖，后续使用 render:project。当地媒体复制进成品目录，输入文件追加到 sources 而不是覆盖业务来源。HTML 是派生产物，唯一保存状态仍为 ProjectV2。原 build=render:brief 保持不变。

当前需要明确提供 slide.styleId 或 designChoice.styleId，供既有渲染器读取绘制默认值。这不是构图选择，元素字号/字体/颜色与逐页 appearance.palette 可以明确覆盖，不经过六外观候选。未适配的默认 token ID 明确失败。本轮不承诺任意 HTML/CSS/SVG 无损导入。

输入检测包括未知元素、重复/缺失 ID、非有限/非正尺寸、失效文字与图片引用。新路径暂不接受 semantic objects、parentId 分组、runs 或 vector，避免被旧渲染器静默忽略；后两者在 W2 实现。所有元素，包括线条，都需要正宽高的绘制区域；水平线可设 height=2、y1=y2=0。没有 authoring 标记的历史页面不受新增路径规则约束。

## 验证

| 项目 | 结果 |
|---|---|
| 新增行为测试 | 7/7；先观察新接口缺失、畸形列表、零面积线条的失败，再实现 |
| 全量 npm test | 121/121，0 失败；旧入口测试包含在内 |
| 两种构图保留 | 同样中文长标题/图片，横向横带与非等分图文边界、样式及 fit/focal 均保留 |
| 保存兼容 | 手工位置保存重开、直接入口拒绝覆盖、render:project 重渲染通过 |
| 真实浏览器 | 两页有限几何、无文字溢出/缺图、无脚本错误；改字保存重开通过 |
| 旧导出器冒烟 | 2页、23文字、2图片、2形状、5线条；同revision输出，ZIP/关系引用检查通过 |
| 导出残留警告 | content-type override 指向缺失的 slideMaster2.xml；已记录，未宣称无警告或 Office 验收通过 |

测试日志和真实稿都在忽略目录 output/kimi-web/。源码仅提交合成测试及自行撰写说明。

## 两页可看版本及边界

真实材料使用 W0 固定的《旅行导演》大纲、时间线总览与未定段截图，不联网补事实；主场景为商业提案（产品介绍）。已读取本机原制作步骤、通用规则、主场景规则及相关格式章节，来源路径与字节哈希记录于本地 rules-manifest.json。

- 封面：产品大标题、定位与主张、制作顺序、横向时间线局部。原图完整保留，cover/focal 取景放大结构，未缩小整张网页塞进右侧。
- 功能页：非等分左文右图，通过细线与字号形成层级；六项能力与边界均保留。截图完整 contain，截图内小字在整页预览中仍偏小，暂不以此宣称功能细节可读性已获认可；后续可讨论局部放大与全图并置。

已看过实际两页浏览器截图，修正了样稿页码共享引用。没有新增句内富文本、矢量图标或新QA/多格式机制。规则清单中的 runs/vector 明确为 unsupported，不把清单标成全部通过。W0 的两次失败稿与具体历史revision对应仍待核；用户已确认失败稿来源目录，本轮不声称已完成两版失败稿逐版对照。

本轮只读者任务与自由构图形成可看版本，效果认可由用户决定。W2 将补表达能力并贯穿编辑状态；W3 才进行可信QA、完整HTML/PDF/PPTX和Office验收。不改默认入口、不改全局安装、不推送、不合main、不发布。
