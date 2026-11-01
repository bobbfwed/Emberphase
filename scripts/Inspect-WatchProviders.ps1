[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Serial)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$sdkRoot=[Environment]::GetEnvironmentVariable('ANDROID_HOME','User')
if(-not $sdkRoot) { $sdkRoot=Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adb=Join-Path $sdkRoot 'platform-tools\adb.exe'
$reportRoot=Join-Path $projectRoot ('artifacts\device-inspection-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null
$state=& $adb -s $Serial get-state
if($LASTEXITCODE -ne 0 -or $state.Trim() -ne 'device') { throw 'The selected device is not connected and authorized.' }
$model=(& $adb -s $Serial shell getprop ro.product.model).Trim()
$sdk=(& $adb -s $Serial shell getprop ro.build.version.sdk).Trim()
$fingerprint=(& $adb -s $Serial shell getprop ro.build.fingerprint).Trim()
if($sdk -ne '36') { Write-Warning "Expected Wear OS 6 / API 36; this device reports API $sdk." }
$providers=& $adb -s $Serial shell cmd package query-services --brief --components -a android.support.wearable.complications.ACTION_COMPLICATION_UPDATE_REQUEST
if($LASTEXITCODE -ne 0) { throw 'Provider query failed.' }
$providers | Out-File -LiteralPath (Join-Path $reportRoot 'complication-services.txt') -Encoding utf8
$packages=@($providers | ForEach-Object { if($_ -match '^([A-Za-z0-9_.]+)/[A-Za-z0-9_.$]+$') { $matches[1] } } | Where-Object { $_ -match 'shealth|weather|health' } | Sort-Object -Unique)
foreach($package in $packages) {
    & $adb -s $Serial shell dumpsys package $package | Out-File -LiteralPath (Join-Path $reportRoot ($package+'.txt')) -Encoding utf8
    if($LASTEXITCODE -ne 0) { throw "Package inspection failed for $package." }
}
[ordered]@{
    model=$model; api=$sdk; fingerprint=$fingerprint
    queriedAction='android.support.wearable.complications.ACTION_COMPLICATION_UPDATE_REQUEST'
    inspectedPackages=$packages
    payloadsVerified=$false
    note='Service declarations alone do not prove values, units, targets, or provider text semantics. Complete the device acceptance checks before setting defaults.'
} | ConvertTo-Json -Depth 4 | Out-File -LiteralPath (Join-Path $reportRoot 'summary.json') -Encoding utf8
Write-Host "Provider declarations saved to $reportRoot"
Write-Host 'Next: select each provider in the editor; compare totals and goals with Samsung Health, then change the goals and test empty/offline states.'
