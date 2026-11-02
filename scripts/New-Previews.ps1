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

foreach($mode in @('normal','low-battery','ambient','unavailable','seconds')) {
    Canvas 450 450
    $script:g.Clear([System.Drawing.Color]::Black)
    if($mode -eq 'ambient') {
        Asset 'ambient_indices' 0 0 450 450
        # Host artwork composite, not a screenshot of Wear OS. Native mode uses
        # the same resources with alpha 150; this preview shows the geometry.
        Asset 'hour_hand' 214 93 22 150 305 0.5 0.88 (150/255)
        Asset 'minute_hand' 217 45 16 198 60 0.5 0.9090909 (150/255)
    } else {
        Asset 'moon_disc' 135 40 180 180 (90-14*180/29.530588853)
        Asset 'dial_frame' 0 0 450 450
        Label 'OCT' 136 116 14 '#555555' 57; Label 'NOV' 136 131 21 '#f6f6f0' 57; Label 'DEC' 136 152 12 '#454545' 57
        Label 'SAT' 197 116 14 '#555555' 55; Label 'SUN' 197 131 21 '#ff6a15' 55; Label 'MON' 197 152 12 '#454545' 55
        Label '31' 258 116 14 '#555555' 55; Label '01' 258 131 21 '#f6f6f0' 55; Label '02' 258 152 12 '#454545' 55
        $battery=73; if($mode -eq 'low-battery') { $battery=5 }
        Asset 'battery_slider' 367 (274-99*$battery/100) 21 13
        if($battery -le 20) { RoundFill '#ffd535' 366 274 5 13 2 }
        if($battery -le 10) { RoundFill '#ff352a' 385 274 5 13 2 }
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
        if($mode -eq 'seconds') { Asset 'second_hand' 222 23 6 230 132 0.5 0.8782609 }
        Asset 'center_cap' 211 211 28 28
    }
    Save $mode
}
Copy-Item -LiteralPath (Join-Path $assetRoot 'normal.png') -Destination (Join-Path $sourceAssetRoot 'preview.png') -Force
Write-Host "Illustrative artwork composites (not device screenshots): $assetRoot"
