[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'New-DialAssets.ps1')
$sourceAssetRoot=$assetRoot
$assetRoot=Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\previews'
New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null
$degree=[string][char]0x00b0
$dash=[string][char]0x2014

function Asset([string]$name,[float]$x,[float]$y,[float]$w,[float]$h,[float]$angle=0,[float]$px=0.5,[float]$py=0.5,[float]$alpha=1) {
    $image=[System.Drawing.Image]::FromFile((Join-Path $sourceAssetRoot ($name+'.png')))
    $state=$script:g.Save()
    $script:g.TranslateTransform(($x+$px*$w),($y+$py*$h)); $script:g.RotateTransform($angle)
    $script:g.TranslateTransform((-$px*$w),(-$py*$h))
    if($alpha -lt 1) {
        $matrix=New-Object System.Drawing.Imaging.ColorMatrix
        $matrix.Matrix33=$alpha
        $attributes=New-Object System.Drawing.Imaging.ImageAttributes
        $attributes.SetColorMatrix($matrix)
        $script:g.DrawImage($image,([System.Drawing.Rectangle]::new(0,0,[int]$w,[int]$h)),0,0,$image.Width,$image.Height,[System.Drawing.GraphicsUnit]::Pixel,$attributes)
        $attributes.Dispose()
    } else { $script:g.DrawImage($image,[float]0,[float]0,$w,$h) }
    $script:g.Restore($state); $image.Dispose()
}
function FillGauge([float]$radius,[float]$ratio,[string[]]$colors) {
    $ratio=[math]::Min(1.0,[math]::Max(0.0,[double]$ratio))
    if($ratio -le 0) { return }
    # Sample the same radial metal gradient used by the native WFF stroke.
    $stops=@(0,0.12,0.32,0.45,0.58,0.84,1)
    for($i=0;$i -lt 32;$i++) {
        $position=($i+0.5)/32; $j=0
        while($j -lt 5 -and $position -gt $stops[$j+1]) { $j++ }
        $mix=($position-$stops[$j])/($stops[$j+1]-$stops[$j]); $a=C $colors[$j]; $b=C $colors[$j+1]
        $color=[System.Drawing.Color]::FromArgb([int]($a.R+($b.R-$a.R)*$mix),[int]($a.G+($b.G-$a.G)*$mix),[int]($a.B+($b.B-$a.B)*$mix))
        $r=$radius-6+12*$position; $p=New-Object System.Drawing.Pen($color,0.6); $p.StartCap='Flat'; $p.EndCap='Flat'
        $script:g.DrawArc($p,([System.Drawing.RectangleF]::new((225-$r),(225-$r),($r*2),($r*2))),124,(-68*$ratio)); $p.Dispose()
    }
    $angle=214-68*$ratio
    $p=Pen $colors[3] 1; $p.StartCap='Flat'; $p.EndCap='Flat'
    $script:g.DrawLine($p,(RingPoint ($radius-5.5) $angle),(RingPoint ($radius+5.5) $angle)); $p.Dispose()
}
function DrumLabel([string]$text,[float]$x,[float]$y,[float]$width,[bool]$receding,[string]$color='#f6f6f0') {
    $state=$script:g.Save()
    if($receding) {
        $script:g.TranslateTransform(($x+$width/2),($y+13))
        $script:g.ScaleTransform(0.94,0.58)
        $script:g.TranslateTransform((-$x-$width/2),(-$y-13))
        $color='#c3c3c3'
    }
    Label $text $x ($y-2) 22 $color $width
    $script:g.Restore($state)
}

