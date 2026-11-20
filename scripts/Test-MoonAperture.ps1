[CmdletBinding()]
param([string]$AssetPath)
$ErrorActionPreference='Stop'
if(-not $AssetPath) { $AssetPath=Join-Path $PSScriptRoot '..\watchface\src\main\res\drawable-nodpi' }
$AssetPath=(Resolve-Path -LiteralPath $AssetPath).Path
Add-Type -AssemblyName System.Drawing
# Moon window geometry: carrier pivot (225,116) on the visible horizon, path
# radius 38, moon radius 26; cup frames are 58x58 with the moon at (29,29).
$R=26; $pivotX=225; $pivotY=116; $orbit=38

# Alpha channel of an image as a byte array (row-major), read once.
function Get-Alpha([string]$name) {
    $bitmap=[System.Drawing.Bitmap]::FromFile((Join-Path $AssetPath ($name+'.png')))
    try {
        $rect=[System.Drawing.Rectangle]::new(0,0,$bitmap.Width,$bitmap.Height)
        $data=$bitmap.LockBits($rect,[System.Drawing.Imaging.ImageLockMode]::ReadOnly,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $bytes=New-Object byte[] ($data.Stride*$bitmap.Height)
        [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0,$bytes,0,$bytes.Length); $bitmap.UnlockBits($data)
        $alpha=New-Object byte[] ($bitmap.Width*$bitmap.Height)
        for($i=0;$i -lt $alpha.Length;$i++) { $alpha[$i]=$bytes[$i*4+3] }
        return [pscustomobject]@{ Width=$bitmap.Width; Height=$bitmap.Height; Alpha=$alpha }
    } finally { $bitmap.Dispose() }
}

# 1. Cup frames: present (00..59 without 30), 58x58, true lit fraction, mirrored.
if(Test-Path -LiteralPath (Join-Path $AssetPath 'moon_cup_30.png')) { throw 'moon_cup_30.png must not exist: the full moon has no cup.' }
$lit=@{}; $frames=@{}
for($k=0;$k -lt 60;$k++) {
    if($k -eq 30) { continue }
    $name='moon_cup_{0:00}' -f $k
    if(-not (Test-Path -LiteralPath (Join-Path $AssetPath ($name+'.png')))) { throw "$name.png is missing." }
    $frame=Get-Alpha $name
    if($frame.Width -ne 58 -or $frame.Height -ne 58) { throw "$name.png is $($frame.Width)x$($frame.Height), expected 58x58." }
    $total=0; $uncovered=0
    for($y=0;$y -lt 58;$y++) { for($x=0;$x -lt 58;$x++) {
        if([math]::Pow($x+0.5-29,2)+[math]::Pow($y+0.5-29,2) -gt $R*$R) { continue }
        $total++
        # The cast shadow is at most half opaque; the cup itself is opaque.
        if($frame.Alpha[$y*58+$x] -lt 160) { $uncovered++ }
    } }
    $a=-90+3*$k; $expected=(1+[math]::Cos(2*$a*[math]::PI/180))/2; $actual=$uncovered/$total
    if([math]::Abs($actual-$expected) -gt 0.03) { throw ('{0}: {1:P1} of the moon is uncovered; the phase at {2} degrees needs {3:P1}.' -f $name,$actual,$a,$expected) }
    $lit[$k]=$actual; $frames[$k]=$frame
}
$worstMirror=0.0
for($k=1;$k -lt 30;$k++) {
    $difference=[math]::Abs($lit[$k]-$lit[60-$k])
    # Raster differences leave up to ~0.2 px; a one-pixel misalignment shows as 2+ points.
    if($difference -gt 0.01) { throw ('Frames {0:00} and {1:00} are not mirror images: lit {2:P1} vs {3:P1}.' -f $k,(60-$k),$lit[$k],$lit[60-$k]) }
    $sum=0
    for($y=0;$y -lt 58;$y++) { for($x=0;$x -lt 58;$x++) { $sum+=[math]::Abs([int]$frames[$k].Alpha[$y*58+$x]-[int]$frames[60-$k].Alpha[$y*58+57-$x]) } }
    $mean=$sum/(58*58); if($mean -gt $worstMirror) { $worstMirror=$mean }
    if($mean -gt 2) { throw ('Frames {0:00} and {1:00} differ by {2:N2} alpha levels on average after mirroring.' -f $k,(60-$k),$mean) }
}
Write-Host ('PASS: 59 cup frames (no 30), 58x58; uncovered moon matches (1 + cos 2a)/2 within 3 points; k and 60-k mirror (mean alpha difference at most {0:N2}).' -f $worstMirror)

# 2. The dial frame shows each moon only above the horizon.
$dial=Get-Alpha 'dial_frame'
function Get-Visible([double]$angle) {
    $rad=$angle*[math]::PI/180; $cx=$pivotX+$orbit*[math]::Sin($rad); $cy=$pivotY-$orbit*[math]::Cos($rad)
    $total=0; $visible=0
    for($y=[int][math]::Floor($cy-$R);$y -le $cy+$R;$y++) { for($x=[int][math]::Floor($cx-$R);$x -le $cx+$R;$x++) {
        if([math]::Pow($x+0.5-$cx,2)+[math]::Pow($y+0.5-$cy,2) -gt $R*$R) { continue }
        $total++; if($dial.Alpha[$y*450+$x] -lt 128) { $visible++ }
    } }
    return $visible/$total
}
foreach($angle in @(-90,90)) {
    $fraction=Get-Visible $angle
    if($fraction -lt 0.45 -or $fraction -gt 0.55) { throw ('At new moon the moon at {0} degrees shows {1:P1}; expected half.' -f $angle,$fraction) }
}
$top=Get-Visible 0; $bottom=Get-Visible 180
if($top -lt 1) { throw ('At full the top moon shows only {0:P1}.' -f $top) }
if($bottom -gt 0) { throw ('At full the bottom moon shows {0:P1}; it must be hidden.' -f $bottom) }
Write-Host ('PASS: at new moon both moons show half ({0:P1} / {1:P1}); at full the top moon is fully visible and the bottom one hidden.' -f (Get-Visible -90),(Get-Visible 90))

# 3. The frame is opaque over the carrier's whole lower half (pivot +/- 70).
$checked=0
for($y=$pivotY+1;$y -lt $pivotY+71;$y++) { for($x=$pivotX-70;$x -lt $pivotX+70;$x++) {
    if([math]::Pow($x+0.5-$pivotX,2)+[math]::Pow($y+0.5-$pivotY,2) -gt 70*70) { continue }
    if($dial.Alpha[$y*450+$x] -lt 250) { throw "The dial frame is not opaque at ($x,$y), below the moon horizon." }
    $checked++
} }
Write-Host "PASS: dial frame opaque over all $checked carrier pixels below the horizon."

# 4. Nothing on the carrier reaches the arch rim: every point within the
# carrier's moon-and-screw radius stays inside the aperture's clear arch.
$reach=$orbit+$R+1.5+2.4
foreach($angle in @(-60,-30,0,30,60)) {
    $rad=$angle*[math]::PI/180
    $x=$pivotX+$reach*[math]::Sin($rad); $y=$pivotY-$reach*[math]::Cos($rad)
    $fromArch=[math]::Sqrt([math]::Pow($x-225,2)+[math]::Pow($y-133,2))
    if($fromArch -gt 85.5) { throw ('Carrier parts reach {0:N1} units from the arch centre at {1} degrees; the rim starts at 85.5.' -f $fromArch,$angle) }
}
Write-Host ('PASS: carrier parts stay inside the arch rim (furthest reach {0:N1} of 85.5 units).' -f ($orbit+(133-$pivotY)+$R+1.5+2.4))

# 5. The numerals keep clear of the moon aperture.
$frame=[System.Drawing.Bitmap]::FromFile((Join-Path $AssetPath 'dial_frame.png'))
try {
    foreach($numeral in @(@('11',110,160,35,90),@('1',280,370,35,90),@('12',190,260,0,45))) {
        $gap=999.0
        for($y=$numeral[3];$y -le $numeral[4];$y++) {
            for($x=$numeral[1];$x -le $numeral[2];$x++) {
                $pixel=$frame.GetPixel($x,$y)
                if($pixel.A -lt 200 -or ($pixel.R+$pixel.G+$pixel.B) -lt 400) { continue }
                for($dy=-10;$dy -le 10;$dy++) {
                    for($dx=-10;$dx -le 10;$dx++) {
                        $xx=$x+$dx; $yy=$y+$dy
                        if($xx -lt 0 -or $yy -lt 0 -or $xx -ge 450 -or $yy -ge 450) { continue }
                        if($dial.Alpha[$yy*450+$xx] -le 8) {
                            $distance=[math]::Sqrt($dx*$dx+$dy*$dy)
                            if($distance -lt $gap) { $gap=$distance }
                        }
                    }
                }
            }
        }
        if($gap -lt 1.5) { throw "$($numeral[0]) is only $gap px from the moon aperture." }
        if($gap -gt 10) { Write-Host "PASS: numeral $($numeral[0]) stays more than 10 px clear of the moon aperture." }
        else { Write-Host ("PASS: numeral {0} stays {1:N1} px clear of the moon aperture." -f $numeral[0],$gap) }
    }
} finally { $frame.Dispose() }
