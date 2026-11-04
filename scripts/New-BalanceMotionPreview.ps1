[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
$root=Split-Path -Parent $PSScriptRoot
$outputRoot=Join-Path $root 'docs\previews'
[xml]$face=Get-Content (Join-Path $root 'watchface\src\main\res\raw\watchface.xml') -Raw -Encoding utf8
$part=$face.SelectSingleNode('//PartImage[@name="balance_oscillator"]')
$perspective=$face.SelectSingleNode('//Group[@name="balance_perspective"]')
$animation=$part.Transform.Animation
$duration=[double]::Parse($animation.duration,[cultureinfo]::InvariantCulture)
$fps=[int]$animation.fps
$controls=@($animation.controls.Split(' ') | ForEach-Object { [double]::Parse($_,[cultureinfo]::InvariantCulture) })
if($animation.interpolation -ne 'CUBIC_BEZIER' -or $animation.repeat -ne '0') { throw 'Update the preview renderer for the changed native animation.' }
$scaleY=[double]::Parse($perspective.scaleY,[cultureinfo]::InvariantCulture)
$width=[int]$part.width; $height=[int]$part.height
$cx=[double]$perspective.x+$width/2; $cy=[double]$perspective.y+$height/2
$angles=[regex]::Match($part.Transform.value,'^\[SECOND\] % 2 == 0 \? (-?\d+) : (-?\d+)$')
if(-not $angles.Success) { throw 'Update the preview renderer for the changed angle expression.' }
$left=[double]$angles.Groups[1].Value; $right=[double]$angles.Groups[2].Value
# Read both end angles from WFF without adding a runtime millisecond source.

function Bezier([double]$t,[double]$p1,[double]$p2) {
    return 3*(1-$t)*(1-$t)*$t*$p1+3*(1-$t)*$t*$t*$p2+$t*$t*$t
}
function Eased([double]$fraction) {
    $lo=0.0; $hi=1.0
    for($j=0;$j -lt 24;$j++) {
        $mid=($lo+$hi)/2
        if((Bezier $mid $controls[0] $controls[2]) -lt $fraction) { $lo=$mid } else { $hi=$mid }
    }
    return Bezier (($lo+$hi)/2) $controls[1] $controls[3]
}
function Add-GifFrame($encoder,[System.Drawing.Bitmap]$bitmap) {
    $stream=New-Object IO.MemoryStream
    try {
        $bitmap.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png); $stream.Position=0
        $source=[System.Windows.Media.Imaging.BitmapFrame]::Create($stream,[System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,[System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
        $encoder.Frames.Add($source)
    } finally { $stream.Dispose() }
}
function Set-GifTiming([string]$path,[int[]]$delays) {
    # WPF encodes the image frames but drops their timing/loop metadata. Walk
    # GIF blocks (never search compressed pixels) to set the delays explicitly.
    $bytes=[IO.File]::ReadAllBytes($path)
    $offset=13
    if($bytes[10] -band 128) { $offset+=3*(1 -shl (($bytes[10] -band 7)+1)) }
    $headerLength=$offset; $frame=0
    while($offset -lt $bytes.Length) {
        if($bytes[$offset] -eq 59) { break }
        if($bytes[$offset] -eq 33) {
            if($bytes[$offset+1] -eq 249) {
                if($bytes[$offset+2] -ne 4 -or $frame -ge $delays.Count) { throw 'Unexpected GIF control block' }
                $bytes[$offset+3]=($bytes[$offset+3] -band 3) -bor 4
                $bytes[$offset+4]=$delays[$frame] -band 255
                $bytes[$offset+5]=($delays[$frame] -shr 8) -band 255
                $frame++
            }
            $offset+=2
        } elseif($bytes[$offset] -eq 44) {
            $offset+=10
            if($bytes[$offset-1] -band 128) { $offset+=3*(1 -shl (($bytes[$offset-1] -band 7)+1)) }
            $offset++ # LZW minimum code size.
        } else { throw "Unexpected GIF block at $offset" }
        do { $size=$bytes[$offset]; $offset+=1+$size } while($size -ne 0)
    }
    if($frame -ne $delays.Count) { throw 'GIF frame count does not match the animation timeline' }
    $loop=[byte[]](@(33,255,11)+[Text.Encoding]::ASCII.GetBytes('NETSCAPE2.0')+@(3,1,0,0,0))
    $file=[IO.File]::Create($path)
    try {
        $file.Write($bytes,0,$headerLength); $file.Write($loop,0,$loop.Length)
        $file.Write($bytes,$headerLength,($bytes.Length-$headerLength))
    } finally { $file.Dispose() }
}

$wheel=[System.Drawing.Image]::FromFile((Join-Path $root 'watchface\src\main\res\drawable-nodpi\balance_wheel.png'))
$overlay=[System.Drawing.Image]::FromFile((Join-Path $outputRoot 'balance-overlay.png'))
$full=New-Object System.Windows.Media.Imaging.GifBitmapEncoder
$detail=New-Object System.Windows.Media.Imaging.GifBitmapEncoder
try {
    $times=@(0.0)
    for($time=1.0/$fps;$time -lt $duration;$time+=1.0/$fps) { $times+=$time }
    $times+=$duration
    $frameNumber=0
    $delays=New-Object 'Collections.Generic.List[int]'
    foreach($direction in @(@($right,$left),@($left,$right))) {
        for($i=0;$i -lt $times.Count;$i++) {
            $progress=Eased ($times[$i]/$duration)
            $angle=$direction[0]+($direction[1]-$direction[0])*$progress
            $next=1.0; if($i+1 -lt $times.Count) { $next=$times[$i+1] }
            $delay=[int][math]::Round($next*100)-[int][math]::Round($times[$i]*100)
            $delays.Add($delay)
            $bitmap=New-Object Drawing.Bitmap(450,450)
            $graphics=[Drawing.Graphics]::FromImage($bitmap)
            $close=New-Object Drawing.Bitmap(640,224)
            $zoom=[Drawing.Graphics]::FromImage($close)
            try {
                $graphics.Clear([Drawing.Color]::Black)
                $graphics.InterpolationMode='HighQualityBicubic'
                $state=$graphics.Save()
                $graphics.TranslateTransform($cx,$cy); $graphics.ScaleTransform(1,$scaleY); $graphics.RotateTransform($angle)
                $graphics.DrawImage($wheel,(-$width/2),(-$height/2),$width,$height)
                $graphics.Restore($state); $graphics.DrawImage($overlay,0,0,450,450)
                $zoom.InterpolationMode='HighQualityBicubic'
                $zoom.DrawImage($bitmap,[Drawing.Rectangle]::new(0,0,640,224),130,188,190,78,[Drawing.GraphicsUnit]::Pixel)
                Add-GifFrame $full $bitmap
                Add-GifFrame $detail $close
            } finally { $zoom.Dispose(); $close.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
            $frameNumber++
        }
    }
    foreach($pair in @(@($full,'balance-motion.gif'),@($detail,'balance-detail.gif'))) {
        $file=[IO.File]::Create((Join-Path $outputRoot $pair[1]))
        try { $pair[0].Save($file) } finally { $file.Dispose() }
        Set-GifTiming (Join-Path $outputRoot $pair[1]) $delays.ToArray()
    }
    Write-Host "Animated previews: $frameNumber frames per two-second loop, ${duration}s motion per second; clock hands held still."
} finally { $overlay.Dispose(); $wheel.Dispose() }
