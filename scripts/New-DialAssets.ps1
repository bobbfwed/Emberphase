[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'watchface\src\main\res\drawable-nodpi'
New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null

# Original vector construction, referenced to Mockup Images/Original Mockup.png.
# Only static artwork is baked. All displayed runtime values live in WFF XML.
function C([string]$hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
function Brush([string]$hex) { New-Object System.Drawing.SolidBrush((C $hex)) }
function Pen([string]$hex, [float]$width) { New-Object System.Drawing.Pen((C $hex), $width) }
function Canvas([int]$width, [int]$height) {
    $script:logicalWidth=$width; $script:logicalHeight=$height
    $script:bitmap = New-Object System.Drawing.Bitmap(($width*2), ($height*2))
    $script:g = [System.Drawing.Graphics]::FromImage($script:bitmap)
    $script:g.SmoothingMode = 'AntiAlias'
    $script:g.TextRenderingHint = 'AntiAliasGridFit'
    $script:g.Clear([System.Drawing.Color]::Transparent)
    $script:g.ScaleTransform(2,2)
}
function Save([string]$name) {
    $output = New-Object System.Drawing.Bitmap($script:logicalWidth, $script:logicalHeight)
    $outputGraphics = [System.Drawing.Graphics]::FromImage($output)
    $outputGraphics.CompositingMode = 'SourceCopy'
    $outputGraphics.InterpolationMode = 'HighQualityBicubic'
    $outputGraphics.DrawImage($script:bitmap, 0,0,$script:logicalWidth,$script:logicalHeight)
    $output.Save((Join-Path $assetRoot ($name+'.png')), [System.Drawing.Imaging.ImageFormat]::Png)
    $outputGraphics.Dispose(); $output.Dispose(); $script:g.Dispose(); $script:bitmap.Dispose()
}
function Ellipse([string]$color,[float]$x,[float]$y,[float]$w,[float]$h) {
    $b=Brush $color; $script:g.FillEllipse($b,$x,$y,$w,$h); $b.Dispose()
}
function Line([string]$color,[float]$thickness,[float]$x1,[float]$y1,[float]$x2,[float]$y2) {
    $p=Pen $color $thickness; $p.StartCap='Round'; $p.EndCap='Round'
    $script:g.DrawLine($p,$x1,$y1,$x2,$y2); $p.Dispose()
}
function RoundPath([float]$x,[float]$y,[float]$w,[float]$h,[float]$r) {
    $p=New-Object System.Drawing.Drawing2D.GraphicsPath
    $d=$r*2
    $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc(($x+$w-$d),$y,$d,$d,270,90)
    $p.AddArc(($x+$w-$d),($y+$h-$d),$d,$d,0,90); $p.AddArc($x,($y+$h-$d),$d,$d,90,90)
    $p.CloseFigure(); return $p
}
function RoundFill([string]$color,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r) {
    $p=RoundPath $x $y $w $h $r; $b=Brush $color; $script:g.FillPath($b,$p); $b.Dispose(); $p.Dispose()
}
function Label([string]$text,[float]$x,[float]$y,[float]$size,[string]$color,[float]$width=80) {
    $font=New-Object System.Drawing.Font('Arial Narrow',$size,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
    $format=[System.Drawing.StringFormat]::GenericTypographic.Clone()
    $format.Alignment='Center'; $format.LineAlignment='Center'
    $format.FormatFlags='NoWrap,NoClip'
    $b=Brush $color; $script:g.DrawString($text,$font,$b,([System.Drawing.RectangleF]::new($x,$y,$width,($size*1.35))),$format)
    $b.Dispose(); $font.Dispose(); $format.Dispose()
}
function Feet([float]$x,[float]$y,[string]$color) {
    Ellipse $color $x $y 4 8; Ellipse $color ($x+6) ($y-3) 4 8
    Ellipse $color $x ($y+9) 3 3; Ellipse $color ($x+6) ($y+6) 3 3
}
function Runner([float]$x,[float]$y,[string]$color) {
    Ellipse $color ($x+7) $y 5 5
    Line $color 2.4 ($x+8) ($y+7) ($x+5) ($y+13)
    Line $color 2.4 ($x+8) ($y+7) ($x+13) ($y+10)
    Line $color 2.4 ($x+5) ($y+13) ($x+1) ($y+18)
    Line $color 2.4 ($x+5) ($y+13) ($x+10) ($y+16)
    Line $color 2.4 ($x+10) ($y+16) ($x+8) ($y+21)
    Line $color 2 ($x+6) ($y+7) ($x+2) ($y+9)
}
function Flame([float]$x,[float]$y,[string]$color) {
    $p=New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddBezier(($x+8),$y,($x+15),($y+7),($x+7),($y+8),($x+14),($y+11))
    $p.AddBezier(($x+14),($y+11),($x+19),($y+24),($x-3),($y+25),($x+1),($y+12))
    $p.AddBezier(($x+1),($y+12),($x+1),($y+8),($x+8),($y+6),($x+8),$y)
    $p.CloseFigure(); $b=Brush $color; $script:g.FillPath($b,$p); $b.Dispose(); $p.Dispose()
}
function RingPoint([float]$radius,[float]$angle) {
    $a=$angle*[math]::PI/180
    return [System.Drawing.PointF]::new((225+$radius*[math]::Sin($a)),(225-$radius*[math]::Cos($a)))
}
function Track([float]$radius) {
    # All three channels share the hand spindle, with equally spaced radii.
    $rect=[System.Drawing.RectangleF]::new((225-$radius),(225-$radius),($radius*2),($radius*2))
    foreach($layer in @(@('#010202',20),@('#292d2d',17),@('#07090a',13))) {
        $p=Pen $layer[0] $layer[1]; $p.StartCap='Round'; $p.EndCap='Round'
        $script:g.DrawArc($p,$rect,124,-68); $p.Dispose()
    }
    # Narrow bevels catch the light, leaving a dark recessed toothed bed.
    foreach($edge in @(@(($radius-7),'#414645'),@(($radius+7),'#171b1c'))) {
        $r=[float]$edge[0]; $p=Pen $edge[1] 0.65
        $script:g.DrawArc($p,([System.Drawing.RectangleF]::new((225-$r),(225-$r),($r*2),($r*2))),124,-68); $p.Dispose()
    }
    # Small radial rack teeth are baked into the dial. The opaque live band
    # covers them as progress advances, exposing teeth only in unfilled areas.
    for($t=0;$t -lt 31;$t++) {
        $angle=213-2.2*$t
        $points=[System.Drawing.PointF[]]@((RingPoint ($radius-4.6) ($angle-0.48)),(RingPoint ($radius+4.6) ($angle-0.38)),(RingPoint ($radius+4.6) ($angle+0.38)),(RingPoint ($radius-4.6) ($angle+0.48)))
        $b=Brush '#191d1f'; $script:g.FillPolygon($b,$points); $b.Dispose()
        $p=Pen '#282d2e' 0.55; $script:g.DrawLine($p,$points[0],$points[1]); $p.Dispose()
    }
}

# Twin-moon wheel, rotating once per two lunations behind a fixed aperture.
Canvas 180 180
Ellipse '#02040a' 0 0 180 180; Ellipse '#071627' 3 3 174 174
$random=New-Object System.Random(950)
for($i=0;$i -lt 100;$i++) {
    $x=$random.Next(8,171); $y=$random.Next(8,171)
    if(([math]::Pow($x-90,2)+[math]::Pow($y-90,2)) -lt 7200) {
        $d=1+($i%3)*0.4; Ellipse '#8297aa' $x $y $d $d
    }
}
foreach($cy in @(35,145)) {
    $moonRect=[System.Drawing.RectangleF]::new(64,($cy-26),52,52)
    $moonBrush=New-Object System.Drawing.Drawing2D.LinearGradientBrush($moonRect,(C '#fff2d7'),(C '#8d8b83'),45)
    $script:g.FillEllipse($moonBrush,$moonRect); $moonBrush.Dispose()
    $moonClip=$script:g.Save(); $script:g.SetClip($moonRect)
    foreach($crater in @(@(77,-10,10),@(96,1,13),@(84,13,7),@(102,-15,6),@(72,8,4))) {
        $x=[float]$crater[0]; $y=$cy+[float]$crater[1]; $d=[float]$crater[2]
        Ellipse '#888b87' $x $y $d $d; Ellipse '#b9b8ac' ($x+1) ($y+1) ($d-2) ($d-2)
    }
    $script:g.Restore($moonClip)
}
Save 'moon_disc'

# One shared balance wheel, centered on the dial. Only its upper half carries
# a pale rim. Rocking the wheel reveals that rim through the arc openings;
# the unlit half stays a dark mechanical texture. The band is wide enough to
# fill the concentric slots cut into the dial.
Canvas 148 148
Ellipse '#050606' 4 4 140 140
Ellipse '#101313' 10 10 128 128
$p=Pen '#222624' 4; $script:g.DrawEllipse($p,9,9,130,130); $p.Dispose()
for($tooth=0;$tooth -lt 72;$tooth++) {
    $a=$tooth*5*[math]::PI/180
    $color='#242822'; if($tooth -ge 36) { $color='#777461' }
    Line $color 1.6 (74+52*[math]::Cos($a)) (74+52*[math]::Sin($a)) (74+73*[math]::Cos($a)) (74+73*[math]::Sin($a))
}
$rimColors=@('#31362f','#55594d','#777967','#a5a18a','#bbb39b','#898774','#5e6255','#373d34')
for($i=0;$i -lt $rimColors.Count;$i++) {
    $radius=54+$i*2.3
    $p=Pen $rimColors[$i] 1.6
    $script:g.DrawArc($p,([System.Drawing.RectangleF]::new((74-$radius),(74-$radius),($radius*2),($radius*2))),180,180)
    $p.Dispose()
}
Save 'balance_wheel'

# Bevelled black dial, minute track, drums, and recessed activity channels.
Canvas 450 450
Ellipse '#181818' 1 1 448 448
$p=Pen '#a9a9a5' 0.8; $script:g.DrawEllipse($p,2,2,446,446); $p.Dispose()
Ellipse '#020202' 5 5 440 440; Ellipse '#101112' 31 31 388 388
$facePath=New-Object System.Drawing.Drawing2D.GraphicsPath; $facePath.AddEllipse(32,32,386,386)
$faceBrush=New-Object System.Drawing.Drawing2D.PathGradientBrush($facePath)
$faceBrush.CenterColor=C '#121414'; $faceBrush.SurroundColors=@((C '#030404'))
$script:g.FillPath($faceBrush,$facePath); $faceBrush.Dispose(); $facePath.Dispose()
for($index=0;$index -lt 60;$index++) {
    $angle=$index*6*[math]::PI/180
    $hour=($index%5 -eq 0); $outer=213; $inner=202; $thickness=2.8; $color='#ff5d0a'
    if($hour) { $inner=197; $thickness=6; $color='#eeeeea' }
    if($index -eq 0) { continue }
    Line $color $thickness (225+$inner*[math]::Sin($angle)) (225-$inner*[math]::Cos($angle)) (225+$outer*[math]::Sin($angle)) (225-$outer*[math]::Cos($angle))
}
foreach($hour in @(1,2,3,4,8,9,10,11,12)) {
    $a=$hour*30*[math]::PI/180; $radius=174; $size=26
    if($hour -eq 12) { $radius=201; $size=29 }
    $x=225+$radius*[math]::Sin($a); $y=225-$radius*[math]::Cos($a)
    Label ([string]$hour) ($x-25) ($y-$size*0.65) $size '#f4f4f0' 50
}
$aperture=New-Object System.Drawing.Drawing2D.GraphicsPath
# Center the outer arch on the wheel pivot (225,130). Its 87-unit radius
# clears the moon's 55-unit orbit plus 26-unit radius by 6 units throughout
# the cycle. The former arch was centered higher and shaved off the moon rim.
$archStart=180+[math]::Asin(25/87)*180/[math]::PI
$archEdge=[math]::Sqrt(87*87-25*25)
$aperture.AddArc(138,43,174,174,$archStart,(540-2*$archStart))
$aperture.AddBezier((225+$archEdge),105,291,88,258,88,246,108)
$aperture.AddBezier(246,108,231,103,219,103,204,108)
$aperture.AddBezier(204,108,192,88,159,88,(225-$archEdge),105); $aperture.CloseFigure()
$p=Pen '#494b48' 3; $script:g.DrawPath($p,$aperture); $p.Dispose()
$script:g.CompositingMode='SourceCopy'; $transparent=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Transparent)
$script:g.FillPath($transparent,$aperture); $transparent.Dispose(); $script:g.CompositingMode='SourceOver'; $aperture.Dispose()

# Concentric arc openings, centered on the dial. A chamfer and a darker inner
# wall show the thickness of the metal plate; the clear slot is the view past
# that backing onto the wheel. The live hands render above both openings.
function Add-RingSector([System.Drawing.Drawing2D.GraphicsPath]$path,[float]$inner,[float]$outer,[float]$start,[float]$sweep) {
    $path.AddArc((225-$outer),(225-$outer),($outer*2),($outer*2),$start,$sweep)
    $path.AddArc((225-$inner),(225-$inner),($inner*2),($inner*2),($start+$sweep),(-$sweep))
    $path.CloseFigure()
}
foreach($center in @(180,0)) {
    $lip=New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RingSector $lip 36 88 ($center-19.5) 39
    $wall=New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RingSector $wall 42 82 ($center-17.5) 35
    $hole=New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RingSector $hole 48 76 ($center-15.5) 31
    $b=Brush '#1a1e1a'; $script:g.FillPath($b,$lip); $b.Dispose()
    $p=Pen '#6a6e64' 1.15; $script:g.DrawPath($p,$lip); $p.Dispose()
    $b=Brush '#070808'; $script:g.FillPath($b,$wall); $b.Dispose()
    $p=Pen '#2a2e2a' 0.9; $script:g.DrawPath($p,$wall); $p.Dispose()
    $script:g.CompositingMode='SourceCopy'
    $clear=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Transparent)
    $script:g.FillPath($clear,$hole); $clear.Dispose()
    $script:g.CompositingMode='SourceOver'
    $hole.Dispose(); $wall.Dispose(); $lip.Dispose()
}

# The drum body sits lower, with a cylindrical light band behind live text.
# A separate foreground bezel occludes the receding rows after text is drawn.
RoundFill '#030404' 128 128 194 62 8
foreach($drumX in @(135,195,255)) {
    $rect=[System.Drawing.RectangleF]::new($drumX,134,60,50)
    $b=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,(C '#030404'),(C '#030404'),90)
    $blend=New-Object System.Drawing.Drawing2D.ColorBlend(5)
    $blend.Colors=@((C '#030404'),(C '#181c1e'),(C '#111416'),(C '#1c2022'),(C '#020303'))
    $blend.Positions=[single[]]@(0,0.24,0.5,0.76,1)
    $b.InterpolationColors=$blend; $script:g.FillRectangle($b,$rect); $b.Dispose()
}
# Move the battery assembly inward so the inner-radius 3 remains unobstructed.
$batteryState=$script:g.Save(); $script:g.TranslateTransform(-8,0)
RoundFill '#41413f' 361 161 33 129 7; RoundFill '#090909' 363 163 29 125 6
RoundFill '#000000' 366 166 23 119 4
for($i=0;$i -le 10;$i++) { $y=175+$i*10; Line '#b3b9b7' 1 374 $y 381 $y }
Label 'F' 343 169 14 '#e7e8e6' 16; Label 'BAT' 324 216 13 '#e7e8e6' 36; Label 'E' 343 273 14 '#e7e8e6' 16
RoundFill '#202016' 366 274 5 13 2; RoundFill '#241415' 385 274 5 13 2
$script:g.Restore($batteryState)
Label 'STEPS' 188 292 12 '#e2e3df' 74
Runner 160 310 '#00d8eb'; Label 'MIN' 176 328 11 '#e2e3df' 42
Flame 240 309 '#72f000'; Label 'CAL' 257 328 11 '#e2e3df' 50
Track 150; Track 168; Track 186
# Continue each track's radius just beyond its left end (222 degrees).
# Icon offsets account for the centers of the individual drawing primitives.
$stepsIcon=RingPoint 150 222; $minutesIcon=RingPoint 168 222; $caloriesIcon=RingPoint 186 222
Feet ($stepsIcon.X-5) ($stepsIcon.Y-4.5) '#ff6814'
$iconState=$script:g.Save(); $script:g.TranslateTransform($minutesIcon.X,$minutesIcon.Y); $script:g.ScaleTransform(0.72,0.72)
Runner -7 -10.5 '#00d8eb'; $script:g.Restore($iconState)
$iconState=$script:g.Save(); $script:g.TranslateTransform($caloriesIcon.X,$caloriesIcon.Y); $script:g.ScaleTransform(0.72,0.72)
Flame -7.5 -11.5 '#72f000'; $script:g.Restore($iconState)
Save 'dial_frame'

