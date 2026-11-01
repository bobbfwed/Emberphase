[CmdletBinding()]
param(
    [string]$SdkRoot = (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
    [string]$StudioRoot = (Join-Path $env:ProgramFiles 'Android\Android Studio'),
    [switch]$PrepareOnly
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'Get-AndroidArchive.ps1')

# Official Windows command-line tools and SHA-256 from:
# https://developer.android.com/studio#command-tools
$toolsUrl = 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip'
$toolsSha256 = '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'

$env:ANDROID_HOME = [System.IO.Path]::GetFullPath($SdkRoot)
$sdkManager = Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\sdkmanager.bat'

if (-not (Test-Path -LiteralPath $sdkManager)) {
    $stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('watchface-sdk-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stagingRoot | Out-Null
    $archivePath = Join-Path $stagingRoot 'commandlinetools.zip'
    Write-Host 'Downloading Android SDK command-line tools from Google...'
    Get-AndroidArchive -Url $toolsUrl -Destination $archivePath -ExpectedSize 155655386
    $actualSha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    if ($actualSha256 -ne $toolsSha256) {
        throw "SDK download checksum mismatch. Download retained at $archivePath."
    }

    Write-Host 'Extracting verified SDK command-line tools...'
    Expand-Archive -LiteralPath $archivePath -DestinationPath $stagingRoot
    $commandToolsRoot = Join-Path $env:ANDROID_HOME 'cmdline-tools'
    $latestToolsRoot = Join-Path $commandToolsRoot 'latest'
    if (Test-Path -LiteralPath $latestToolsRoot) {
        throw "An incomplete command-line tools installation already exists at $latestToolsRoot. Inspect it before retrying."
    }
    New-Item -ItemType Directory -Path $commandToolsRoot -Force | Out-Null
    $extractedTools = [System.IO.Path]::GetFullPath((Join-Path $stagingRoot 'cmdline-tools'))
    if (-not $extractedTools.StartsWith($stagingRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The extracted source must remain inside the staging directory.'
    }
    # Destination is inside the explicit, absolute ANDROID_HOME checked above.
    Move-Item -LiteralPath $extractedTools -Destination $latestToolsRoot
    # Delete only the verified download; keep the staging directory for inspection.
    Remove-Item -LiteralPath $archivePath
}

if ($PrepareOnly) {
    Write-Host "Android SDK command-line tools prepared at $env:ANDROID_HOME"
    return
}
if (-not (Test-Path -LiteralPath (Join-Path $StudioRoot 'jbr\bin\java.exe'))) {
    $userStudioRoot = Join-Path $env:LOCALAPPDATA 'Programs\Android Studio'
    if (Test-Path -LiteralPath (Join-Path $userStudioRoot 'jbr\bin\java.exe')) {
        $StudioRoot = $userStudioRoot
    } else {
        throw 'Install Android Studio first, or specify its directory with -StudioRoot.'
    }
}
$env:JAVA_HOME = Join-Path $StudioRoot 'jbr'

# Standard SDK license acceptance is part of this requested unattended install.
Write-Host 'Accepting Android SDK package licenses...'
$licenseLog = Join-Path ([System.IO.Path]::GetTempPath()) ('watchface-sdk-licenses-' + [guid]::NewGuid().ToString('N') + '.log')
1..100 | ForEach-Object { 'y' } | & $sdkManager "--sdk_root=$env:ANDROID_HOME" --licenses | Out-File -LiteralPath $licenseLog -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "SDK license setup failed with exit code $LASTEXITCODE." }

Write-Host 'Installing platform tools, Android 16 SDK, build tools, and emulator...'
& (Join-Path $PSScriptRoot 'Install-AndroidSdkPackages.ps1') -SdkRoot $env:ANDROID_HOME

[Environment]::SetEnvironmentVariable('ANDROID_HOME', $env:ANDROID_HOME, 'User')
if (-not [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User')) {
    [Environment]::SetEnvironmentVariable('JAVA_HOME', $env:JAVA_HOME, 'User')
}
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$pathEntries = @($userPath -split ';' | Where-Object { $_ })
foreach ($toolPath in @(
    (Join-Path $env:ANDROID_HOME 'platform-tools'),
    (Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin'),
    (Join-Path $env:ANDROID_HOME 'emulator'),
    (Join-Path ([Environment]::GetEnvironmentVariable('JAVA_HOME', 'User')) 'bin')
)) {
    if ($pathEntries -notcontains $toolPath) { $pathEntries += $toolPath }
}
[Environment]::SetEnvironmentVariable('Path', ($pathEntries -join ';'), 'User')

Write-Host "Android SDK installed at $env:ANDROID_HOME"
& (Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe') version
if ($LASTEXITCODE -ne 0) { throw 'ADB verification failed.' }
& $sdkManager "--sdk_root=$env:ANDROID_HOME" --list_installed
if ($LASTEXITCODE -ne 0) { throw 'SDK package verification failed.' }
Write-Host 'Open a new terminal to load the saved ANDROID_HOME, JAVA_HOME, and PATH settings.'
