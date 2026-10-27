# Dawang-PPT 详细使用说明

适用版本：`v0.2.0-preview.20261027`。终端命令用于一次性安装和排错，日常制作直接给 AI 材料和需求。

## 1. 你需要安装吗？

| 使用方式 | 需要准备 |
|---|---|
| 查看、演示、手动修改别人交付的 HTML | Chrome / Edge 和该 HTML 文件 |
| 让 AI 新建或继续修改演示稿 | 支持本地 skill、终端和浏览器操作的 AI 客户端，以及下面的运行环境 |

Dawang-PPT 不是独立 AI 模型或在线生成服务，不附带模型账号与额度。实际模型、权限和费用由你使用的 AI 客户端决定；不需要另配一个专属生成 API。

## 2. 环境要求

| 项目 | 要求 |
|---|---|
| Node.js | 22 或以上；终端运行 `node --version` 和 `npm --version` 检查 |
| 浏览器 | Chrome / Chromium / Edge；源文件保存推荐 Chrome / Edge |
| AI 客户端 | 能读取本地 SKILL.md、执行本地命令并查看浏览器或截图 |
| 网络 | 首次安装 npm 依赖需要网络；成稿 HTML 可离线使用 |
| 制作规则 | 已内置，无需额外安装规则包或其他演示 skill |
| 平台 | macOS 为主要实测环境；Windows / Linux 完整制作链路尚未验收 |

Windows 的符号链接权限、CLI 启动器和字体可能需要适配，不能把成功解压等同于完整可用。仅查看、手动编辑交付 HTML 可先用 Chrome / Edge 验证。

## 3. 下载并安装

### 推荐：独立分享包

