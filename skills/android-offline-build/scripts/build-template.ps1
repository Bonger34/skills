# 离线 Android APK 构建模板(无 Gradle;替换下方 <...> 配置即可使用)
# 流程:aapt2 compile -> aapt2 link(生成 R.java)-> javac(JDK8)-> d8(JDK21) -> zipalign -> apksigner
$ErrorActionPreference = "Stop"

# ====== 配置(替换为你的值) ======
$SDK      = "<ANDROID_HOME>"            # Android SDK 根目录
$BT       = "$SDK\build-tools\<BUILD_TOOLS>"     # 如 36.0.0
$PLATFORM = "$SDK\platforms\android-XX\android.jar"  # 与 targetSdk 对应
$JAVAC    = "<JAVA8_HOME>\bin\javac.exe"   # JDK 8
$JDK21    = "<JAVA21_HOME>"                # JDK 11+ (d8 用)
$APK      = "app"                           # 产物名(如 app7)
$MANIFEST = "AndroidManifest.xml"
$MINSDK   = 23                              # minSdk
# ====== 项目结构 ======
$PROJ = $PSScriptRoot                     # 脚本所在目录 = 项目根
$RES  = "$PROJ\res"
$SRC  = "$PROJ\src"
$OUT  = "$PROJ\build"
# ====== 签名(debug 密钥) ======
$KS    = "<KEYSTORE>"
$KSPASS = "android"

New-Item -ItemType Directory -Force -Path "$OUT\obj","$OUT\gen","$OUT\classes","$OUT\dex" | Out-Null

# 1) 编译资源
& "$BT\aapt2.exe" compile --dir "$RES" -o "$OUT\res.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

# 2) 链接资源与清单 -> 未签名 APK,同时生成 R.java
& "$BT\aapt2.exe" link -o "$OUT\$APK.unsigned.apk" -I "$PLATFORM" --manifest "$PROJ\$MANIFEST" --java "$OUT\gen" "$OUT\res.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

# 3) javac(JDK 8)编译 Java 源码 + R.java
$srcs = Get-ChildItem "$SRC","$OUT\gen" -Recurse -Filter *.java | ForEach-Object FullName
& $JAVAC -encoding UTF-8 -source 1.8 -target 1.8 -bootclasspath "$PLATFORM" -d "$OUT\classes" $srcs
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

# 4) d8 转 dex(需要 JDK 11+,临时切 JDK21)
$oldJh = $env:JAVA_HOME; $env:JAVA_HOME = $JDK21
try {
    $classes = Get-ChildItem "$OUT\classes" -Recurse -Filter *.class | ForEach-Object FullName
    & "$BT\d8.bat" --release --lib "$PLATFORM" --min-api $MINSDK --output "$OUT\dex" $classes
    if ($LASTEXITCODE -ne 0) { throw "d8 failed" }
} finally { $env:JAVA_HOME = $oldJh }

# 5) 合并 classes.dex 进 APK
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open("$OUT\$APK.unsigned.apk", 'Update')
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$OUT\dex\classes.dex", "classes.dex") | Out-Null
$zip.Dispose()

# 6) zipalign
& "$BT\zipalign.exe" -f -p 4 "$OUT\$APK.unsigned.apk" "$OUT\$APK.aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

# 7) 签名(先删旧目标,暴露 apksigner 静默失败)
if (Test-Path "$OUT\$APK.apk") { Remove-Item "$OUT\$APK.apk" -Force }
& "$BT\apksigner.bat" sign --ks "$KS" --ks-pass pass:$KSPASS --key-pass pass:$KSPASS --out "$OUT\$APK.apk" "$OUT\$APK.aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }
if (-not (Test-Path "$OUT\$APK.apk")) { throw "apksigner output missing" }

& "$BT\apksigner.bat" verify "$OUT\$APK.apk" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "verify failed" }
Write-Output "BUILD OK: $OUT\$APK.apk"
