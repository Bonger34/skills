# Android 演示录制·参考手册(REFERENCE)

> 由 SKILL.md 指针到达;只在需要细节时读取。全部经验经作业3/4/5 共多轮录制实战验证。

## 中文输入(ADBKeyboard)完整链路

1. **根因**:模拟器 AVD 默认 `hw.keyboard=yes` → 系统认为有实体键盘 → 软键盘永不显示 → ADBKeyboard 的广播接收器注册在 `onCreateInputView`(键盘首次显示时),永远不注册 → 广播无效。
2. 修复:改 `<AVD_CONFIG>` 的 `hw.keyboard=no`,**重启模拟器**。`settings put secure show_ime_with_hard_keyboard 1` 实测无效。
3. 使用:定位 `ime set com.android.adbkeyboard/.AdbIME`,点击 EditText(聚焦),`am broadcast -a ADB_INPUT_TEXT --es msg "中文"`(已在焦点字段提交;无需键盘显示)。
4. 备选:`ADB_INPUT_B64 --es msg <base64>`(README 建议的新格式;实测普通广播已够)。
5. 换字段:先 `keyevent 111`(ESC 收键盘)——**别用 BACK(4)**:键盘未显示时 BACK 会退出 App。
6. 清空字段:`am broadcast -a ADB_CLEAR_TEXT`(清除聚焦字段)。

## SystemUI ANR 处置

- 症状:状态栏时间冻结、连续截图 sha256 相同、`mCurrentFocus=... Not Responding: com.android.systemui`。
- 处理:① `uiautomator dump` 找"等待"按钮 bounds 点掉;② 反复出现则 `am force-stop com.android.systemui`;③ 仍顽固就重启模拟器。**ANR 期间 input 会被吞**,必须清除后再开始录制。
- 触发时机:冷启动后 1-2 分钟内最常见;热机后续录基本不出现。

## 坐标采集细节

- `uiautomator dump` 的坐标以屏幕左上为原点;classes:`EditText`/`Spinner`/`Button` 等无 text 的控件按 class 过滤抓 bounds。
- 解析(PowerShell):`[regex]::Matches($xml,'<node[^>]*...bounds="([^"]*)"')` → 取 `[x1,y1][x2,y2]` 中心。
- 对话框(AlertDialog)控件的坐标随内容变化,**每次打开后重新 dump**。
- 列表动态项(如添加后新增行):按行距推算(如 168px/行),或先跑一遍实测。

## screenrecord 序列数学

- 每条 `adb shell` 命令延迟 0.2-1s;`input tap`/`input text`/广播/`keyevent` 都算。**用 `time-limit = 序列 sleep 总和 + 命令数 × 0.7s + 结尾停留 10s` 估算**,再留 20% 余量。
- 时间轴偏移:video ≈ real - 1~2s(自动增益丢弃开头);首操作 real t≥6s,Toast 用 LENGTH_LONG(约 3.5s)确保录到。
- 验证工具:`scripts/durcheck.html`(duration)、`scripts/vidframe.html`(times 数组)。
- 常见失败:序列 95s 但 time-limit 85s → 视频结尾停在对话框,看起来"结尾不完整";对策是加大 time-limit 重录,并在录后立即帧验证结尾。

## vidframe/durcheck 用法

- vidframe.html:改 `const times = [...]`(秒,可小数)`<video src="demo_X.mp4">`;file:// 打开;canvas 270x600 逐帧;页面截图检查(超 8192px 会读不了 → 滚动分屏)。
- durcheck.html:仅显示 `DUR=秒数`,验证录制时长是否符合预期。

## 关键坑对照

| 症状 | 处置 |
|---|---|
| 视频开头几秒黑屏/丢首操作 | 自动增益窗口;首操作放 t≥6s |
| 输入中文没进框 | `hw.keyboard=no` 未生效/未重启;IME 未 set;字段未聚焦 |
| 点击坐标全偏/行为错乱 | 软键盘弹出位移了窗口;app 加 `adjustNothing`,或每字段输入后 ESC 收键盘 |
| 屏幕时间冻结、截图不变 | SystemUI ANR;点"等待"或 force-stop SystemUI |
| 视频比预期短、结尾停在对话框 | time-limit 小于序列耗时;加大重录 |
| `exec-out screencap > file` 出来是坏图 | PowerShell 重定向;改用设备内截图+pull |
| 文字录入到错误控件 | 字段间用 dump 焦点确认;输入后核对 dump 文本 |
| screenrecord 立即退出/视频极短 | `/sdcard` 存储不足:`df /sdcard` 检查,清理或改录到 `/data/local/tmp` |
| `uiautomator dump` 报 `UiAutomation not connected` | 刚发生过 ANR/系统不稳;等 10s 重试或重启 adb → 复用 ANR 处置 |