# Foreground calendar rim: transparent aperture, opaque lips, and shadows over
# the compressed neighboring labels. Cropped to avoid a full-face extra layer.
Canvas 200 68
$script:g.TranslateTransform(-125,-125)
RoundFill '#020303' 126 127 198 66 9
RoundFill '#5b615f' 128 128 194 62 8
RoundFill '#151819' 129 130 192 59 7
RoundFill '#343a3c' 132 133 186 53 5
$opening=RoundPath 135 135 180 48 3
$script:g.CompositingMode='SourceCopy'; $clear=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Transparent)
$script:g.FillPath($clear,$opening); $clear.Dispose(); $script:g.CompositingMode='SourceOver'
$clipState=$script:g.Save(); $script:g.SetClip($opening)
foreach($strip in @(@(135,145,175,0),@(175,183,0,200))) {
    $rect=[System.Drawing.RectangleF]::new(135,$strip[0],180,($strip[1]-$strip[0]))
    $b=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,([System.Drawing.Color]::FromArgb($strip[2],0,0,0)),([System.Drawing.Color]::FromArgb($strip[3],0,0,0)),90)
    $script:g.FillRectangle($b,$rect); $b.Dispose()
}
foreach($divider in @(194,254)) {
    Line '#010202' 4 $divider 135 $divider 183
    Line '#616665' 0.8 ($divider-1.5) 137 ($divider-1.5) 181
    Line '#262b2d' 1 ($divider+1) 135 ($divider+1) 183
}
$script:g.Restore($clipState); $opening.Dispose()
Line '#080b0c' 1.2 138 135 312 135
Line '#686e6a' 0.7 138 184 312 184
Save 'calendar_bezel'

