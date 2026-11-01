[CmdletBinding()]
param(
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio')
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'Get-AndroidArchive.ps1')
$InstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)

if (Test-Path -LiteralPath (Join-Path $InstallRoot 'bin\studio64.exe')) {
    Write-Host "Android Studio is already installed at $InstallRoot"
    return
}
if (Test-Path -LiteralPath $InstallRoot) {
    throw "The destination already exists. Inspect $InstallRoot before installing."
}

# Official portable Windows distribution and SHA-256 from:
# https://developer.android.com/studio
$studioUrl = 'https://dl.google.com/dl/android/studio/ide-zips/2026.2.2.8/android-studio-rabbit2-windows.zip'
$studioSha256 = 'a05e6742d5fd92a090ee6697c3f75706db735decf5a8543f3bbaf2514c0fd123'
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('watchface-studio-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stagingRoot | Out-Null
$archivePath = Join-Path $stagingRoot 'android-studio.zip'

Write-Host 'Downloading Android Studio 2026.2.2.8 from Google (about 1.5 GB)...'
Get-AndroidArchive -Url $studioUrl -Destination $archivePath -ExpectedSize 1546596319
if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $studioSha256) {
    throw "Android Studio checksum mismatch. Download retained at $archivePath."
}

Write-Host 'Extracting verified Android Studio distribution...'
Expand-Archive -LiteralPath $archivePath -DestinationPath $stagingRoot
$extractedStudio = [System.IO.Path]::GetFullPath((Join-Path $stagingRoot 'android-studio'))
if (-not $extractedStudio.StartsWith($stagingRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The extracted source must remain inside the staging directory.'
}
if (-not (Test-Path -LiteralPath (Join-Path $extractedStudio 'bin\studio64.exe'))) {
    throw 'The downloaded archive does not contain the expected Android Studio executable.'
}
New-Item -ItemType Directory -Path (Split-Path -Parent $InstallRoot) -Force | Out-Null
# Destination is the explicit, absolute InstallRoot checked above.
Move-Item -LiteralPath $extractedStudio -Destination $InstallRoot
Remove-Item -LiteralPath $archivePath

$shortcutRoot = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
New-Item -ItemType Directory -Path $shortcutRoot -Force | Out-Null
$shortcutShell = New-Object -ComObject WScript.Shell
$shortcut = $shortcutShell.CreateShortcut((Join-Path $shortcutRoot 'Android Studio.lnk'))
$shortcut.TargetPath = Join-Path $InstallRoot 'bin\studio64.exe'
$shortcut.WorkingDirectory = $InstallRoot
$shortcut.Save()

Write-Host "Android Studio installed at $InstallRoot"
Get-Content -LiteralPath (Join-Path $InstallRoot 'product-info.json') -Raw | ConvertFrom-Json | Select-Object name,version,buildNumber
& (Join-Path $InstallRoot 'jbr\bin\java.exe') -version
if ($LASTEXITCODE -ne 0) { throw 'Bundled Java verification failed.' }
