# 来源与许可

| 来源 | 固定基线/范围 | 处理 |
|---|---|---|
| mujingquan835/dashiai-ppt-skill | d5084d5 | 保留Git历史及原技能，新增独立入口 |
| chuspeeism/dashi-ppt-skill | 原仓库的上游来源 | AGPL-3.0与原版权声明继续保留 |
| html-deck-to-pptx | 原技能内专有组件 | 只用于原skill的兼容路径；新运行时不引用 |
| Binaryify/open-kimi-ppt-skill | 2026-10-13本地资料快照，60份规范 | 无已确认分发许可，正文未纳入；公开索引及哈希 |
| PptxGenJS 4.0.1 | MIT | 新路径独立导出 |
| Playwright-core 1.60.0 / PNGJS 7.0.0 / JSZip 3.10.1 | 各自依赖许可 | 通过npm安装，不提交node_modules |
| 新示范素材 | 程序绘制PNG | 明确标注合成，非业务证据 |

原技能已有的字体、图片与第三方组件沿用原声明。新运行时不分发字体，依赖当前系统的PingFang SC / Songti SC；跨平台应显式配置字体后重新QA。

Kimi规范只作为设计研究材料，未复制主技能、PPTD运行时或专有服务。其与用户事实、强制首尾、默认搜索、指标必须目标等冲突，按融合方案转为可选场景建议。

60份索引见 runtime/style-source-index.json；已收录不表示可交付。三套新适配的能力见 runtime/capabilities.json。
