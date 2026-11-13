[CmdletBinding()]
param()
# Regenerates the Meniscus bitmap resources (numerals, weather glyphs) and the
# picker preview. Requires Node.js and Microsoft Edge. Output is committed, so
# the face builds without these tools.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$drawables = Join-Path $projectRoot 'watchface\src\main\res\drawable-nodpi'
$work = Join-Path $projectRoot 'watchface\build\meniscus-assets'
New-Item -ItemType Directory -Path $work, $drawables -Force | Out-Null
Add-Type -AssemblyName System.Drawing

$edge = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge is required to rasterize the artwork.' }

function Invoke-EdgeShot([string]$url, [string]$out, [int]$width, [int]$height) {
    if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out }
    $edgeArgs = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        '--default-background-color=00000000', "--window-size=$width,$height", '--virtual-time-budget=3000',
        "--user-data-dir=$work\edge-profile", "--screenshot=$out", $url)
    $process = Start-Process -FilePath $edge -ArgumentList $edgeArgs -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $out)) { throw "Edge could not render $url" }
}

& node (Join-Path $PSScriptRoot 'meniscus\build-assets.mjs') $work
if ($LASTEXITCODE -ne 0) { throw 'Atlas generation failed.' }
$manifest = Get-Content -LiteralPath (Join-Path $work 'atlas.json') -Raw | ConvertFrom-Json
$atlasPng = Join-Path $work 'atlas.png'
Invoke-EdgeShot ([Uri](Join-Path $work 'atlas.html')).AbsoluteUri $atlasPng $manifest.width $manifest.height

$atlas = [System.Drawing.Bitmap]::FromFile($atlasPng)
try {
    foreach ($crop in $manifest.crops) {
        $rect = New-Object System.Drawing.Rectangle ([int]$crop.x), ([int]$crop.y), ([int]$crop.w), ([int]$crop.h)
        $piece = $atlas.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try { $piece.Save((Join-Path $drawables "$($crop.name).png"), [System.Drawing.Imaging.ImageFormat]::Png) }
        finally { $piece.Dispose() }
    }
} finally { $atlas.Dispose() }

# Picker preview: the concept page's face-only mode with fixed sample data.
$concept = Join-Path $projectRoot 'docs\design\meniscus-concept.html'
$shot = Join-Path $work 'preview.png'
Invoke-EdgeShot (([Uri]$concept).AbsoluteUri + '?shot=1') $shot 450 450
Copy-Item -LiteralPath $shot -Destination (Join-Path $drawables 'preview.png') -Force
Write-Host "Wrote $($manifest.crops.Count) artwork images and preview.png to $drawables"
