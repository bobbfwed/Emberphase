[CmdletBinding()]
# -Fake builds a debug APK with sample weather, notifications and system pod
# providers (for emulators); the committed watchface.xml is restored afterwards.
# -Diag adds an on-screen sensor and carrier readout to a -Fake build.
param([switch]$Install, [string]$Serial, [switch]$Fake, [switch]$Diag)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sdkRoot = $env:ANDROID_HOME
if (-not $sdkRoot) { $sdkRoot = [Environment]::GetEnvironmentVariable('ANDROID_HOME','User') }
if (-not $sdkRoot) { $sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$javaRoot = $env:JAVA_HOME
if (-not $javaRoot) { $javaRoot = [Environment]::GetEnvironmentVariable('JAVA_HOME','User') }
if (-not $javaRoot) { $javaRoot = Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr' }
$java = Join-Path $javaRoot 'bin\java.exe'
$buildTools = Join-Path $sdkRoot 'build-tools\36.0.0'
$sourceRoot = Join-Path $projectRoot 'watchface\src\main'
$buildRoot = Join-Path $projectRoot 'watchface\build\native'
$artifactRoot = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $buildRoot,$artifactRoot -Force | Out-Null

function Check-Exit([string]$operation) {
    if ($LASTEXITCODE -ne 0) { throw "$operation failed with exit code $LASTEXITCODE." }
}
& (Join-Path $PSScriptRoot 'Get-WffTools.ps1')
# watchface.xml is generated; fail if it no longer matches its generator.
& node (Join-Path $PSScriptRoot 'meniscus\build-face.mjs') --check
Check-Exit 'Generated watchface.xml freshness check'
& node (Join-Path $PSScriptRoot 'test-meniscus.mjs')
Check-Exit 'Meniscus expression and layout tests'
if ($Fake) {
    $fakeArgs = @('--fake') + $(if ($Diag) { @('--diag') } else { @() })
    & node (Join-Path $PSScriptRoot 'meniscus\build-face.mjs') @fakeArgs
    Check-Exit 'Fake-data face generation'
}
$validatorLog = Join-Path $buildRoot 'validation.log'
# Version 1.7 can exit zero on schema failures: check its report as well.
$savedErrorPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$validationOutput = & $java -jar (Join-Path $projectRoot '.tools\wff\wff-validator.jar') 4 (Join-Path $sourceRoot 'res\raw\watchface.xml') 2>&1 | ForEach-Object { $_.ToString() }
$ErrorActionPreference = $savedErrorPreference
$validationOutput | Out-File -LiteralPath $validatorLog -Encoding utf8
Check-Exit 'WFF validation'
$validation = Get-Content -LiteralPath $validatorLog -Raw
Write-Host $validation
if ($validation -match 'FAILED|SEVERE|NOT valid' -or $validation -notmatch 'SUCCESS|is valid') { throw "WFF validation failed; see $validatorLog" }

$aapt2 = Join-Path $buildTools 'aapt2.exe'
$compileExit = 0
try {
    & $aapt2 compile --dir (Join-Path $sourceRoot 'res') -o (Join-Path $buildRoot 'resources.zip')
    $compileExit = $LASTEXITCODE
} finally {
    if ($Fake) { & node (Join-Path $PSScriptRoot 'meniscus\build-face.mjs') | Out-Null }
}
$LASTEXITCODE = $compileExit
Check-Exit 'Resource compilation'

# Keep the AGP manifest namespace-free; aapt2's standalone path needs package.
[xml]$manifest = Get-Content -LiteralPath (Join-Path $sourceRoot 'AndroidManifest.xml') -Raw
$manifest.manifest.SetAttribute('package','com.bobbfwed.emberphase.meniscus')
$manifestPath = Join-Path $buildRoot 'AndroidManifest.xml'
$manifest.Save($manifestPath)
& $aapt2 link -o (Join-Path $buildRoot 'unsigned.apk') --manifest $manifestPath -I (Join-Path $sdkRoot 'platforms\android-36\android.jar') --min-sdk-version 36 --target-sdk-version 36 --version-code 3 --version-name '0.1.2' --auto-add-overlay -R (Join-Path $buildRoot 'resources.zip')
Check-Exit 'APK linking'
& (Join-Path $buildTools 'zipalign.exe') -f -p 4 (Join-Path $buildRoot 'unsigned.apk') (Join-Path $buildRoot 'aligned.apk')
Check-Exit 'APK alignment'

# Share Android/Gradle's standard debug key so switching build paths does not
# cause INSTALL_FAILED_UPDATE_INCOMPATIBLE on the watch.
$keyRoot = $env:ANDROID_USER_HOME
if (-not $keyRoot) { $keyRoot = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.android' }
New-Item -ItemType Directory -Path $keyRoot -Force | Out-Null
$keyPath = Join-Path $keyRoot 'debug.keystore'
if (-not (Test-Path -LiteralPath $keyPath)) {
    & (Join-Path $javaRoot 'bin\keytool.exe') -genkeypair -keystore $keyPath -storepass android -keypass android -alias androiddebugkey -dname 'CN=Android Debug,O=Android,C=US' -keyalg RSA -keysize 2048 -validity 10000
    Check-Exit 'Debug signing key creation'
}
$apkPath = Join-Path $artifactRoot ($(if ($Fake) { 'meniscus-fake-debug.apk' } else { 'meniscus-debug.apk' }))
$signerJar = Join-Path $buildTools 'lib\apksigner.jar'
& $java -jar $signerJar sign --ks $keyPath --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out $apkPath (Join-Path $buildRoot 'aligned.apk')
Check-Exit 'APK signing'
& $java -jar $signerJar verify --verbose $apkPath
Check-Exit 'APK signature verification'
& $java -jar (Join-Path $projectRoot '.tools\wff\memory-footprint.jar') --watch-face $sourceRoot --schema-version 4 --active-limit-mb 10 --ambient-limit-mb 4
Check-Exit 'WFF memory validation'

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($apkPath)
try {
    if (@($archive.Entries | Where-Object { $_.FullName -match '\.dex$' }).Count) { throw 'A resource-only WFF APK must not contain DEX code.' }
} finally { $archive.Dispose() }
Write-Host "Built, validated, and debug-signed: $apkPath"
if ($Install) {
    if (-not $Serial) { throw 'Use -Install -Serial <watch-address-or-serial> to select the intended device explicitly.' }
    & (Join-Path $sdkRoot 'platform-tools\adb.exe') -s $Serial install -r $apkPath
    Check-Exit 'Watch installation'
}
