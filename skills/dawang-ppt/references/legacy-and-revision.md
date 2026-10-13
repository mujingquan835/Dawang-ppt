# 旧主题与返工

旧主题使用仓库固定副本 `skills/dashiai-ppt`，不依赖会变化的全局目录。入口为 runtime/legacy.mjs 的 compileLegacy/buildLegacy，输入仍是 Dawang 内容计划；每页 legacy.layout 与 legacy.bindings 显式绑定字段到内容 ID。requiredContentRefs 未映射会拒绝。原媒体复杂契约尚未统一，必需媒体的旧主题自动适配明确拒绝，不自动删图。

先用原 project 的 layout:query / inspect:layout 找到容量匹配页面，再写 bindings。原渲染、编辑和导出继续在原 skill 边界内运行；专有导出器未移入 Dawang 运行时。

旧组件不能自动套三套新风格参数。旧导出差异与原编辑状态按原入口检查；Dawang 新数据层不声称把旧浏览器全部编辑反向映射。

局部修改先保存 project 快照。浏览器编辑按内容 ID 回流，布局覆盖按元素 ID 保留。一个内容 ID 被多页引用时改字会同步影响这些页；只改一页需先拆成独立内容 ID，并保留来源引用。style/结构变更导致覆盖失效时会阻断。