1. 打开 [本次下载页](https://github.com/mujingquan835/Dawang-ppt/releases/tag/v0.2.0-preview.20261027)。
2. 选择 `dawang-ppt-v0.2.0-preview.20261027.zip` 附件。Source code 是完整仓库，包含历史维护文件。
3. 解压得到 `dawang-ppt`，移至长期保留的位置，例如 `~/AI-Skills/dawang-ppt`。安装后不要移动或删除它。
4. 终端进入该文件夹运行：

```sh
cd "$HOME/AI-Skills/dawang-ppt"
npm ci --prefix project
node scripts/install.mjs
node scripts/dawang.mjs doctor
```

放在其他位置时修改第一行。首次安装需要访问 npm，后续使用无需每次重装依赖。安装器默认创建 `~/.codex/skills/dawang-ppt` 符号链接，指向当前文件夹，不复制文件。

### 其他客户端

仍在解压后的 skill 根目录，选择自己实际使用的入口执行：

```sh
# WorkBuddy
node scripts/install.mjs --target "$HOME/.workbuddy/skills/dawang-ppt"
# 使用 .agents/skills 的客户端
node scripts/install.mjs --target "$HOME/.agents/skills/dawang-ppt"
# Claude 的本地用户 skill 目录
node scripts/install.mjs --target "$HOME/.claude/skills/dawang-ppt"
```

其他客户端使用其实际 skill 目录作为 `--target`。路径已注册不等于应用会话已加载；需新开会话，确认 AI 实际读取了当前 SKILL.md。doctor 自动列出 Codex、WorkBuddy、agents 三种入口，未列出其他客户端不代表安装失败。

### 维护者从源码安装

仓库路径比独立 ZIP 多一层 `skills/dawang-ppt`：

```sh
git clone --branch v0.2.0-preview.20261027 --single-branch https://github.com/mujingquan835/Dawang-ppt.git
cd Dawang-ppt
npm ci --prefix skills/dawang-ppt/project
node skills/dawang-ppt/scripts/install.mjs
node skills/dawang-ppt/scripts/dawang.mjs doctor
```

## 4. 安装成功怎么看

独立包执行 `node scripts/dawang.mjs doctor`，确认：

```json
{
  "defaultAuthoringCommand": "make",
  "defaultDeliverable": "html",
  "runtime": true,
  "rules": {"provider": "dawang-ppt", "status": "pinned"}
}
```

实际结果还包含路径、指纹和各客户端入口。`runtime: false` 表示运行依赖未就绪；规则为 `drift` / `unpinned` / `error` 表示文件缺失或与本版指纹不符，不能继续当作完整安装。重新解压同一版本或联系维护者核对，不让 AI 自行改锁绕过检查。

`usesThisSkill` 只表示相应客户端入口是否指向当前正在检查的 skill。源码目录和独立安装目录不同，可能显示 false；应从实际安装入口再次核对。

## 5. 第一次让 AI 制作

安装后新开会话，明确指定 `dawang-ppt`，附上材料，并说明：受众、用途、页数、必留素材、可否改文案、品牌或视觉要求、交付格式。

通用提示词：

> 使用 dawang-ppt，将附件制作成 6 页季度复盘，面向部门负责人。允许提炼文案，但不补造数据或因果，保留单位、时期、来源和待核状态。先形成逐页主张与可上屏文案，再自主设计并逐页看图检查。默认交付一个可离线编辑、保存的 HTML。

产品介绍：

> 使用 dawang-ppt，将这些产品材料制作成 3 页介绍，面向首次接触产品的同事。讲清解决的问题、核心操作和适用范围，优先评估沿用截图的产品视觉语言。保留重要界面内容，不把主要价值只放在图注中。

仅改排版：

> 使用 dawang-ppt，仅优化附件的布局与文字层级，原文、数据和指定图片锁定，不增删文案，保留已有人工编辑。

培训材料：

> 使用 dawang-ppt，为新同事整理 5 页操作培训。用步骤和具体例子讲清如何做、常见错误及自查方法。没有依据的案例不要补写，默认不添加讲师备注。

流程：理解材料 → 读取本版适用规则 → 提炼文案 → 自主设计 → 编辑保存 → 内容与看图复核 → 单 HTML 交付。程序检查不能替代逐页内容和视觉评审。AI 新写的定位句与重点句应列出供你确认。

## 6. 手动编辑与保存

1. 用 Chrome / Edge 打开交付 HTML；不需要启动本地服务。
2. 单击选中对象，拖动移动，控制点缩放；文字双击后进入编辑，侧栏提供对应属性。
3. 顶部撤销、重做可回退修改；Esc 或点击空白区域退出选择，Tab 保持正常焦点导航。
4. 图片裁切后检查主体、关键字段和截图文字是否保留。
5. 第一次点“保存”或按 `⌘S / Ctrl+S`，在文件选择框选择**当前已经存在的原 HTML**并授权写入；不是创建同名空白文件。
6. 成功写入并关闭后才提示已保存。保存后重开，核对修改保留。浏览器可能再次要求授权。

取消选择、无权限、选错文件、冲突或写入失败时，保持页面打开并按提示处理。浏览器草稿不等于源文件保存；“下载 HTML 副本”是显式导出，不会自动将原文件标为已保存。换浏览器、电脑或移动文件后，可能需要重新关联保存目标。

分享成稿时发送该 HTML 即可。接收者不需要 skill、Node.js 或制作工具；手动保存仍需支持文件写入的浏览器。离线文件内应包含工程快照和必要资源。

## 7. 导出 PPTX、PDF 和图片

在网页使用相应导出入口，或明确要求 AI 输出需要的格式：

> 同时导出一份可编辑 PPTX，说明字体及目标 PowerPoint / WPS 客户端尚未验证的部分。

| 格式 | 用途 | 限制 |
|---|---|---|
| HTML | 离线展示、继续编辑和移交 | 默认交付，保留工程快照与资源 |
| PPTX | 在 PowerPoint 等工具中编辑 | 字体不嵌入，截图中的文字仍为图片；目标客户端需复核 |
| PDF | 固定版面发送或打印 | 截图型，正文不可按普通文本选择 |
| 当前页图片 | 群聊预览、插入文档 | 静态图 |

不承诺原生数据图表、SmartArt、任意 SVG / 动画、原生 Morph 或跨客户端像素一致。导出前核对当前状态和保存结果。

## 8. 让 AI 继续修改已有稿件

重新提交**保存后的 HTML**，说明页码、修改对象和保留范围：

> 使用 dawang-ppt，基于这份保存后的 HTML 修改第 2 页，把标题改成“本季度优先解决两个问题”，放大右侧截图，其余保持不变。不要从最初材料重建覆盖人工修改。

支持的 HTML 会提取可移交工程快照；任意网页和任意 PPTX 不在无损导入范围。发生版本冲突时保留双方，不删除旧工程强行重建。

## 9. 常见问题

| 现象 | 处理 |
|---|---|
| node / npm 找不到 | 安装 Node.js 22+，重开终端与客户端 |
| runtime 为 false | 独立包执行 `npm ci --prefix project`；源码安装使用较长路径 |
| rules 为 drift / unpinned / error | 恢复同版本文件或联系维护者；不自行改锁 |
| Chrome executable not found | 安装 Chrome，或将 CHROME_PATH 指向真实可执行文件 |
| AI 没用此 skill | 新开会话，明确指定 dawang-ppt 并确认它读取正确 SKILL.md |
| already exists / replace-link required | 有其他安装，按下节显式升级，不删除旧版强装 |
| 保存时要求选择文件 | 首次关联原 HTML 是预期流程，选中当前文件并授权 |
| 保存失败或选错工程 | 保持页面打开，按错误提示重新选择，草稿不等于已写盘 |
| 浏览器不支持源文件写入 | 使用新版 Chrome / Edge；下载副本需显式导出 |
| 换电脑字体或排版变化 | 安装所需字体，或改用目标电脑已有字体后重新复核导出 |
| 预览端口冲突 | 让 AI 使用 preview:start 并省略端口以自动分配 |

macOS 浏览器路径示例：

```sh
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

终端中的 export 仅作用于当前终端及其子进程。桌面客户端可能不继承它，需在客户端自己的启动环境中配置。若未改配置，程序也会尝试发现本机浏览器。

## 10. 更新、回退、卸载

新版放到新目录，保留旧版；先装新版依赖并检查 doctor。macOS / Linux 可用 `readlink "$HOME/.codex/skills/dawang-ppt"` 查看旧链接，再在新版 skill 根目录运行：

```sh
node scripts/install.mjs --replace-link "/旧版实际skill绝对路径"
```

其他客户端加 `--target "/该客户端的skill入口"`。占位路径请换成真实绝对路径。只有旧链接匹配时才切换；安装器生成回退 JSON 回执，实体目录会拒绝覆盖。

回退：在旧版 skill 根目录运行旧安装器，以新版实际路径作为预期旧目标：

```sh
node scripts/install.mjs --replace-link "/新版实际skill绝对路径"
```

重新检查实际入口并新开 AI 会话。更新 skill 不自动修改历史 HTML，不为更新编辑器批量重建旧稿。

卸载：在当前注册的 skill 根目录运行：

```sh
node scripts/install.mjs --uninstall
```

其他入口需各加相应 --target。只移除指向自身的注册链接，文件夹和稿件保留，不会替你卸载其他客户端入口。

## 11. 校验下载与反馈

下载页提供 SHA256SUMS.txt。macOS 可运行 `shasum -a 256 dawang-ppt-v0.2.0-preview.20261027.zip`，与清单比较；Linux 用 sha256sum，Windows PowerShell 用 Get-FileHash。包内 PACKAGE-MANIFEST.json 列出各文件哈希。

反馈时提供版本、系统、Node.js / 浏览器版本、doctor 状态、步骤与报错；可使用脱敏合成材料复现。不要上传业务原稿、隐私、凭据或完整本机路径日志。程序测试、实际视觉认可、客户端加载和目标 Office 验证分别记录。
