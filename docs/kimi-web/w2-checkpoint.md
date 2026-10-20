# W2：富文本、矢量与编辑状态回环

2026-10-20。状态：工程检查点通过；真实两页效果待用户确认；W3 未开始。分支 codex/kimi-web-editor，起点 09f4600。

## 本轮交付

- 文字支持可选 `runs:[{text,style}]`，保留句内颜色、字重、字体、字号、斜体、下划线及字距。渲染、旧编辑状态桥接、保存和重开消费同一份元素状态；兼容原纯文本。
- 新增 `text-runs` 编辑命令。对富文本执行普通 `text` 替换时，返回 `rich-text-reset-required`；只有显式 `resetRuns:true` 才清除 runs，撤销可恢复。
- 侧栏支持逐段改字、颜色和字重，画布内保留 span 边界的输入也保留样式；破坏整个边界的替换会恢复原结构并提示使用侧栏或明确转为纯文本。
- 新增受控 `vector`：正尺寸 bounds、四数值 viewBox、SVG path 与受控样式，不接收任意 SVG/HTML 或脚本。矢量可选中、移动和调整线条样式；细线继续使用已有 line 表达。
- 图片换图继续保留 fit/focal；修复直接元素无 objects 时 Alt 拖动的空值访问，手工位置保存后不回跳。
- 按用户附带要求移除工作台右下角的显示名称，并调整旧校验器不再强制此名称。NOTICE/LICENSE 未修改；原社媒图标、导出元数据不在这次展示文字修改范围内。

句内 runs 为规范文本，materialize 时 text 由 runs 串联得出；使用 text-runs 修改带 contentRef 的文字会同步建立可追溯的编辑内容节点。旧 HTML 文字状态为序列化的派生状态，不作为独立主数据。

## 实测结果

| 检查 | 结果与证据 |
|---|---|
| W2 针对性测试 | 6/6，包括实际 Chromium 侧栏/画布输入、撤销重做、换图、Alt拖动、保存重开与名称移除 |
| W0/W1 关联测试 | 15/15 |
| 首次并行 npm test | 126/127；旧 tests/browser.test.mjs:62 刷新出现 ERR_ABORTED，完整失败日志保留 |
| 旧浏览器隔离复核 | 3/3；未修改旧 runtime 或放宽断言 |
| 全量串行 npm test -- --test-concurrency=1 | 127/127，0失败；并行刷新竞态未宣称已修复 |
| 两页真实浏览器 | 有限几何、无文字溢出/缺图、无脚本错误；实际截图已查看 |
| 两页真实编辑回环 | 改强调词、撤销重做、换图保焦点、Alt移动、保存重开均通过，演示后恢复审核文案及位置 |
| 旧导出器冒烟 | 24个文字对象、2图片、6形状（含4个矢量图标）、5线条；同revision，ZIP/引用结构检查通过 |

本地证据在忽略目录 `output/kimi-web/w2/`：`red.log`、`browser-test.log`、`related.log`、`full.log`、`legacy-browser-isolated.log`、`full-serial.log`、`review-report.json`、`real-roundtrip.log`、`rules-manifest.json`、`screenshots/`、`author-footer.png`。真实材料、生成稿、原始规范不进入Git。

## 效果与后续边界

封面加入句内强调；功能页加入原生线性矢量图标，保留 W1 的构图、文字事实及完整功能截图。功能截图的小字在整页预览中仍偏小，未以几何检查代替用户效果认可。当前只做两页，不扩展全稿。

原导出器保留一项缺失 slideMaster2 的 content-type override 警告；PPTX runs 的完整排版、字体状态、PDF、PowerPoint实机及可信QA仍按W3单独验证。矢量冒烟报告为 editable-freeform，使用既有路径采样，不能据此承诺任意SVG无损或Office效果已通过。

旧 `validate-swiss-deck` 使用模板 layout 注册表，直接检查 fusion-composition 时仍会报两页 layout 未注册（`shell-validator.log`）；本轮不将其当成新路径QA，不为通过它伪装页面类型。新的可信QA在W3统一处理。名称移除已通过实际浏览器和旧模板单独验证。

本轮没有推送、合main、正式发布或切换全局安装。W2检查点后暂停，效果待用户确认。