foreach($mode in @('normal','low-battery','ambient','ambient-low-battery','unavailable','seconds')) {
    Canvas 450 450
    $script:g.Clear([System.Drawing.Color]::Black)
    if($mode.StartsWith('ambient')) {
        Asset 'ambient_indices' 0 0 450 450
        Label 'SUN' 136 109 23 '#d94c20' 57; Label 'NOV' 197 109 23 '#d94c20' 55; Label '01' 258 109 23 '#d94c20' 55
        $battery=73; if($mode -eq 'ambient-low-battery') { $battery=5 }
        Asset 'ambient_battery_slider' 359 (274-99*$battery/100) 21 13
        if($battery -le 20) { RoundFill '#d8b32a' 358 274 5 13 2 }
        if($battery -le 10) { RoundFill '#dc3020' 377 274 5 13 2 }
        Asset 'ambient_hour_hand' 214 93 22 150 305 0.5 0.88
        Asset 'ambient_minute_hand' 217 45 16 198 60 0.5 0.9090909
        Asset 'ambient_center_cap' 211 211 28 28
    } else {
        Asset 'moon_disc' 135 40 180 180 (90-14*180/29.530588853)
        Asset 'dial_frame' 0 0 450 450
        DrumLabel 'SAT' 136 126 57 $true; DrumLabel 'SUN' 136 149 57 $false '#ff6a15'; DrumLabel 'MON' 136 167 57 $true
        DrumLabel 'OCT' 197 126 55 $true; DrumLabel 'NOV' 197 149 55 $false; DrumLabel 'DEC' 197 167 55 $true
        DrumLabel '31' 258 126 55 $true; DrumLabel '01' 258 149 55 $false; DrumLabel '02' 258 167 55 $true
        Asset 'calendar_bezel' 125 125 200 68
        $battery=73; if($mode -eq 'low-battery') { $battery=5 }
        Asset 'battery_slider' 359 (274-99*$battery/100) 21 13
        if($battery -le 20) { RoundFill '#ffd535' 358 274 5 13 2 }
        if($battery -le 10) { RoundFill '#ff352a' 377 274 5 13 2 }
        if($mode -eq 'unavailable') {
            Asset 'wx_0' 63 212 47 47
            Label $dash 52 254 29 '#f4f4ef' 75; Label ('H '+$dash) 52 285 14 '#f4f4ef' 75
            Label $dash 169 257 34 '#f4f4ef' 112; Label $dash 178 307 23 '#f4f4ef' 53; Label $dash 262 307 23 '#f4f4ef' 57
            Label $dash 316 341 13 '#eeeeeb' 43; Label $dash 326 358 13 '#eeeeeb' 43; Label $dash 336 375 13 '#eeeeeb' 43
        } else {
            # These are mockup fixtures, never production data or WFF constants.
            Asset 'wx_14' 63 212 47 47
            Label ('56'+$degree) 52 254 29 '#f4f4ef' 75; Label ('H 61'+$degree+'F') 52 285 14 '#f4f4ef' 75
            Label '6,482' 169 257 34 '#f4f4ef' 112; Label '42' 178 307 23 '#f4f4ef' 53; Label '380' 262 307 23 '#f4f4ef' 57
            FillGauge 150 (6482/8000) @('#662400','#bf4005','#ff7415','#ffd79b','#ff9c40','#df5206','#702500')
            FillGauge 168 (42/60) @('#004955','#008f9e','#00d6e9','#b2faff','#38e9f4','#00a7bc','#004e60')
            FillGauge 186 (380/500) @('#254d00','#4a9700','#79ef06','#e0ffad','#a0ff30','#65c900','#2b5b00')
            Label '8,000' 316 341 13 '#eeeeeb' 43; Label '60' 326 358 13 '#eeeeeb' 43; Label '500' 336 375 13 '#eeeeeb' 43
        }
        Asset 'hour_hand' 214 93 22 150 305 0.5 0.88
        Asset 'minute_hand' 217 45 16 198 60 0.5 0.9090909
        if($battery -gt 15) { Asset 'second_hand' 222 23 6 230 132 0.5 0.8782609 }
        Asset 'center_cap' 211 211 28 28
    }
    Save $mode
}
Copy-Item -LiteralPath (Join-Path $assetRoot 'normal.png') -Destination (Join-Path $sourceAssetRoot 'preview.png') -Force
Write-Host "Illustrative artwork composites (not device screenshots): $assetRoot"
