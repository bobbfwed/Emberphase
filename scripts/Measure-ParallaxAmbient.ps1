[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$results = foreach ($name in @('ambient','ambient-stress','ambient-solid-stress')) {
    $bitmap = [Drawing.Bitmap]::FromFile((Join-Path $projectRoot "docs\previews\$name.png"))
    try {
        $lit = 0; $screen = 0
        for ($py = 0; $py -lt $bitmap.Height; $py++) {
            for ($px = 0; $px -lt $bitmap.Width; $px++) {
                if (($px - ($bitmap.Width-1)/2)*($px - ($bitmap.Width-1)/2) + ($py - ($bitmap.Height-1)/2)*($py - ($bitmap.Height-1)/2) -le ($bitmap.Width/2)*($bitmap.Width/2)) {
                    $screen++
                    $pixel = $bitmap.GetPixel($px,$py)
                    if ($pixel.R -gt 0 -or $pixel.G -gt 0 -or $pixel.B -gt 0) { $lit++ }
                }
            }
        }
        $percent = 100*$lit/$screen
        if ($percent -ge 10) { throw "Ambient preview exceeds 10 percent: $name" }
        [pscustomobject]@{Preview=$name; LitPixels=$lit; ScreenPixels=$screen; Percent=[Math]::Round($percent,3)}
    } finally { $bitmap.Dispose() }
}
$results | Format-Table -AutoSize
Write-Output 'Browser render measurements only; native watch results remain pending.'
