---
name: android-offline-build
description: "Build an Android APK offline without Gradle, using the raw SDK toolchain (aapt2 compile/link, JDK8 javac against android.jar, d8, zipalign, apksigner). Use when the user wants to build/rebuild an Android app APK from source on a machine with no Gradle, when a build.ps1-style script is missing or failing, when apksigner silently fails, or whenever an android/* project needs a signed APK produced and verified locally."
---

# Android 离线构建(android-offline-build)

无 Gradle 环境下用 SDK 原始工具链构建并签名 Android APK:aapt2 编译/链接资源 → JDK8 javac(以 android.jar 为 bootclasspath)→ d8 转 dex → zipalign → apksigner。沉淀自 app1-7 共 7 个项目的实战,含全部踩坑与验证手段。

## 首次使用前的配置

本技能不含绝对路径。用你的值替换文中所有 `<...>` 占位符:

| 占位符 | 含义 | 获取方式 |
|---|---|---|
| `<ANDROID_HOME>` | Android SDK 根目录 | 通常含 build-tools / platforms / platform-tools |
| `<BUILD_TOOLS>` | build-tools 版本目录(如 `36.0.0`) | `ls <ANDROID_HOME>/build-tools/` |
| `<PLATFORM_JAR>` | 平台 android.jar | `<ANDROID_HOME>/platforms/android-XX/android.jar`(targetSdk 对应) |
| `<JAVA8_HOME>` / `<JAVA21_HOME>` | JDK 8 / JDK 21 安装根 | javac 用 8;d8 需要 JDK 11+ |
| `<KEYSTORE>` | 签名密钥库(debug 即可,密码一般 `android`/`android`) | 已有项目可复用;无则 `keytool -genkeypair` 生成 |

环境前置:JDK 8 + JDK 11+(应仅 d8 用)、Android build-tools + platform、Node(验 dex 用可选)。

## 构建流程(7 步)

每一步带**完成判据**;不满足即未完成。

### 1. 资源编译(aapt2 compile)

```
<BUILD_TOOLS>/aapt2 compile --dir <res_dir> -o <out>/res.zip
```
- **判据**:`res.zip` 存在且非空。

### 2. 资源链接 + 生成 R.java(aapt2 link)

```
<BUILD_TOOLS>/aapt2 link -o <out>/<app>.unsigned.apk -I <PLATFORM_JAR> --manifest <manifest> --java <out>/gen <out>/res.zip
```
- **判据**:`*_unsigned.apk` 存在,且 `gen/<pkg>/R.java` 已生成(aapt2 link 成功的直接产物)。

### 3. Java 编译(javac,JDK 8)

```
<JAVA8_HOME>/bin/javac -encoding UTF-8 -source 1.8 -target 1.8 -bootclasspath <PLATFORM_JAR> -d <out>/classes <src/*.java> <gen/R.java>
```
- **判据**:全部源码编译无 error;`classes/<pkg>/*.class` 与匿名内部类 `$N.class` 存在。
- **铁律:源码禁用 lambda/stream/方法引用**(JDK8 + bootclasspath android.jar 缺 LambdaMetafactory,报"找不到符号");监听一律匿名内部类。文件必须 UTF-8(中文注释)。

### 4. 转 dex(d8,JDK 21)

```
$env:JAVA_HOME = <JAVA21_HOME>   # d8 需要 JDK 11+,JDK8 下会失败
<BUILD_TOOLS>/d8.bat --release --lib <PLATFORM_JAR> --min-api 23 --output <out>/dex <classes...>
```
- **判据**:`dex/classes.dex` 生成;`--min-api` 与项目 minSdk 一致。用后恢复原 `JAVA_HOME`。

### 5. 合并 dex

把 `classes.dex` 追加进 unsigned.apk(zip 条目,如 PowerShell `System.IO.Compression.ZipFile` Update 模式 `CreateEntryFromFile`)——若脚本里已有,直接沿用。
- **判据**:unsigned.apk 内含 `classes.dex` 条目(`unzip -l` 或压缩器列表可见)。

### 6. 对齐(zipalign)

```
<BUILD_TOOLS>/zipalign.exe -f -p 4 <out>/<app>.unsigned.apk <out>/<app>.aligned.apk
```
- **判据**:aligned.apk 生成。

### 7. 签名 + 防御(apksigner)

```
<BUILD_TOOLS>/apksigner.bat sign --ks <KEYSTORE> --ks-pass pass:android --key-pass pass:android --out <out>/<app>.apk <out>/<app>.aligned.apk
<BUILD_TOOLS>/apksigner.bat verify <out>/<app>.apk
```
- **判据**:① verify 成功;② **APK 的 mtime 更新到本次构建时间**;③ 若怀疑内容陈旧:`dexdump -d <apk内classes.dex> | grep <新增字符串>` 命中新代码特征串。
- **已知陷阱:apksigner 在完整脚本上下文可能"静默失败"**(退出码 0 但 `--out` 未写文件;手动单行却成功)。防御:sig 前先 `Remove-Item <apk>`,让 `Test-Path` 检查暴露失败;命令一律单行(Windows PowerShell 5.1 反引号续行解析不可靠)。

## 关键环境事实

| 项 | 事实 |
|---|---|
| 构建产物链 | res.zip → unsigned.apk(+R.java)→ classes → classes.dex → aligned.apk → 签名 apk |
| javac | 必须 JDK8 + `-bootclasspath <PLATFORM_JAR>`;JDK 新版需 `--release` 且与 android.jar 兼容性差 |
| d8 | 必须 JDK 11+(推荐 21);临时切 `JAVA_HOME`,用后恢复 |
| lambda | `-source 1.8 -target 1.8` + bootclasspath 下 LambdaMetafactory 缺失 → 匿名内部类 |
| 签名失败 | 静默失败会留下"旧的" apk → 改代码后必须核 mtime/dexdump |
| PowerShell 5.1 | `& script.ps1` 中 `.bat` 返回码可捕获;反引号续行不可靠,写单行 |

细节与深坑(诊断步骤、验证命令、常见错误对照)见 [REFERENCE.md](REFERENCE.md),按需读取。