Canvas 22 150
$hand=New-Object System.Drawing.Drawing2D.GraphicsPath
$hand.AddPolygon([System.Drawing.PointF[]]@([System.Drawing.PointF]::new(11,1),[System.Drawing.PointF]::new(18,11),[System.Drawing.PointF]::new(17,95),[System.Drawing.PointF]::new(21,127),[System.Drawing.PointF]::new(16,145),[System.Drawing.PointF]::new(6,145),[System.Drawing.PointF]::new(1,127),[System.Drawing.PointF]::new(5,95),[System.Drawing.PointF]::new(4,11)))
$b=Brush '#f5f5ef'; $script:g.FillPath($b,$hand); $b.Dispose(); $hand.Dispose()
RoundFill '#050606' 7 14 8 72 3
Save 'hour_hand'
Canvas 16 198
$hand=New-Object System.Drawing.Drawing2D.GraphicsPath
$hand.AddPolygon([System.Drawing.PointF[]]@([System.Drawing.PointF]::new(8,1),[System.Drawing.PointF]::new(15,10),[System.Drawing.PointF]::new(12,151),[System.Drawing.PointF]::new(15,180),[System.Drawing.PointF]::new(11,193),[System.Drawing.PointF]::new(5,193),[System.Drawing.PointF]::new(1,180),[System.Drawing.PointF]::new(4,151),[System.Drawing.PointF]::new(1,10)))
$b=Brush '#f5f5ef'; $script:g.FillPath($b,$hand); $b.Dispose(); $hand.Dispose()
RoundFill '#050606' 5 14 6 133 2
Save 'minute_hand'

