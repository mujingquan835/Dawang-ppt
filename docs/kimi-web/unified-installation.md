# main统一安装与回退

2026-10-21。用户明确授权整合此前未提交的20个文件，并更新本机技能。统一范围为W0—W5直接制作入口、内容策划与取舍规则、鼠标拖动和文字属性修复、自由裁切及网页神奇移动。保持0.2.0-dev，不作为正式版本发布。

## 使用入口

`~/.codex/skills/dawang-ppt` 指向完整的版本快照，位于 `~/.dawang-ppt/install-snapshots/main-unified-20261021-<提交短SHA>/`。不再从旧快照挑选部分文件叠加；快照从同一个已提交的main导出，运行依赖按自己的lockfile安装，不依赖开发树的node_modules链接。

执行 `node ~/.codex/skills/dawang-ppt/scripts/dawang.mjs doctor` 查看实际路径。统一版应显示 `defaultBuild: render:authored`，该安装的 `usesThisSkill: true`，`runtime: true`；SKILL包含“内容策划与取舍”，编辑器包含裁切与神奇移动功能。开发源码路径的doctor可能显示usesThisSkill=false，这是源码与独立快照路径不同，并非安装缺失。

用户继续用自然语言交材料。智能体先读原规则并整理主线、逐页主张、支撑证据、取舍及必要限定，再自主设计。旧brief显式render:brief，旧模板render:goal，已保存ProjectV2使用render:project，不重新导入初始材料覆盖人工修改。

## 切换、校验与恢复

安装前保留原magic-move快照；新快照先独立检查制作、编辑、裁切、撤销重做、保存重开与同revision导出，再调用新快照的 `scripts/install.mjs --replace-link <原快照绝对路径>`。安装器核对旧目标并写回退回执后原子替换符号链接；不删除原快照。

安装后从实际全局入口再核对doctor、文件SHA、制作及编辑导出。源码全量回归与安装检查分别记录；日志和安装机器的路径/回执放本机忽略目录 `output/kimi-web/unified-install/`，不提交用户材料。程序检查不能证明新内容策划规则已获得用户审美认可。

如需回退，先读本机安装回执中的previousTarget与nextTarget，再运行旧快照的安装器，参数为 `--replace-link <当前统一快照绝对路径>`。不要删除当前快照、重置源码或改写演示工程来回退。

## 本次审查与回归

独立审查发现裁切中直接导出HTML会丢弃临时裁切。回归先复现失败，再修复为导出前确认、克隆内嵌当前ProjectV2；专项验证包括在新浏览器上下文以file协议重开，确认裁切、图框和富文本样式保留。PDF/PPTX主入口经save()确认，无同一遗漏。原失败与修复日志保留，不以此前157项通过代替该新增场景检查。复核未发现其他Critical/Important阻断项。

修复后最终全量157/157通过，0失败，107.8秒（本机日志 `output/kimi-web/unified-final-full.log`）。安装实际路径、提交和安装专项结果由本机回执记录，不能只根据本段源码测试认定安装已切换。

## 既有页面与验收范围

已生成HTML不会因安装更新自动变化。需要新编辑器时，从对应保存的deck-project.json重渲染，保留原工程备份；本次统一安装不批量重建用户的演示目录。

自由裁切保留原图和归一化源区域；PPTX用原生srcRect。神奇移动仅用于网页，不承诺PowerPoint原生Morph。PDF为截图型，PPTX字体不嵌入；跨电脑显示与Office人工检查仍须另行确认。本机安装成功、GitHub同步、用户效果认可和正式发布分别记录。
