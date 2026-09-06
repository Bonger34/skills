# 学习通作业·参考手册(REFERENCE)

> 由 SKILL.md 指针到达;只在需要细节时读取。全部经验经多轮实战验证。
> 本文与本技能强相关,不含 Android 模拟器/构建细节——那些属其他技能,见文末"相关技能"。

| 占位符 | 含义 |
|---|---|
| `<RAR_EXE>` | WinRAR 命令行(Windows 默认安装位置 `C:\Program Files\WinRAR\Rar.exe`,供应商固定路径,可用 `where rar` 定位;macOS/Linux 见官网 rarlab.com 对应版本) |

## 网页操作细节

### CDP 基础(所有脚本依赖)

- 入口:`agent-browser --session <SESSION_NAME> get cdp-url`(地址每次会话可能变,**现取现用,不要写死**)。
- Node ≥22 内置 `WebSocket`(无需 npm 依赖);PowerShell 里 `node script.mjs <arg>` 传参注意 `process.argv[2]` 才是第一个参数。
- attach:`Target.attachToTarget {targetId, flatten:true}` → 之后页面级消息(call 带 `sessionId`)要先 `Runtime.enable` + `DOM.enable`。
- iframe 内元素:同一 origin(chaoxing 学习通域)可 `f.contentDocument` 遍历;跨域就换 target 级会话。
- 拿可点击元素中心:`getBoundingClientRect()` 现算,别用截图目测。

### 编辑器与附件(关键坑)

- UEditor 按钮对 `element.click()` 无响应 → 用 `Input.dispatchMouseEvent`(mouseMoved → mousePressed → mouseReleased,button:'left',clickCount:1)。
- 附件按钮选择器 `.edui-for-attachment_new`(旧名 `.edui-for-attachment` 已不存在);该按钮位于**顶层文档**(UEditor 工具栏不嵌套 iframe),CDP 顶层查询即可(见 scripts/cdp-upload.mjs 注释)。
- file input 是 `.webuploader-element-invisible`,可能在附件面板 iframe 里 → 递归 `walk(doc)` 找。
- `DOM.setFileInputFiles` 需要 **objectId**:`Runtime.evaluate` 表达式必须返回**元素节点本身**(returnByValue:false 才有 objectId;返回字符串会报 no objectId)。
- 内容注入顺序:setContent(文字) → 再注入附件;附件插在光标处。
- 上传成功标志:getContent() 含 `editor-iframe`/`insertCloud`,iframe 属性带 `filename=...zip`;否则轮询到超时需重试。

### 提交与验证

- 页面底部两个按钮:"暂时保存" 与 "提交"(`a.btnSubmit.workBtnIndex`);点"提交"后弹"确认提交?"。
- 弹窗按钮 `a.jb_btn`(文本"提交");用 filter text==='提交' 点它。
- 成功特征:URL 追加 `submit=true`;状态"待批阅";答案区显示附件卡。
- 已提交作业要重做:重新打开 doHomeWorkNew URL + `reediter()`,setContent 会覆盖旧内容。
- 多作业 tab 残留时,注入脚本用第三参 workAnswerId 精确对靶。

## zip / rar 打包

- **rar**:**7-Zip 只能解压不能创建 rar**(专有格式);需要 WinRAR。用法:
  `Push-Location <stage目录>; <RAR_EXE> a -r -ep1 -idq <out.rar> "文件/目录"`;中文文件名内部以 UTF-8 存储(`rar l` 控制台显示乱码只是显示问题,解压验证正常)。
- **zip**:PowerShell `System.IO.Compression.ZipFile` 逐文件 CreateEntryFromFile;或任意标准压缩工具。
- 网络提示:`web_fetch` 工具报"non-public IP"是其解析限制,`Invoke-WebRequest`/curl 命令行不受影响(下载 rar 安装器等实测可行);包管理器的源偶发锁/网络问题,可改用直接下载安装包静默安装。
- 敏感信息:演示数据(姓名/学号/身份证)按用户提供录入;登录凭证绝不入文档,学生信息避免扩散到公共文档。

## 故障症状速查

| 症状 | 处置 |
|---|---|
| `tab list` 永远 `about:blank`、命令出现"launched browser" | 漏了 `--session <SESSION_NAME>`(连到空 default 实例);补上会话参数 |
| `find-reediter` 输出空 / 顶层搜不到"修改答案" | 作业详情在 iframe 内;确认已在课程页点开目标作业,再跑递归脚本 |
| `no attachment btn`(rect null) | 编辑器未渲染完成(多 tab 残留会匹配到别的作业页);等 2s 重试;确认第三参 workAnswerId 正确 |
| 注入后 `hasCloud:false` | 面板未打开/输入未进编辑器;重试流程;确认 setContent 在注入**之前**执行 |
| 点"提交"无弹窗 | 页面按钮点击后需 2-3s 出弹窗;弹窗按钮是 `a.jb_btn`(文本"提交"),不是页面底部 `a.btnSubmit.workBtnIndex` |
| URL 无 `submit=true` | 提交未确认;重新点弹窗"提交"直至 URL 变化;以 URL 为准,别只看页面 |
| 上传脚本报 `NO_UE` | 未命中目标编辑器(选了别的 tab/编辑器未初始化);用第三参 workAnswerId 重新对靶 |

## 快速定位要点(给后续会话)

- 课程作业入口:课程页右侧目录 → 目标章节(如"作业"-labeled 节点);作业详情右侧状态(待完成/待批阅)判断是否需要提交。
- 编辑页所有坐标会随页面版本变化,**一律重新用脚本现算**,文中坐标值仅作量级参考。

## 相关技能

- 模拟器演示录制(ANR 处置、中文输入、screenrecord、逐帧验证):见 **android-demo-recording** 技能(需一并复制)。
- Android 离线构建(无 Gradle 全链路、apksigner 静默失败):见 **android-offline-build** 技能(需一并复制)。
