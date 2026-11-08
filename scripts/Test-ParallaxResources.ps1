[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$resources = Join-Path $projectRoot 'watchface\src\main\res'
[xml]$face = Get-Content -LiteralPath (Join-Path $resources 'raw\watchface.xml') -Raw -Encoding utf8
[xml]$strings = Get-Content -LiteralPath (Join-Path $resources 'values\strings.xml') -Raw -Encoding utf8
$stringNames = @($strings.resources.string | ForEach-Object { $_.name })
foreach ($attribute in $face.SelectNodes('//@displayName')) {
    if ($attribute.Value -notin $stringNames) { throw "Missing WFF editor string: $($attribute.Value)" }
}
foreach ($font in $face.SelectNodes('//Font')) {
    if ($font.family -notin @('sans-serif','SYNC_TO_DEVICE') -and -not (Test-Path -LiteralPath (Join-Path $resources ('font\' + $font.family + '.ttf')))) {
        throw "Missing WFF font: $($font.family)"
    }
}
[xml]$info = Get-Content -LiteralPath (Join-Path $resources 'xml\watch_face_info.xml') -Raw
if ($info.WatchFaceInfo.Preview.value -ne '@drawable/preview' -or -not (Test-Path -LiteralPath (Join-Path $resources 'drawable-nodpi\preview.png'))) { throw 'Picker preview missing.' }
$slotIds = @($face.WatchFace.Scene.ComplicationSlot | ForEach-Object { $_.slotId })
if (($slotIds | Select-Object -Unique).Count -ne 3 -or @($slotIds | Where-Object { $_ -notin @('101','102','103') }).Count) { throw 'Unexpected complication slot allocation.' }
if ((Get-FileHash -LiteralPath (Join-Path $projectRoot 'third-party\rajdhani\OFL.txt')).Hash -ne (Get-FileHash -LiteralPath (Join-Path $projectRoot 'watchface\src\main\assets\rajdhani-OFL.txt')).Hash) { throw 'Packaged font license differs from the third-party license.' }
Write-Output 'PASS: native editor labels, fonts, picker resource, and three stable complication IDs.'