# Always-on skeleton hands use orange metal and transparent cutouts on black.
# Draw from geometry so a tint cannot accidentally fill the skeleton openings.
foreach($kind in @('hour','minute')) {
    if($kind -eq 'hour') {
        Canvas 22 150
        $points=@(@(11,1),@(18,11),@(17,95),@(21,127),@(16,145),@(6,145),@(1,127),@(5,95),@(4,11))
        $cutout=RoundPath 7 14 8 72 3
    } else {
        Canvas 16 198
        $points=@(@(8,1),@(15,10),@(12,151),@(15,180),@(11,193),@(5,193),@(1,180),@(4,151),@(1,10))
        $cutout=RoundPath 5 14 6 133 2
    }
    $polygon=[System.Drawing.PointF[]]@($points | ForEach-Object { [System.Drawing.PointF]::new($_[0],$_[1]) })
    $rect=[System.Drawing.RectangleF]::new(0,0,$script:logicalWidth,$script:logicalHeight)
    $b=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,(C '#ef5926'),(C '#bb3b16'),45)
    $script:g.FillPolygon($b,$polygon); $b.Dispose()
    $script:g.CompositingMode='SourceCopy'; $clear=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Transparent)
    $script:g.FillPath($clear,$cutout); $clear.Dispose(); $cutout.Dispose(); $script:g.CompositingMode='SourceOver'
    Save ('ambient_'+$kind+'_hand')
}
Canvas 28 28
Ellipse '#d94c20' 1 1 26 26
Ellipse '#000000' 8.5 8.5 11 11
Save 'ambient_center_cap'
Canvas 21 13
RoundFill '#db4c1b' 1 1 19 11 2
Save 'ambient_battery_slider'

