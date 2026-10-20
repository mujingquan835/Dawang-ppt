# W3：可信 QA 与同 revision 交付

2026-10-20。状态：工程检查、本机 PowerPoint 编辑保存重开通过；两页最终视觉认可待用户确认。分支 codex/kimi-web-editor，起点 041c533。W4/W5 未开始。

## 本轮交付

- QA 和导出共用 readiness 检查：有效且有限的画布尺寸、连续稳定的几何、图片加载、字体加载及导航完成；不再依赖屏幕宽度大于900。零 scale、坏图、未完成加载、缺字体、不支持的信息对象明确失败，不产生假通过或非有限坐标。
- 新制作页显式缺字体会阻断；旧模板保留已有字体回退行为，并报告警告。报告区分声明字体、Chromium 实际使用字体、回退、未嵌入、目标电脑未验证，不将本机可用视为跨电脑可用。
- 富文本收集成一个原生文字框的多个 runs，保留句内颜色、字重、字号等，避免分拆为重复文字碎片。图片 cover/focal 裁切保留，受控矢量继续为原生可编辑路径。
- HTML、截图 PDF、可编辑 PPTX 以同一 ProjectV2 revision 导出，拒绝过期请求；修复连续请求 PPTX 后立刻请求 PDF 会得到409的忙状态释放时机。
- 导出报告包含 revision、fonts、unsupported、rasterized。PPTX 不静默将信息内容整页转图；PDF 明确标为 screenshot-pdf、textSelectable=false，全部页面为截图。
- 清理 PPTX 包内指向不存在部分的 content-type override，保留真实缺失 part/relationship 的失败检查。两页实包当前无此类警告。

## 实测结果

| 检查 | 结果 |
|---|---|
| 新增测试 | 11项，包括 readiness 故障、原生 runs、裁切、包引用、同revision与连续导出 |
| 初次全量串行 | 旧模板因缺 Noto Sans SC 被新严格规则阻断，2项失败；保留原日志 |
| 修复后关联回归 | 17/17；新制作严格字体策略与旧模板回退策略分开，未放宽新制作缺字体断言 |
| 最终全量串行 | `npm test -- --test-concurrency=1`，138/138，0失败，117.2秒 |
| 真实两页 QA | readiness / finiteBounds / ok 均为true；实际截图已检查 |
| 真实可编辑 PPTX | 23文字框、2图片、6形状（含矢量）、5线条；ZIP CRC、OPC部件、关系引用全部通过，无警告 |
| 真实 PDF | 2页，960×540pt；已逐页渲染检查，截图模式 |
| 完整 HTML 源目录 | ProjectV2、index.html、assets 一并交付；阻断远程请求时仍可渲染，外部请求为0 |
| PowerPoint 本机 | 正常打开两页，无修复提示；独立副本改标题、保存、关闭重开，界面与包内XML都确认修改保留 |

本轮真实交付的 revision 为 `f8ae46e3-e866-4bfd-9f59-cf04c45027ae`。字体证据24条；这不是24种字体，不代表已嵌入。Office 修改仅用于验收副本，交付原稿未改标题。

本地证据位于忽略目录 `output/kimi-web/w3/`：red.log、consecutive-red.log、consecutive-green.log、legacy-font-red.log、full-serial.log、related.log、final-full.log、real-delivery.log、qa-report.json、delivery-report.json、office-report.json、screenshots/、pdf-1.png、pdf-2.png、office-stable-edited.png、office-stable-reopened.png。`delivery/` 包含三种交付、使用说明、规则清单、QA/Office报告及SHA256清单。

验收中曾再次生成交付包，覆盖了仍打开的旧测试副本，导致其后续保存失败；已修正本地验收脚本为不覆盖现有Office副本，并使用单独的 `Office稳定验收.pptx` 重做完整流程，保存后XML和重新打开均通过。此过程与失败证据保留，不把旧副本当最终证明。

## 边界与下一阶段

W3 工程检查点完成；首个可行性门槛仍待用户对两页效果认可。功能截图的小字保持原有取景，在整页中仍偏小，几何通过不等于用户认可。

PPTX 字体未嵌入，其他电脑字体效果未验证。PDF文字不可选择；HTML是完整本地源目录，服务端保存/导出仍需本地预览服务。业务截图内部控件是图片内容，不宣称可编辑。

剩余两阶段：W4 扩展旅行导演整稿、第二真实场景、旧新路径对照及实际时间/token记录；W5 在验收后切换日常入口与核对全局安装、保留回退方式。本轮没有推送、合main、正式发布、切换全局安装或日常入口。到 W3 暂停。
