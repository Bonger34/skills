---
name: android-demo-recording
description: "Record a clean demo video of an Android app on an emulator for course assignments or demos: boot and configure the emulator (no software keyboard / Chinese text input via ADBKeyboard), collect tap coordinates with uiautomator, drive the app through a scripted sequence while screenrecord runs, then verify the result frame-by-frame. Use when the user wants a demo video, 演示视频, screen recording of an Android app, emulator recording, or troubleshooting blank/broken recordings (SystemUI ANR eating input, keyboard shifting taps, video cut off before the ending)."
---

# Android 演示录制(android-demo-recording)

在模拟器上录制"干净、完整、可验证"的 Android 应用演示视频:启动与配置模拟器 → 中文文本注入 → 坐标采集 → 设计录制序列 → screenrecord 录制 → 逐帧验证。沉淀自作业3/4/5 系列多轮录制实战的全部坑(ANR 吞点击、软键盘位移、screenrecord 提前截止等)。

## 首次使用前的配置

| 占位符 | 含义 |
|---|---|
| `<ANDROID_HOME>` | Android SDK 根目录(含 emulator/platform-tools) |
| `<AVD_NAME>` / `<AVD_CONFIG>` | 模拟器 AVD 名及其 `config.ini` 路径 |
| `<ADB>` | adb 可执行(通常 `<ANDROID_HOME>/platform-tools/adb`) |
| `<ADBKEYBOARD_APK>` | ADBKeyboard APK 路径(开源,github 搜索 ADBKeyBoard,根目录有编译好的 apk) |
| `<APP_PKG>` | 被测应用包名(如 `com.example.demoapp`) |

环境前置:Android SDK + 至少一个 AVD(建议 1080x2400)、adb、ADBKeyboard APK、浏览器(帧验证页,可选)。

## 录制流程(7 阶段)

每阶段带**完成判据**;不满足即回退。

### 1. 启动模拟器

```
<ANDROID_HOME>/emulator/emulator.exe -avd <AVD_NAME> -no-snapshot -no-audio -no-boot-anim -gpu swiftshader_indirect -no-window
```
后台运行、输出重定向到日志(**不要接管道**);等待 `getprop sys.boot_completed`=`1`。
- **判据**:`<ADB> devices` 显示 `device`(非 offline)+ boot_completed=1。

### 2. 系统稳定与环境配置

```
<ADB> shell settings put global window_animation_scale 0      # 三项动画归 0
<ADB> shell settings put global transition_animation_scale 0
<ADB> shell settings put global animator_duration_scale 0
```
- 冷启动常出现 **SystemUI ANR 弹窗**:症状=状态栏时间冻结、截图不变。处理:`uiautomator dump` 找"等待"按钮(每次以 dump 为准;实测常见中心约 (540,1367))点掉;顽固则 `am force-stop com.android.systemui` 或重启模拟器。
- **判据**:`adb shell "dumpsys window | grep mCurrentFocus"`(或 Windows 主机上 `dumpsys window` 全量后用 `Select-String` 过滤)焦点在被测应用/桌面,**不是** "Application Not Responding"。

### 3. 中文输入配置(仅演示需要中文时)

- 步骤:**① 改 AVD 配置 `<AVD_CONFIG>` 的 `hw.keyboard=no` 并重启模拟器**(软键盘不显示的根因;`show_ime_with_hard_keyboard=1` 无效);
  ② 安装 `<ADBKEYBOARD_APK>`;③ `ime enable com.android.adbkeyboard/.AdbIME` + `ime set ...`;
  ④ 点击 EditText 后 `am broadcast -a ADB_INPUT_TEXT --es msg "中文"`(键盘显不显示都能提交;`adb input text` 不支持非 ASCII)。
- 应用侧建议 `windowSoftInputMode="stateAlwaysHidden|adjustNothing"`(窗口不随键盘位移,点击坐标稳定)。
- **判据**:聚焦 EditText → 广播中文 → `uiautomator dump` 中该字段出现中文字符。

### 4. 采集坐标

```
<ADB> shell uiautomator dump /sdcard/ui.xml
<ADB> pull /sdcard/ui.xml <local>
```
解析各 `text`/`class` 节点 bounds 中心为点击坐标。**不要从截图目测**(偏差可达 130px);截图仅人工核对。
- **判据**:所有要点击的控件都有 dump 坐标;含焦点/状态区分(`clickable/enabled` 属性可参考)。

### 5. 设计序列

- 首个操作放 real t≥6s(录屏自动增益窗口,开头几秒画面/操作会丢)。
- `screenrecord --time-limit` **必须大于操作序列总耗时**(每条 adb 命令自身有延迟,实测 20 条命令 ≈90s;不足则视频在操作完成前截止、"结尾不完整")。
- 重要状态(Toast LENGTH_LONG、结果面板)在序列里给足展示时间,结尾步骤后留 ≥5s 空镜。
- **判据**:序列脚本完整(每个输入动作都有坐标/文本与间隔)且 `time-limit ≥ (sleep 总和 + 命令数 × 0.7s + 结尾停留 10s) × 1.2`(公式见 REFERENCE)。

### 6. 录制与驱动

```
<ADB> shell screenrecord --bit-rate 2500000 --time-limit <N> /sdcard/demo.mp4   (后台)
# ……按序列执行 input tap / input text / am broadcast / input swipe(长按=同点 600ms)……
<ADB> pull /sdcard/demo.mp4 <local>
```
- **判据**:拉回后立刻看时长(见第 7 阶段);时长不足预期或疑被截断 → 加大 time-limit 重录。

### 7. 时长校验与逐帧验证

- 时长:`scripts/durcheck.html`(file:// 打开,`document.getElementById('info').textContent` 显示 `DUR=...`);吻合则继续。
- 帧验证:`scripts/vidframe.html`(改 `times` 数组;canvas 逐帧渲染;单页截图 >8192px 会读不了,分屏滚动)。核查:开头/首操作前画面、每个关键状态、**结尾画面**(重点!结尾停留的画面必须在视频时间范围内)。
- **判据**:开头与结尾画面均正确、关键交互帧齐全;任何缺帧/截断 → 回到第 5-6 阶段重录。

## 关键环境事实

| 项 | 事实 |
|---|---|
| 截图 | `adb shell screencap -p /sdcard/x.png` + pull;**不要** `adb exec-out screencap > file`(PowerShell 重定向会损坏 PNG) |
| 收键盘 | `keyevent 111`(ESC);`keyevent 4`(BACK)在键盘未显示时会退出 App |
| 长按 | `input swipe x y x y 600` |
| 中文输入 | `input text` 抛 `NullPointerException`(不支持非 ASCII)→ 一律 ADBKeyboard 广播 |
| ANR | SystemUI ANR 会吞 input;dump 定位"等待"清除后再操作 |
| 视频偏移 | 视频 t0 比真实时间晚 1-2s(自动增益);首个操作放 t≥6s 避免丢失 |

细节(进阶排查、序列数学、vidframe 定制)与既有实操坐标参考见 [REFERENCE.md](REFERENCE.md),按需读取。