Canvas 6 230
Line '#ff5b07' 2.6 3 2 3 228; Line '#ffc26b' 0.7 2 3 2 226
Save 'second_hand'
Canvas 28 28
Ellipse '#070808' 0 0 28 28
$rect=[System.Drawing.RectangleF]::new(1,1,26,26)
$b=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,(C '#ffb15b'),(C '#e24100'),45)
$script:g.FillEllipse($b,$rect); $b.Dispose(); Ellipse '#070909' 8.5 8.5 11 11
Save 'center_cap'
Canvas 21 13
RoundFill '#8e2900' 0 0 21 13 2
$rect=[System.Drawing.RectangleF]::new(1,1,19,11)
$b=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,(C '#ffb056'),(C '#ff5900'),90)
$p=RoundPath 1 1 19 11 2; $script:g.FillPath($b,$p); $b.Dispose(); $p.Dispose()
Save 'battery_slider'

Canvas 450 450
foreach($i in @(0,5,10,15,20,25,30,35,40,45,50,55)) {
    $a=$i*6*[math]::PI/180
    $p=Pen '#deded8' 6; $p.StartCap='Flat'; $p.EndCap='Flat'
    $script:g.DrawLine($p,[float](225+197*[math]::Sin($a)),[float](225-197*[math]::Cos($a)),[float](225+213*[math]::Sin($a)),[float](225-213*[math]::Cos($a))); $p.Dispose()
}
Label '12' 200 34 27 '#deded8' 50; Label '3' 387 207 27 '#deded8' 24
Label '6' 213 381 27 '#deded8' 24; Label '9' 39 207 27 '#deded8' 24
$outline=RoundPath 353 161 33 129 6; $p=Pen '#c5461c' 1; $script:g.DrawPath($p,$outline); $p.Dispose(); $outline.Dispose()
for($i=0;$i -le 10;$i++) { $y=175+$i*10; Line '#b54220' 0.8 366 $y 373 $y }
Label 'F' 335 169 14 '#d74d20' 16; Label 'BAT' 316 216 13 '#d74d20' 36; Label 'E' 335 273 14 '#d74d20' 16
RoundFill '#211a09' 358 274 5 13 2; RoundFill '#25100c' 377 274 5 13 2
Save 'ambient_indices'

