# 换机继续本分支

更新：2026-10-21。当前工作分支 **codex/kimi-web-editor**，不是main或旧codex/fusion-v1。用户已授权将开发进度推送GitHub，方便另一台电脑继续；这次同步不等于合并、发布或默认入口切换。

## 已完成与下一步

W0规则来源、W1直接制作、W2富文本/矢量及编辑保存、W3可信QA与同revision多格式导出、W4成本记录工具与双场景工程检查点均已实现。

| 检查点 | 提交 |
|---|---|
| 新方案 | 12b8d03 |
| W0 | e22d3be |
| W1 | 09f4600 |
| W2 | 041c533 |
| W3 | 29898e5 |
| W4 | b8e06aa |

最后一次代码全量检查（W5）：`npm test -- --test-concurrency=1`，152/152，0失败；换机后须重新验证本机环境。完整验收和未完成项看 [acceptance.md](acceptance.md)，逐项计划看 [整合方案v4](../superpowers/plans/2026-10-20-kimi-web-editor.md)。

**W5候选入口已开发，最终验证结果与日常启用状态见验收记录。** 下一位开发者先读AGENTS.md、上述验收记录和v4计划，不自动沿README的旧分支命令或默认build制作新稿。新路径是`render:authored`，保留`render:project`重开工程。不要从初始brief覆盖保存过的工程。

仍待处理：

- 用户对旅行导演4页与管理汇报8页分别给出最终视觉认可，不能把144/144或Office打开视为认可。
- 旧八页对象、内容、几何和DOM一致；7页PNG逐像素相同，第3页原照片内部有小像素差异。原严格比较失败保留，后续视觉检查未见内容或构图变化；“栅格采样差异”仍为推断。
- 两条路径的实际模型/token不可归属，为unavailable；仅有程序回放计时，不能宣称普遍更快、更省或已达到认可总成本。若继续比较，设计同材料同要求的连续实验，记录实际usage，或由用户明确接受该证据限制。
- W5候选build默认值已开发；日常安装为2948a42旧快照，待验收后按[w5-entry-and-rollback.md](w5-entry-and-rollback.md)启用并保留回退点。源电脑的安装快照不会随Git同步；新机必须重新doctor核对实际链接。main未切换。

## 在另一台电脑拉取代码

首次获取：

```sh
git clone --branch codex/kimi-web-editor --single-branch https://github.com/mujingquan835/Dawang-ppt.git
cd Dawang-ppt
npm ci
npm ci --prefix skills/dawang-ppt/project
node skills/dawang-ppt/scripts/dawang.mjs doctor
npm test -- --test-concurrency=1
```

已有检出：先保留本机未提交工作，再执行：

```sh
git fetch origin
git switch codex/kimi-web-editor
git pull --ff-only origin codex/kimi-web-editor
```

本机没有该分支时使用`git switch --track origin/codex/kimi-web-editor`。如果快进失败，先检查本地分叉，不force、不hard reset。依赖按两个lockfile安装，不复制node_modules；使用Node.js22+。浏览器实测是macOS+Google Chrome，测试和默认导出器仍有macOS Chrome路径；其他平台先核对路径支持。字体未嵌入，接收机字体另验。

## GitHub代码与本地接续包的区别

仓库公开，仅同步源码、合成测试、计划及验收状态。以下不会随git clone出现：`output/`内真实稿件/媒体/QA/Office证据、`.superpowers/`本地执行台账、Kimi原文规则库、字体和node_modules。不要将其强制加入Git或公开Release。

本次另生成本地 **Dawang-PPT-换机接续-20261020.zip**，放在源电脑的文稿目录。通过用户自己的AirDrop/移动盘等方式传输，压缩包不会上传公开仓库。其`repo-local/`按仓库相对目录保存，合并复制到新检出根目录；包含W0—W4本地材料/证据、已验收旧八页回归基准及执行台账。若新机已有output，先保留，避免覆盖新机更晚的编辑。

接续包中的`local-kimi-rules/`仅含本轮所读的完整原始制作规则与格式文档，不是已安装可执行技能。设置环境变量即可作为规则来源：

```sh
export KIMI_PPT_SKILL_DIR="/接续包实际位置/local-kimi-rules"
```

历史rules-manifest中的绝对路径属于来源追溯，不可仅为消除告警静默改指纹；新机读取原文后建立本机来源路径，核对原SHA并另存新清单。若新任务需要其他场景/设计系统，另提供其完整合法来源，不以本包的少数文件冒充全库。

真实已保存工程内媒体已打包为相对路径。复制后可直接启动：

```sh
node skills/dawang-ppt/scripts/dawang.mjs preview:start output/kimi-web/w4/travel/preview 8775
node skills/dawang-ppt/scripts/dawang.mjs preview:start output/kimi-web/w4/management/preview 8776
```

两个命令分别保持运行，访问各自localhost端口。旧电脑localhost链接无法直接跨电脑使用。原稿来源元数据、本地一次性制作脚本仍可能含旧电脑绝对路径；复跑前按包内真实材料重新定位，不能认为git拉取已同步桌面文件或字体。两份源大纲另放在包的`source-materials/`。

## 发给另一台电脑Codex的接续提示

> 继续此仓库codex/kimi-web-editor分支。先读AGENTS.md、docs/kimi-web/continue-on-another-computer.md、acceptance.md与v4方案。W0—W4开发检查点已交付，W5候选入口已开发，最终测试/安装状态看acceptance.md；两份整稿视觉认可、旧页照片像素差异和实际token证据限制仍需如实处理。先核对分支、同步提交、依赖与本地接续包，再根据我的下一条指令处理验收或W5日常启用；不要自动推main、发布或覆盖全局安装。
