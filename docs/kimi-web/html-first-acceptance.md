# HTML 默认交付：开发、验收与本机启用

2026-10-22，执行规划 `docs/superpowers/plans/2026-10-22-html-first-authoring.md`。源码从 `d4c19a3` 开发于 `codex/html-first-authoring`；运行实现截止 `5f3149c`，正式渲染测量对比测试提交 `e1810e4`。用户确认当前 HTML 版本无问题并授权合并、启用后，已快进合入本机 main；随后用户要求“继续”，本轮将已验收主分支同步到既有GitHub远端。未正式发布。

## 功能与验证

- 推荐 `make` / `publish:html`，交付目录只有用户命名的一个 HTML。旧 build/render 入口继续兼容。内部工程由 `DAWANG_WORKSPACE_ROOT` / `--workspace` 定位，patch 按稳定ID原子更新；最终发布全稿检查。
- QA检查真实img；原尺寸截图隔离父容器，像素验证1920×1080并保留canvas图像；恢复调用者视口与页面。六组正式SceneElement文字自然高度对比误差≤2逻辑px，缺字体明确失败。
- 停服务、移目录改名、file协议、新断网上下文、禁用IndexedDB，仍可编辑、确认待定crop、下载修改后的HTML和重开。两页合成稿保留runs、原图crop、页序与跳过状态。离线自动保存仅为草稿，不自动下载；界面明确磁盘保存是下载新HTML。
- 菜单按需PPTX/PDF/当前页PNG，一次操作仅生成该格式；原生PPTX保留可编辑文字/形状与原图srcRect，PDF为截图型。导出期间真实Meta+Z与重做不能修改快照或消耗历史。
- 全量命令 `npm test -- --test-concurrency=1`：171/171通过；`git diff --check`通过。独立只读审阅发现一项Important，已有RED→GREEN和全量验证；Minor核心模块格式整理延后。

## 真实材料与性能

真实四页在副本中使用，七张素材逐项记录用途/取舍，实际看图并保留事实、证据与限制。历史默认多格式/目录文案按本轮规格调整；未回写旧工程或私人原始材料。最终审核目录仅有HTML，截图及导出样本仅为本机测试证据，不作为默认附件。

三次固定条件运行只记录 `program-replay`；不代表模型制作首版、内容策划或用户认可耗时。实际token不可得记unavailable。首版≤10分钟、端到端20–30分钟及同交付口径速度比较仍未验证，当前四页 HTML 已获用户确认；该确认不补足制作速度或其他稿件的验收证据。

## 安装与客户端边界

候选为 `html-first-candidate-20261022-5f3149c`，由提交导出并按自己的lockfile执行离线npm ci，不链接开发树依赖。已从候选入口单独执行doctor、make单HTML、file协议离线保存重开、实际菜单PPTX导出，网络请求与浏览器错误均为零。

用户在本窗口明确同意合并、启用后，Codex全局链接已原子切换至 `html-first-candidate-20261022-5f3149c`，旧 `main-unified-20261021-d4c19a3` 保留。WorkBuddy/Antigravity配置未改。具体路径、源提交指纹、测试回执、当前链接和回退方法写在本机 `output/html-first/installation-receipt.json`。

启用时使用候选安装器 `node <候选>/scripts/install.mjs --replace-link <doctor确认的当前快照>`；回退使用旧快照安装器 `--replace-link <候选>`，均会核对匹配目标并原子切换，不删除快照。本轮已执行启用命令，回退命令未执行。

LibreOffice合成样本已独立转换PDF并实际看图；PowerPoint同一合成导出样本已打开、修改原生文字、保存、重开，包内确认编辑标记。该Office样本来自初候选972dbce，至最终5f3149c导出写包器未改；最终候选已另验浏览器原生导出。此证据不代表所有真实稿、所有Office版本或跨电脑字体已验收。任意HTML导入、远程视频、任意本机字体重新分发仍按规划排除/限定。

## 合并后复验

合并前171/171通过。合并后首次170/171：历史浏览器测试在保存自动刷新尚未结束时再次reload，出现ERR_ABORTED；相关runtime代码本轮未改。测试改为在点击保存前注册导航等待，再继续编辑与重开检查；单独3/3、随后完整171/171通过，产品运行代码未改变。该修正保留了保存、图片替换、重开、原生导出与冲突校验全部断言。

切换后的正式安装入口再次通过doctor、make单HTML、断网编辑、下载修改后的HTML、重开与实际菜单PPTX导出；浏览器网络请求和页面错误为零。安装快照仍为已核对464个文件的5f3149c；后续提交仅涉及测试与维护记录。
