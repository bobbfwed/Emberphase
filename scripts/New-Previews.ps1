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
function FillGauge([float]$height,[float]$ratio,[string]$color) {
    $p=Pen $color 10; $p.StartCap='Round'; $p.EndCap='Round'
    $script:g.DrawArc($p,([System.Drawing.RectangleF]::new(106,(274-$height/2),238,$height)),135,(-90*[math]::Min(1,[math]::Max(0,$ratio))))
    $p.Dispose()
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
            foreach($goalY in @(330,347,365)) { Label $dash 316 $goalY 13 '#eeeeeb' 43 }
        } else {
            # These are mockup fixtures, never production data or WFF constants.
            Asset 'wx_14' 63 212 47 47
            Label ('56'+$degree) 52 254 29 '#f4f4ef' 75; Label ('H 61'+$degree+'F') 52 285 14 '#f4f4ef' 75
            Label '6,482' 169 257 34 '#f4f4ef' 112; Label '42' 178 307 23 '#f4f4ef' 53; Label '380' 262 307 23 '#f4f4ef' 57
            FillGauge 170 (6482/8000) '#ff6a15'; FillGauge 200 (42/60) '#00dbef'; FillGauge 230 (380/500) '#76f400'
            Label '8,000' 316 330 13 '#eeeeeb' 43; Label '60' 316 347 13 '#eeeeeb' 43; Label '500' 316 365 13 '#eeeeeb' 43
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
