[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$root=Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\previews'
$left=[Drawing.Bitmap]::FromFile((Join-Path $root 'normal.png'))
$right=[Drawing.Bitmap]::FromFile((Join-Path $root 'balance-right.png'))
try {
    $changed=0; $leftLight=0; $rightLight=0
    for($y=0;$y -lt 450;$y++) {
        for($x=0;$x -lt 450;$x++) {
            $a=$left.GetPixel($x,$y); $b=$right.GetPixel($x,$y)
            if($a.ToArgb() -eq $b.ToArgb()) { continue }
            # Include the few subpixel edge samples from the downsampled mask.
            # Clear arc slots centered on the dial, plus a few antialiased edge samples.
            $inLeft=$x -ge 143 -and $x -le 185 -and $y -ge 198 -and $y -le 252
            $inRight=$x -ge 265 -and $x -le 307 -and $y -ge 198 -and $y -le 252
            if(-not $inLeft -and -not $inRight) { throw "Moving wheel leaks through the dial at ($x,$y)" }
            $difference=([int]$a.R+$a.G+$a.B)-([int]$b.R+$b.G+$b.B)
            if($inLeft) { $leftLight+=$difference } else { $rightLight+=$difference }
            $changed++
        }
    }
    if($changed -lt 80 -or $leftLight -lt 1000 -or $rightLight -gt -1000) {
        throw 'The metal rim must be visibly exposed on opposite sides in the two settled states'
    }
    Write-Host "PASS: $changed changing pixels confined to the two inner windows; both settled positions expose the correct rim."
} finally { $right.Dispose(); $left.Dispose() }

# A counterclockwise step moves the pale rim down in the left opening and up in the right.
# Eight degrees keeps that light/dark boundary inside both windows. A larger step
# carries the rim out of the right opening, so a brightness centroid then follows
# the leftover edge instead of the travel.
$wheel=[Drawing.Bitmap]::FromFile((Join-Path (Split-Path -Parent $PSScriptRoot) 'watchface\src\main\res\drawable-nodpi\balance_wheel.png'))
$dial=[Drawing.Bitmap]::FromFile((Join-Path (Split-Path -Parent $PSScriptRoot) 'watchface\src\main\res\drawable-nodpi\dial_frame.png'))
function Render-Wheel([double]$angle) {
    $bitmap=New-Object Drawing.Bitmap 450,450
    $graphics=[Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([Drawing.Color]::Black)
    $graphics.InterpolationMode='HighQualityBicubic'
    $graphics.TranslateTransform(225,225); $graphics.RotateTransform($angle)
    $graphics.DrawImage($wheel,-74,-74,148,148); $graphics.ResetTransform()
    $graphics.DrawImage($dial,0,0,450,450); $graphics.Dispose()
    return $bitmap
}
function Get-BrightCentroid($bitmap,[int]$x0,[int]$x1,[int]$y0,[int]$y1) {
    $sumY=0.0; $count=0
    for($y=$y0;$y -le $y1;$y++) {
        for($x=$x0;$x -le $x1;$x++) {
            if($dial.GetPixel($x,$y).A -gt 16) { continue }
            $pixel=$bitmap.GetPixel($x,$y)
            if(($pixel.R+$pixel.G+$pixel.B) -lt 180) { continue }
            $sumY+=$y; $count++
        }
    }
    if($count -lt 20) { throw "Too few bright rim pixels ($count) to judge direction" }
    return $sumY/$count
}
$atRest=Render-Wheel 0
$advanced=Render-Wheel -8
try {
    $leftDy=(Get-BrightCentroid $advanced 145 183 200 250)-(Get-BrightCentroid $atRest 145 183 200 250)
    $rightDy=(Get-BrightCentroid $advanced 267 305 200 250)-(Get-BrightCentroid $atRest 267 305 200 250)
    if($leftDy -lt 4) { throw "Left opening shifted by $leftDy px; counterclockwise travel goes down on the left." }
    if($rightDy -gt -4) { throw "Right opening shifted by $rightDy px; counterclockwise travel goes up on the right." }
    Write-Host ("PASS: 8-degree counterclockwise step moves the rim down on the left ({0:N1} px) and up on the right ({1:N1} px)." -f $leftDy,$rightDy)
} finally { $atRest.Dispose(); $advanced.Dispose(); $wheel.Dispose(); $dial.Dispose() }
foreach($file in @('balance-motion.gif','balance-detail.gif')) {
    $gif=[Drawing.Image]::FromFile((Join-Path $root $file))
    try {
        $count=$gif.GetFrameCount([Drawing.Imaging.FrameDimension]::Time)
        $timing=$gif.GetPropertyItem(0x5100).Value; $sum=0; $holds=0
        for($i=0;$i -lt $timing.Length;$i+=4) {
            $delay=[BitConverter]::ToInt32($timing,$i); $sum+=$delay
            if($delay -ge 75) { $holds++ }
        }
        $loop=[BitConverter]::ToUInt16($gif.GetPropertyItem(0x5101).Value,0)
        if($count -lt 4 -or $sum -ne 200 -or $holds -ne 2 -or $loop -ne 0) {
            throw "Invalid timing in ${file}: expected a looping two-second cycle with two settled holds"
        }
        Write-Host "PASS: $file has two brief transitions and two holds in a looping two-second cycle."
    } finally { $gif.Dispose() }
}