function Sun { Ellipse '#ffdc26' 10 8 20 20; for($i=0;$i -lt 8;$i++) { $a=$i*[math]::PI/4; Line '#ffdc26' 2 (20+13*[math]::Sin($a)) (18-13*[math]::Cos($a)) (20+17*[math]::Sin($a)) (18-17*[math]::Cos($a)) } }
function Moon { Ellipse '#e8e7d6' 9 5 23 23; Ellipse '#000000' 18 2 20 22 }
function Cloud { Ellipse '#b7c5cf' 5 19 29 14; Ellipse '#d5e0e6' 11 11 19 20; Ellipse '#e2e9ec' 2 23 35 11 }
for($condition=0;$condition -le 17;$condition++) {
    Canvas 40 40
    switch($condition) {
        0 { Label '?' 3 3 26 '#7d8b91' 34 }
        1 { Sun }
        8 { Sun }
        14 { Sun; Cloud }
        16 { Moon }
        17 { Moon; Cloud }
        default {
            Cloud
            if($condition -in @(4,6,10,12)) { foreach($x in @(10,20,30)) { Line '#39bfe6' 2 $x 34 ($x-2) 39 } }
            if($condition -in @(5,7,10,11)) { foreach($x in @(10,20,30)) { Line '#d2eff9' 1 ($x-2) 36 ($x+2) 36; Line '#d2eff9' 1 $x 34 $x 38 } }
            if($condition -eq 9) { Line '#ffd328' 3 22 25 16 33; Line '#ffd328' 3 16 33 22 33; Line '#ffd328' 3 22 33 18 39 }
            if($condition -in @(3,13,15)) { Line '#829ca8' 1.5 3 34 34 34; Line '#829ca8' 1.5 8 38 37 38 }
        }
    }
    Save ('wx_'+$condition)
}

Write-Host "Static dial, hand, moon, and weather artwork written to $assetRoot"
