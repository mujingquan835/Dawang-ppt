# 公开合成示例：跨团队交接试点

这个目录保存可复用的原材料和authored输入。4页分别展示封面、数量比较、带分支流程和行动时间线；它们只是一个实例，不是固定布局库。

[下载已生成的离线HTML](https://github.com/mujingquan835/Dawang-ppt/releases/download/v0.2.0-preview.20261104/dawang-ppt-editable-showcase.html) · [逐页图片及操作图解](../../docs/SHOWCASE.md)

- `material.md`：公开虚构材料。34项、27项、7项及一周计划均为合成设定，不代表真实业务效果。
- `deck.mjs`：材料经内容提炼后的逐页元素与重点句来源，所有文字和主要图形可编辑。

## 从源码重新生成

先按仓库安装说明准备Node.js、Chrome、运行依赖与匹配的完整规则资料。以下命令在仓库根目录执行，每次使用新目录，以免覆盖人工修改：

```sh
work_dir="$(mktemp -d)"
node examples/showcase/deck.mjs "$work_dir/authored.json"
node skills/dawang-ppt/scripts/dawang.mjs make "$work_dir/authored.json" "$work_dir/dawang-ppt-editable-showcase.html" --workspace "$work_dir/workspace" --screenshots "$work_dir/pages" --summary
node scripts/capture-showcase.mjs "$work_dir/dawang-ppt-editable-showcase.html" "$work_dir/pages"
```

截图脚本在离线浏览器里执行选择、改字、撤销重做、序列化重开，并捕获真实编辑器与导出菜单。它会更新 `docs/images/` 中的公开说明图片；不模拟系统文件选择对话框，也不修改生产代码。

`make`程序检查不能代替实际内容和看图复核。新增案例仍需完整读取适用规则、按材料策划和自主设计，再逐页复核；不要把这个工程当成所有稿件的模板。

发布时只公开这些合成源材料、图片与检查后的单HTML。不提交内部工程目录、运行日志、个人路径、业务素材或规则原文。HTML可作为独立示例附件提供，skill ZIP的既有校验值保持不变。
