[CmdletBinding()]
param([string]$BrowserPath)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& node (Join-Path $PSScriptRoot 'New-ParallaxPreviews.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Preview generation failed.' }
if (-not $BrowserPath) {
    $candidates = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe")
    $BrowserPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $BrowserPath) { throw 'Chrome or Edge is needed for previews. Pass -BrowserPath or build with -SkipPreviews using the committed picker preview.' }
$previewRoot = Join-Path $projectRoot 'artifacts\previews'
$cases = Get-Content -LiteralPath (Join-Path $previewRoot 'cases.json') -Raw -Encoding utf8 | ConvertFrom-Json
foreach ($case in $cases) {
    $size = 450
    if ($case.size) { $size = $case.size }
    $imagePath = Join-Path $projectRoot ("docs\previews\" + $case.name + '.png')
    $htmlPath = Join-Path $previewRoot ($case.name + '.html')
    $profilePath = Join-Path $projectRoot 'artifacts\preview-browser'
    if (Test-Path -LiteralPath $imagePath) { Remove-Item -LiteralPath $imagePath }
    $arguments = @('--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--hide-scrollbars',
        ('--user-data-dir="' + $profilePath + '"'),'--force-device-scale-factor=1',("--window-size=$size,$size"),
        ('--screenshot="' + $imagePath + '"'),'--virtual-time-budget=3000',([Uri]$htmlPath).AbsoluteUri)
    $browser = Start-Process -FilePath $BrowserPath -ArgumentList $arguments -WindowStyle Hidden -PassThru
    if (-not $browser.WaitForExit(30000)) { $browser.Kill(); throw "Preview timed out: $($case.name)" }
    if ($browser.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $imagePath)) { throw "Preview failed: $($case.name)" }
    Write-Host "Rendered $($case.name)"
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\previews\active.png') -Destination (Join-Path $projectRoot 'watchface\src\main\res\drawable-nodpi\preview.png') -Force
