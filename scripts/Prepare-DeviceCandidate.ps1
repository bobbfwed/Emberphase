[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sdkRoot = $env:ANDROID_HOME
if (-not $sdkRoot) { $sdkRoot = [Environment]::GetEnvironmentVariable('ANDROID_HOME','User') }
if (-not $sdkRoot) { $sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$javaRoot = $env:JAVA_HOME
if (-not $javaRoot) { $javaRoot = [Environment]::GetEnvironmentVariable('JAVA_HOME','User') }
if (-not $javaRoot) { $javaRoot = Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr' }
$aapt2 = Join-Path $sdkRoot 'build-tools\36.0.0\aapt2.exe'
$java = Join-Path $javaRoot 'bin\java.exe'
$signer = Join-Path $sdkRoot 'build-tools\36.0.0\lib\apksigner.jar'
$candidateRoot = Join-Path $projectRoot 'artifacts\device-ready'
New-Item -ItemType Directory -Path $candidateRoot -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing
function Entry-Hash($Archive,[string]$Name) {
    $entry = $Archive.GetEntry($Name)
    if (-not $entry) { throw "APK entry missing: $Name" }
    $stream = $entry.Open()
    $digest = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($digest.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
    finally { $digest.Dispose(); $stream.Dispose() }
}
$facePath = Join-Path $projectRoot 'artifacts\parallax-debug.apk'
$watchPath = Join-Path $projectRoot 'health-watch\build\outputs\apk\debug\health-watch-debug.apk'
if (-not (Test-Path -LiteralPath $facePath) -or -not (Test-Path -LiteralPath $watchPath)) { throw 'Build the face and watch companion before preparing a device candidate.' }
$archive = [IO.Compression.ZipFile]::OpenRead($facePath)
try {
    if (@($archive.Entries | Where-Object { $_.FullName -match '\.dex$' }).Count) { throw 'Face APK contains executable DEX code.' }
    foreach ($pair in @(
        @('res/raw/watchface.xml','watchface\src\main\res\raw\watchface.xml'),
        @('res/font/rajdhani_light.ttf','watchface\src\main\res\font\rajdhani_light.ttf'),
        @('assets/rajdhani-OFL.txt','watchface\src\main\assets\rajdhani-OFL.txt')
    )) {
        if ((Entry-Hash $archive $pair[0]) -ne (Get-FileHash -LiteralPath (Join-Path $projectRoot $pair[1]) -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "Stale face APK entry: $($pair[0])" }
    }
    $picker = $archive.Entries | Where-Object { $_.FullName -match '^res/drawable[^/]*/preview\.png$' } | Select-Object -First 1
    if (-not $picker) { throw 'APK picker preview is missing.' }
    # AAPT2 can crunch PNG bytes while preserving the image. Compare decoded pixels.
    $pickerStream = $picker.Open()
    $packedPicker = [Drawing.Bitmap]::FromStream($pickerStream)
    $sourcePicker = [Drawing.Bitmap]::FromFile((Join-Path $projectRoot 'watchface\src\main\res\drawable-nodpi\preview.png'))
    try {
        if ($packedPicker.Width -ne $sourcePicker.Width -or $packedPicker.Height -ne $sourcePicker.Height) { throw 'Stale APK picker dimensions.' }
        for ($y=0;$y -lt $sourcePicker.Height;$y++) { for ($x=0;$x -lt $sourcePicker.Width;$x++) {
            if ($packedPicker.GetPixel($x,$y).ToArgb() -ne $sourcePicker.GetPixel($x,$y).ToArgb()) { throw 'Stale APK picker pixels.' }
        } }
    } finally { $sourcePicker.Dispose(); $packedPicker.Dispose(); $pickerStream.Dispose() }
} finally { $archive.Dispose() }
$items = @(
    @{Source=$facePath; File='parallax-1.0.1-debug.apk'; Package='com.bobbfwed.emberphase'; VersionCode='40'; VersionName='1.0.1'},
    @{Source=$watchPath; File='emberphase-health-watch-0.1.9-debug.apk'; Package='com.bobbfwed.emberphase.health'; VersionCode='2010'; VersionName='0.1.9'}
)
$manifestItems = foreach ($item in $items) {
    $badging = & $aapt2 dump badging $item.Source
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read APK metadata.' }
    $packageLine = ($badging | Where-Object { $_ -like 'package:*' }) -join ''
    if ($packageLine -notmatch ("name='" + [regex]::Escape($item.Package) + "'") -or $packageLine -notmatch ("versionCode='" + $item.VersionCode + "'") -or $packageLine -notmatch ("versionName='" + [regex]::Escape($item.VersionName) + "'")) { throw "Unexpected APK identity: $packageLine" }
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $verification = & $java -jar $signer verify --print-certs $item.Source 2>&1 | ForEach-Object { $_.ToString() }
    $verificationCode = $LASTEXITCODE
    $ErrorActionPreference = $savedPreference
    if ($verificationCode -ne 0) { throw "APK signature invalid: $($item.File)" }
    $certificateLine = ($verification | Where-Object { $_ -match '^Signer #1 certificate SHA-256 digest:' }) -join ''
    $certificate = ($certificateLine -replace '^Signer #1 certificate SHA-256 digest:\s*','').Trim()
    if (-not $certificate) { throw 'No signer fingerprint found.' }
    $destination = Join-Path $candidateRoot $item.File
    Copy-Item -LiteralPath $item.Source -Destination $destination -Force
    [ordered]@{file=$item.File; package=$item.Package; versionCode=[int]$item.VersionCode; versionName=$item.VersionName; bytes=(Get-Item -LiteralPath $destination).Length; sha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant(); signingCertificateSha256=$certificate}
}
if ($manifestItems[0].signingCertificateSha256 -ne $manifestItems[1].signingCertificateSha256) { throw 'Candidate face/watch companion signing certificates differ.' }
$revision = (& git -C $projectRoot rev-parse HEAD).Trim()
$manifest = [ordered]@{status='READY_FOR_DEVICE_TESTING_NOT_INSTALLED'; sourceRevision=$revision; faceSourceSha256=(Get-FileHash -LiteralPath (Join-Path $projectRoot 'watchface\src\main\res\raw\watchface.xml')).Hash.ToLowerInvariant(); phoneCompanion='Existing 0.1.3 phone app unchanged; preserve matching package/signing identity.'; physicalAcceptance='Pending watch availability'; artifacts=@($manifestItems)}
$manifest | ConvertTo-Json -Depth 6 | Out-File -LiteralPath (Join-Path $candidateRoot 'candidate.json') -Encoding utf8
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\design\device-acceptance.md') -Destination (Join-Path $candidateRoot 'device-acceptance.md') -Force
Write-Output "Prepared checksummed candidate: $candidateRoot"
Write-Output 'No ADB command, device connection, or installation was executed.'
