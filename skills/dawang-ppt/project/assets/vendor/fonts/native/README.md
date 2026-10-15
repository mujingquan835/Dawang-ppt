# Office 字体包

从原网页内置的 Archivo、Space Mono 拉丁字形 WOFF2 生成的 6 个 TTF。Archivo 按原 CSS 的 400/700/800/900 字重实例化；Space Mono 保留 400/700。字形来源、版权、许可及 SHA-256 见 manifest.json，授权见同目录 OFL 文件。只含原网页对应的拉丁字形，不提供中文替代字体。

由 FontTools 4.67.0 与 Brotli 1.2.0 转换；没有修改字形设计。Office 使用内部字族名（Archivo SemiBold / ExtraBold / Black、Space Mono），导出器已经映射。用户字体安装为明确选择，不随运行技能自动执行。

macOS 安装：将所需 .ttf 打开到“字体册”安装，或复制到当前用户 Library/Fonts。不要覆盖不同版本；先记录来源、目标与文件哈希。接收 PPTX 的另一台电脑也需要相同字体，否则 Office 仍可能替换。本版未实现跨设备字体内嵌。
