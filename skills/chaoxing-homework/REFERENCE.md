# 学习通作业·参考手册(REFERENCE)

> 由 SKILL.md 指针到达;只在需要细节时读取。全部经验经多轮实战验证。
> 本文不含绝对路径:所有路径统一用占位符,含义见下表。

| 占位符 | 含义 |
|---|---|
| `<RAR_EXE>` | WinRAR 命令行(Windows 默认 `C:\Program Files\WinRAR\Rar.exe`;macOS/Linux 见官网 rarlab.com 的对应版本) |
| `<ANDROID_HOME>` | Android SDK 根目录(含 `emulator`、`build-tools`、`platforms`) |
| `<AVD_NAME>` | 模拟器 AVD 名称(如 `Pixel_6`);`<AVD_CONFIG>` = 该 AVD 的 `config.ini` |
| `<ADB>` | adb 可执行文件路径(通常 `<ANDROID_HOME>/platform-tools/adb`) |
| `<JAVA8_HOME>` / `<JAVA21_HOME>` | JDK 8 / JDK 21 安装目录(离线构建 + d8 需要) |
| `<APP_TEMPLATE>` | 可复制的离线构建工程模板(见"Android 离线构建"节) |
| `<KEYSTORE>` | 签名用 debug.keystore(密码一般 `android`/`android`) |

## 网页操作细节

### CDP 基础(所有脚本依赖)

- 入口:`agent-browser --session <SESSION_NAME> get cdp-url`(地址每次会话可能变,**现取现用,不要写死**)。
- Node ≥22 内置 `WebSocket`(无需 npm 依赖);PowerShell 里 `node script.mjs <arg>` 传参注意 `process.argv[2]` 才是第一个参数。
- attach:`Target.attachToTarget {targetId, flatten:true}` → 之后页面级消息(call 带 `sessionId`)要先 `Runtime.enable` + `DOM.enable`。
- iframe 内元素:同一 origin(chaoxing 学习通域)可 `f.contentDocument` 遍历;跨域就换 target 级会话。
- 拿可点击元素中心:`getBoundingClientRect()` 现算,别用截图目测。

### 编辑器与附件(关键坑)

- UEditor 按钮对 `element.click()` 无响应 → 用 `Input.dispatchMouseEvent`(mouseMoved → mousePressed → mouseReleased,button:'left',clickCount:1)。
- 附件按钮选择器 `.edui-for-attachment_new`(旧名 `.edui-for-attachment` 已不存在)。
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
- 网络提示:`web_fetch` 工具报"non-public IP"是其解析限制,`Invoke-WebRequest`/curl 命令行不受影响(下载 rar 安装器/ADBKeyboard 等均实测可行);包管理器的源偶发锁/网络问题,可改用直接下载安装包静默安装。
- 敏感信息:演示数据(姓名/学号/身份证)按用户提供录入;登录凭证绝不入文档,学生信息避免扩散到公共文档。

## 模拟器与录制(Android 录屏演示)

- 启动(后台 job,输出重定向):`& <ANDROID_HOME>/emulator/emulator.exe -avd <AVD_NAME> -no-snapshot -no-audio -no-boot-anim -gpu swiftshader_indirect -no-window > emulator.log 2>&1`;就绪判据:`getprop sys.boot_completed`=1。
- 环境:禁用 TTS(可选)、三项动画归 0。
- **中文输入方案**(Android 模拟器做中文演示的唯一可靠路径):
  1. AVD 配置 `<AVD_CONFIG>` 里 `hw.keyboard=no`(改后**重启模拟器**;`show_ime_with_hard_keyboard=1` 无效,这是软键盘不显示的根因);
  2. 安装 ADBKeyboard(开源,github 搜索 `ADBKeyBoard`,APK 在仓库根目录),`adb shell ime enable com.android.adbkeyboard/.AdbIME` + `ime set ...`;
  3. 点中 EditText 后 `adb shell am broadcast -a ADB_INPUT_TEXT --es msg "中文"`(键盘显不显示都能提交文本;`adb input text` 中文抛 NullPointerException,勿用)。
  - 收键盘用 `keyevent 111`(ESC);`keyevent 4`(BACK)在键盘未显示时会退出 App。
  - app 侧建议 `windowSoftInputMode="stateAlwaysHidden|adjustNothing"`,保证点击坐标稳定。
