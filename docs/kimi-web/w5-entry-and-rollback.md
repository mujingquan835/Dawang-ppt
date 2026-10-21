# W5：开发入口、日常安装与回退

2026-10-21。本文件描述候选入口与可执行的切换方式；不是日常安装已经启用的证明。W4视觉认可和实际成本证据限制仍在 [验收记录](acceptance.md) 中保留。

## 入口迁移

| 场景 | 命令与行为 |
|---|---|
| 智能体新建自主设计 | `build authored.json deck/index.html`，等价`render:authored` |
| 原contentSlides brief | 显式`render:brief brief.json deck/index.html`，继续旧实测规划器 |
| 用户明确指定原样模板 | 显式`render:goal goal.json deck/index.html` |
| 已保存工程与人工编辑 | `render:project deck/deck-project.json deck/index.html` |
| 历史外观板 | `styles`/`styles:grid`保留，但不是自主设计的前置步骤 |

build遇到旧brief/goal会在创建输出前给出对应迁移命令；已保存ProjectV2也须render:project，防止当作新输入重建而丢失editorState。原有工程输出目录存在时继续拒绝覆盖。

自主设计使用`styleId:authored/custom`、页面palette、元素bounds/字体/字号；中性绘制默认值不经旧选页或REGION_PRESETS。它不是把第七个风格包装为全库适配，也不表示未适配旧主题可被原样复现。只有显式kimi-authored-v1页面能用该默认值；旧composition的限制保持。

制作智能体实际读取原Kimi步骤和适用规则，生成工程与逐页规则清单；用户自然语言交材料即可。CLI不承担模型制作或规则理解，也不要求用户编写元素JSON。

## 当前安装核查

本机开发源码位于Dawang-ppt-fusion-v1；原日常安装`~/.codex/skills/dawang-ppt`直接链接该开发目录。若直接修改源码，日常入口会立即变化，无法把开发与启用分开。

因此本轮在修改前，将提交`2948a42`的skill内容固定为本地快照：

```text
~/.dawang-ppt/install-snapshots/pre-w5-2948a42/
```

日常符号链接已指向该快照，代码与技能规则保持开发前内容；没有启用候选build默认值。快照在output之外，避免清理生成稿时意外删除日常安装。快照node_modules复用开发目录的依赖链接，两个lockfile本轮未改；它不是独立依赖归档，启用前不要移走依赖或删除快照。

运行仓库的`doctor`查看skill/project、defaultBuild与installations：usesThisSkill=false表示日常安装仍为其他版本，不是当前候选。旧快照doctor保留旧输出格式，不会虚报新默认值。安装保存回执和两次doctor证据仅在本机`output/kimi-web/w5/`，不提交用户绝对路径或运行数据到Git。

## 验收后启用候选

先看实际doctor和链接，与下面预期路径不一致时重新核对，不强制覆盖。以下是本机路径结构的示例，换机用实际位置：

```sh
node skills/dawang-ppt/scripts/dawang.mjs doctor
node skills/dawang-ppt/scripts/install.mjs --replace-link "$HOME/.dawang-ppt/install-snapshots/pre-w5-2948a42"
node "$HOME/.codex/skills/dawang-ppt/scripts/dawang.mjs" doctor
```

installer只替换指向明确匹配旧目录的符号链接，拒绝删除独立安装。它先写`.rollback-时间-pid.json`回执，再原子替换链接，保留旧目录。启用后doctor应显示defaultBuild=render:authored且日常安装usesThisSkill=true。新机无安装时可使用install.mjs创建；有其他安装先核对，不照搬源电脑回执。

## 回退

日常启用后如需回退，在仓库根目录执行保留快照的installer，要求当前链接仍指向本仓库skill：

```sh
node "$HOME/.dawang-ppt/install-snapshots/pre-w5-2948a42/scripts/install.mjs" --replace-link "$PWD/skills/dawang-ppt"
node "$HOME/.codex/skills/dawang-ppt/scripts/dawang.mjs" doctor
```

这样恢复旧build行为，保留候选源码和全部ProjectV2。候选authored/custom工程只能由支持它的版本打开，旧快照可能不识别；回退日常入口不会把新工程转换成旧格式。继续编辑这些稿件可显式运行候选仓库的render:project，不能重导入brief覆盖。

仓库内部临时使用旧制作流程无需回退安装，直接render:brief即可。不要git reset --hard、删源码/依赖或清理ProjectV2来实现回退。

## 状态必须分开

- 开发：候选默认入口、自由绘制默认值、原规则制作说明和迁移/回退检查。
- 安装：当前日常安装固定在开发前快照；最终启用另行执行。
- 验收：程序通过、看图、Office检查与用户认可分别记录；缺token仍为unavailable，不承诺成本节省。
- 同步/发布：用户先前授权本开发分支GitHub同步，可保留开发进度；不合main、不发布0.2.0、不宣称全库迁移。


## 工程验证结果

W5候选开发检查通过：最终全量152/152，0失败，105.1秒；入口/安装/旧路由针对性15/15，修正后新入口7/7及实际持久目录浏览器检查通过。首次全量151/152的验证夹具时序问题及原日志保留在验收记录中，不伪称首次全绿。独立审查未发现生产Critical/Important问题。

两页合成稿实际截图已查看：自选浅底/深底、自由文字坐标、侧栏改字、撤销重做、保存重开、同当前/磁盘revision的原生PPTX通过。它仅证明候选入口链路，不替代W4两份真实稿件的用户认可，也不增加新的跨电脑Office承诺。开发完成不等于本文件上方安装启用命令已经执行。
