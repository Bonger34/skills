# Android 离线构建·参考手册(REFERENCE)

> 由 SKILL.md 指针到达;只在需要细节时读取。全部经验经 7 个 APP(作业1-5 项目)实战验证。

## 诊断与验证命令

| 目的 | 命令 |
|---|---|
| 签名是否真的更新 | `Get-Item <apk>.LastWriteTime` 对比构建时间;异常时 `dexdump` 查字符串 |
| APK 内容字符串(验新代码进包) | 解压 classes.dex 后 `dexdump -d classes.dex \| grep <特征串>`(Windows 用 `Select-String`) |
| 包信息 | `aapt2 dump badging <apk>`(package / application-label / launchable-activity / minSdk) |
| APK 内目录 | 压缩器列出条目,确认 `AndroidManifest.xml`、`classes.dex`、`res/...` 在 |
| APK 安装 | `<ADB> install -r <apk>`;`-r` 保留应用数据(**换数据/清库要先 `pm clear <pkg>`**) |

## 常见错误对照

| 症状 | 原因/处理 |
|---|---|
| `javac: 找不到符号 LambdaMetafactory` | 源码用了 lambda;全部改成匿名内部类后重编 |
| `javac: 编码 GBK 的不可映射字符` | 源文件非 UTF-8;以 UTF-8 保存,`javac -encoding UTF-8` |
| `d8 报 Unsupported class file major version` | d8 跑在 JDK8 上;切 `<JAVA21_HOME>` 后再跑 |
| `aapt2 link: no resource found ... android:` | `-I <PLATFORM_JAR>` 缺失或 platform 版本不对 |
| sign 后 verify 通过但改的代码没生效 | **apksigner 静默失败**;删除旧 apk 重签;手动单行执行 |
| `apksigner.bat` 在 PS5.1 下输出为空/未产出 | 反引号续行被截断;改单行命令 |
| build.ps1 报 `SIGN_EXIT=0 SIGN_EXISTS=True` 但 apk 旧 | 同静默失败;先 `Remove-Item` 旧 apk 再跑,出错会显式抛出 |

## 脚本要点(从模板派生)

- 模板 `scripts/build-template.ps1`:开头的变量(SDK/产物名/包名)替换后即可用;每步检查 `$LASTEXITCODE` 并 throw,失败不会静默继续;sign 前删除旧目标。
- 子代理并行开发多个 APP 时:给每个子代理同一模板 + 明确"匿名内部类、UTF-8、无 Gradle"约束,一次构建成功率很高(作业3 三个 APP 即如此)。
- 签名密钥统一:`<KEYSTORE>`(debug,android/android),多 APP 可共装互不覆盖。

## 数据开关经验

- 安装包体极小(10-100KB 级)说明构建正常;Debug 签名 APK 可直接装模拟器。
- 模拟器重装后应用数据保留;演示前 `pm clear <pkg>` 回到初始状态(配合 `SKILL.md` 的初始化数据逻辑)。