- **SystemUI ANR 弹窗**(冷启动常见):屏幕时间冻结、截图 sha256 不变。处理:`uiautomator dump` 定位"等待"(实测中心 (540,1367),各设备以 dump 为准)点击;顽固时 `am force-stop com.android.systemui` 或重启模拟器。ANR 会吞掉 input,必须清除后再操作。
- 坐标:一律 `uiautomator dump /sdcard/ui.xml` + pull 解析 bounds 中心;截图仅作人工核对,不要从截图目测坐标(会有几十~上百像素偏差)。**不要**用 `adb exec-out screencap > file`(PowerShell 重定向损坏 PNG),用 `screencap -p /sdcard/x.png` + pull。
- screenrecord:`--time-limit` **必须大于操作序列总耗时**(每条 adb 命令自身有延迟,实测 20 条命令序列 ≈90s;时间不足的表现为视频在操作完成前截止、"结尾不完整")。录后必须验证时长/尾帧(vidframe 逐帧页或 `video.duration` 检查),被截断就重录并加大 time-limit。首次操作放 real t≥6s(自动增益窗口)。
- 帧验证:vidframe*.html(file:// 打开;改 `times` 数组;canvas 逐帧截图;单页截图 >8192px 会读不了,滚动分屏)。

## Android 离线构建(app* 模板)

- 无 Gradle 全链路(模板见 `<APP_TEMPLATE>`,即 `build.ps1`):
  `aapt2 compile` → `aapt2 link`(生成 R.java)→ JDK8 `javac -source 1.8 -target 1.8 -bootclasspath <ANDROID_HOME>/platforms/android-XX/android.jar` → `d8`(临时 `JAVA_HOME=<JAVA21_HOME>`)→ `zipalign` → `apksigner sign --ks <KEYSTORE> --ks-pass pass:android --key-pass pass:android`。
- **严禁 lambda/stream**(JDK8 + bootclasspath android.jar 缺 LambdaMetafactory);监听一律匿名内部类。源码 UTF-8 带中文注释。
- Windows PowerShell 5.1 跑构建脚本:避免反引号续行(直接单行命令)。
- **apksigner 静默失败陷阱**:完整脚本跑 sign 可能退出码 0 但未写 `--out` 目标文件(手动单行却成功)。改代码后必须核 APK mtime/以 `dexdump` 查新字符串;构建脚本里 sign 前先 `Remove-Item <apk>`,让存在性检查暴露失败,再手动重跑签名。
- 并行开发:多 APP 可由子代理按 `<APP_TEMPLATE>` 规格开发(一次通过率高);微调(控件尺寸/Toast 时长)自己改完重构建。

## 故障症状速查

| 症状 | 处置 |
|---|---|
| `tab list` 永远 `about:blank`、命令出现"launched browser" | 漏了 `--session <SESSION_NAME>`(连到空 default 实例);补上会话参数 |
| `find-reediter` 输出空 / 顶层搜不到"修改答案" | 作业详情在 iframe 内;确认已在课程页点开目标作业,再跑递归脚本 |
| `no attachment btn`(rect null) | 编辑器未渲染完成(多 tab 残留会匹配到别的作业页);等 2s 重试;确认第三参 workAnswerId 正确 |
| 注入后 `hasCloud:false` | 面板未打开/输入未进编辑器;重试流程;确认 setContent 在注入**之前**执行 |
| 点"提交"无弹窗 | 页面按钮点击后需 2-3s 出弹窗;弹窗按钮是 `a.jb_btn`(文本"提交"),不是页面底部 `a.btnSubmit.workBtnIndex` |
| URL 无 `submit=true` | 提交未确认;重新点弹窗"提交"直至 URL 变化;以 URL 为准,别只看页面 |
| 演示视频结尾被截断 | `--time-limit` 小于序列总耗时;量测:改 times 数组看尾帧,或 `video.duration` 核对;加大 time-limit 重录 |
| 中文 `input text` 抛 NullPointerException | `input text` 不支持非 ASCII;改 ADBKeyboard 广播(`ADB_INPUT_TEXT --es msg`) |
| 软键盘不显示 / ADBKeyboard 广播无效 | `<AVD_CONFIG>` 的 `hw.keyboard` 仍是 `yes`;改为 `no` 并重启模拟器 |
| 屏幕时间冻结、截图 sha256 不变 | SystemUI ANR;dump 定位"等待"点击,顽固则 `am force-stop com.android.systemui` 或重启 |
| 改代码后 APK 行为未变化 | 构建脚本 apksigner 静默失败;核 mtime/dexdump,sign 前先删目标 apk 重签 |

## 快速定位要点(给后续会话)

- 课程作业入口:课程页右侧目录 → 目标章节(如"作业"-labeled 节点);作业详情右侧状态(待完成/待批阅)判断是否需要提交。
- 编辑页所有坐标会随页面版本变化,**一律重新 `uiautomator dump`**,上文的坐标值仅作量级参考。
