# W3 模块与容量处理：候选实现记录

日期：2026-11-05。承接 `0f67eae`，工作分支 `codex/content-page-contracts`。用户已明确授权开始 W3；日常安装与原成稿未改。

## 完成内容

1. 新增 capacity-kit，在既有 table/flow/photoGroup 上复用计算，不替换旧工具。
2. 人物组统一计算图片/占位、姓名、角色、职责，支持缺照片与长名称。
3. 容量表格与排期逐行取最高单元格；表头也参与高度计算；可供预算明细复用。
4. 顺序流程按真实标题高度移动说明；稳定行/步骤 ID 保持内容身份。
5. 统一 estimated/measured 容量结果，明确 fits/needs-reflow/cannot-fit，保留全部文案，不自动缩字号。
6. 复用 createLayoutMeasurer 的字体检查和浏览器测量；失败明确返回错误。
7. rolesWithSchedule 组合入口拒绝区域重叠与重复 ID；容量未解决在新稿视觉检查中阻断。

用法：[模块 API](../../../skills/dawang-ppt/references/capacity-modules.md)。

## 验证结果

- 8 项新增单元测试：长名称、缺照片、超容量保留原文、表格行高、实测重排、测量失败、生成检查拦截、重排行/步骤 ID 稳定。
- 相关回归 60 项通过：上述模块测试、原布局工具、汇报页型、视觉检查、W1/W2 契约、新 HTML 浏览器往返、既有 make/patch/publish 生命周期。
- 实际浏览器合成验证 2 页：人物＋排期、顺序流程。包含两张合成头像、一位缺照片角色、长人物名、长流程标题；逐页看过截图，无可见裁切和说明叠压。
- 正常输入实测 fits；增行且缩小排期区域得到 needs-reflow；极长职责得到 cannot-fit，内容没有删除。
- 序列化后的离线 HTML 重开并重新测量通过；另一套 Arial/绿系主题重新测量通过。另一主题本轮只做模块实测，未宣称完整视觉验收。
- 浏览器验证最初因夹具图片路径相对于服务目录不正确而报 missing-image；修正测试资源路径后成功。未放宽图片缺失检查。
- 开发中修正了稳定 ID 重命名后的测量索引问题，并增加标题高度精确断言，防止误把估算标成实测。

本机日志和工程：`output/w3-verification/`（Git 忽略）。`final-browser/模块容量验证.html` 为可编辑合成技术验证稿；不是业务成稿或视觉模板推荐。

## 验收边界

V07 长文字/增行、V08 主题字体变化后的重新测量、V09 本次合成最终 HTML 重开与测量已覆盖。原龙湖用户截图中的特定漏检原因未复现，本次不宣称已修复其全部 CSS/字体根因。

没有新增预算图表或自动分支/循环布线；预算明细可用容量表格，复杂关系仍保留自由设计。没有验证 W4 的复核缓存和三轮发布策略，也没有进行真实业务全稿用户效果验收。网页/离线 HTML 是本次直接验证产物；Office 人工效果验收未执行。

## 可复现命令

```sh
node --test tests/fusion/capacity-kit.test.mjs tests/fusion/capacity-browser.test.mjs
node --test tests/fusion/layout-kit.test.mjs tests/fusion/report-patterns.test.mjs tests/fusion/visual-decisions.test.mjs tests/fusion/content-page-contracts.test.mjs tests/fusion/semantic-portable.test.mjs tests/fusion/html-first-pipeline.test.mjs
```

下一步为 W4：三类验收、证据失效与发布分级。候选成果未合主分支、未推送、未切换安装。
