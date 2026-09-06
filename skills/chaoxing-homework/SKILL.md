---
name: chaoxing-homework
description: "Submit or revise a homework assignment on Chaoxing (超星学习通, chaoxing.com): enter the work editor (doHomeWorkNew / reediter), write the answer text, upload a zip/rar attachment, submit, and verify (submit=true, status 待批阅). Use when the user mentions 学习通/Chaoxing homework, 作业提交/修改答案, doHomeWorkNew, uploading an assignment attachment, or asks to submit or re-deliver a course assignment artifact. Prefer it over generic web-automation when the target is a Chaoxing work page with the UEditor attachment flow."
---

# 学习通作业提交(chaoxing-homework)

超星学习通作业提交的端到端流程:作业答案 = 文字 + 附件压缩包(zip 或 rar,按题目要求),写入 UEditor 后提交,以 `submit=true` + 状态"待批阅"为完成标记。

## 首次使用前的配置

本技能不含任何绝对路径。运行前先确定以下值(用你的环境替换文中所有 `<...>` 占位符):

| 占位符 | 含义 | 获取方式 |
|---|---|---|
| `<SESSION_NAME>` | agent-browser 会话名(示例 `my-session`) | 任意,建议固定一个长度适中且与任务无关的名字 |
| `<SESSION_DIR>` | 会话 socket 目录 | 你为 agent-browser 配置的目录;每次新 shell 需 `$env:AGENT_BROWSER_SOCKET_DIR=<SESSION_DIR>` |
| `<PROFILE_DIR>` | 浏览器登录 profile | 你为 agent-browser 配置的用户数据目录(含学习通登录态) |
| `<COURSE_ID>` / `<CLASS_ID>` | 学习通课程/班级 ID | 课程页 URL 参数 courseId / clazzid |
| `<CDP_URL>` | 浏览器 CDP 地址 | `agent-browser get cdp-url`,**每次现取,勿写死** |
| `<URL>` | 编辑页完整 URL | 第 1 步脚本输出后取出;运行时值,非配置 |

环境前置:agent-browser(≥0.36)、Node ≥22(内置 WebSocket,脚本零依赖)。

## 快速开始(6 步)

每一步都带**完成判据**:不满足即未完成,回到上一步。

### 1. 定位作业编辑页 URL

- 前置:会话存活、登录态有效;**所有命令带 `--session <SESSION_NAME>`**,否则会连到空 default 实例。
- 课程页(`studentstudy` URL,chapterId 指向目标章节点)右侧目录点作业,或用 `getTeacherAjax('<COURSE_ID>','<CLASS_ID>','<chapterId>')` 切章节——载体为课程页 tab 的 `eval`(如 `agent-browser --session <SESSION_NAME> eval "getTeacherAjax('<COURSE_ID>','<CLASS_ID>','<chapterId>'); 'ok'"`);chapterId 从目录节点的 `id="cur<xx>"` 或点击后的 URL 提取。
- 作业详情在 iframe 里,顶层 DOM 搜不到"修改答案"链接 → 运行 `node scripts/find-reediter.mjs <CDP_URL> [<COURSE_ID>]`(递归 iframe 树,自动 attach+enable+walk;多课程页时传 courseId 精确选页),输出该链接的完整 URL 与 `onclick="reediter()"`。编辑页 URL 在输出的 **`href` 或 `parentHTML` 字段**(`doHomeWorkNew?workAnswerId=...&workId=...&enc=...`)。
- **判据**:取到含 `doHomeWorkNew?courseId=...&workAnswerId=...&workId=...` 的完整 URL,且 workId/workAnswerId 与题目页一致。

### 2. 打开编辑页并激活编辑器

- `agent-browser --session <SESSION_NAME> tab new "<URL>"` → 以 `tab list` 输出的稳定 id 切换,如 `agent-browser --session <SESSION_NAME> tab t3`。
- 新开页面默认是"查看"视图,但已定义 `reediter` → `eval "reediter(); 'called'"` 切编辑态。
- **判据**:`eval "typeof UE !== 'undefined' && !!UE.instants.ueditorInstant0"` 输出布尔 `true`(注意是**对象键** `UE.instants.ueditorInstant0`,不是数组索引)。

### 3. 写入文字答案

- `eval "UE.instants.ueditorInstant0.setContent('<p>...</p>'); 'ok'"`(PowerShell 用 `ConvertTo-Json` 转义中文)。
- **判据**:getContent() 长度>0 且包含答案关键词。
- **顺序铁律:先 setContent 纯文字,再注入附件**(附件插光标处,顺序反了文字会被附件顶掉)。

### 4. 注入附件压缩包

- 运行 `node scripts/cdp-upload.mjs <CDP_URL> <zip或rar路径> [workAnswerId]`:
  - 脚本内部用 CDP 真实鼠标(mouseMoved→Pressed→Released)点 UEditor 附件按钮 `.edui-for-attachment_new`(element.click 无效)。
  - 面板打开后递归找隐藏 `input[type=file].webuploader-element-invisible`(可能在 iframe 内)→ 表达式**返回元素节点本身**(returnByValue:false)拿 objectId → `DOM.setFileInputFiles`。
  - 第三参 workAnswerId 用于多作业 tab 残留时区分目标(必须与第 1 步 URL 中的 workAnswerId 一致,否则会注入到旧作业!)。
- **判据**:脚本输出 `"hasCloud":true`(编辑器内容含 `editor-iframe`/`insertCloud`),且 getContent 里文字仍在。

### 5. 提交

- 页面底部有"暂时保存"与"提交"两个按钮,选择方式以**文本过滤**优先(避免同类名歧义):`eval "[...document.querySelectorAll('a.btnSubmit, a.workBtnIndex')].find(e=>e.textContent.trim()==='提交').click()"` → 等 3s → 弹窗"确认提交?"出现 → `eval "[...document.querySelectorAll('a.jb_btn')].find(e=>e.textContent.trim()==='提交').click()"`(弹窗按钮是 `a.jb_btn`,不是页面底部那个)。
- **判据**:页面 URL 含 `submit=true`。

### 6. 验证并存档

- 页面文本含"待批阅"、附件卡(文件名+大小)与文字答案可见。
- 截图留档(如 `hwN_submitted.png`)。
- **判据:状态"待批阅" + URL submit=true + 附件卡大小与本地文件一致**,三者齐备才算完成。

## 关键环境事实

| 项 | 事实 |
|---|---|
| 会话参数 | 每条命令带 `--session <SESSION_NAME>`;缺省会连到空 default 实例(tab 永远 about:blank) |
| 登录失效 | 杀净 agent-browser/chrome 进程+清 `<SESSION_DIR>` → `--headed --session <SESSION_NAME>` 重启 → 用户扫码(APP 内需点"确认");登录态在 `<PROFILE_DIR>` |
| 编辑器 | `UE.instants.ueditorInstant0`(对象键) |
| 附件按钮 | `.edui-for-attachment_new`,必须 CDP 真实鼠标 |
| 提交按钮 | 页面文本"提交"(`a.btnSubmit`/`a.workBtnIndex` 中文本过滤)→ 弹窗 `a.jb_btn`(文本"提交") |
| 成功标志 | URL `submit=true`;状态"待批阅" |
| 多 tab 残留 | cdp-upload.mjs 第三参数传 workAnswerId |

网页操作细节(CDP 协议要点、编辑器/附件、打包)与故障速查见 [REFERENCE.md](REFERENCE.md);模拟器录制与 Android 离线构建的深坑见 [../android-demo-recording](../android-demo-recording) / [../android-offline-build](../android-offline-build) 技能(需要时另复制技能夹)。
