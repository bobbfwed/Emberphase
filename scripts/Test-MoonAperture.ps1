[CmdletBinding()]
param([string]$FramePath)
$ErrorActionPreference='Stop'
if(-not $FramePath) { $FramePath=Join-Path $PSScriptRoot '..\watchface\src\main\res\drawable-nodpi\dial_frame.png' }
Add-Type -AssemblyName System.Drawing
$frame=[System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $FramePath).Path)
try {
    # Inspect the generated alpha mask, independently of the path construction.
    # The lower scallops intentionally occult the moon; the upper arch must not
    # shave its rim. Leave a pixel inside the moon silhouette for antialiasing.
    $checked=0
    for($linear=-90;$linear -le 270;$linear+=2) {
        $angle=($linear+7.5*[math]::Sin($linear*[math]::PI/90))*[math]::PI/180
        foreach($orbit in @(-55,55)) {
            $cx=225-$orbit*[math]::Sin($angle); $cy=133+$orbit*[math]::Cos($angle)
            for($y=[int][math]::Ceiling($cy-25);$y -le [math]::Min(90,$cy+25);$y++) {
                for($x=[int][math]::Ceiling($cx-25);$x -le $cx+25;$x++) {
                    if([math]::Pow($x-$cx,2)+[math]::Pow($y-$cy,2) -gt 625) { continue }
                    if($frame.GetPixel($x,$y).A -gt 8) { throw "Upper arch clips the moon at angle $linear, pixel ($x,$y)." }
                    $checked++
                }
            }
        }
    }
    $fractions=@()
    foreach($linear in @(-90,-45,0,45)) {
        $angle=($linear+7.5*[math]::Sin($linear*[math]::PI/90))*[math]::PI/180
        $cx=225+55*[math]::Sin($angle); $cy=133-55*[math]::Cos($angle)
        $total=0; $visible=0
        for($y=[int][math]::Ceiling($cy-25);$y -le $cy+25;$y++) {
            for($x=[int][math]::Ceiling($cx-25);$x -le $cx+25;$x++) {
                if([math]::Pow($x-$cx,2)+[math]::Pow($y-$cy,2) -gt 625) { continue }
                $total++; if($frame.GetPixel($x,$y).A -lt 128) { $visible++ }
            }
        }
        $fractions+=($visible/$total)
    }
    if($fractions[0] -ne 0) { throw 'New moon must be fully hidden behind the lower scallop.' }
    if($fractions[2] -ne 1) { throw 'Full moon must be entirely clear of the aperture.' }
    foreach($quarter in @($fractions[1],$fractions[3])) {
        if($quarter -lt 0.45 -or $quarter -gt 0.55) { throw "Quarter phase visibility is outside 45-55%: $quarter" }
    }
    Write-Host ('PASS: {0} moon-rim pixels clear across both painted moons; new/full visibility 0/100%; quarter visibility {1:P1}/{2:P1}.' -f $checked,$fractions[1],$fractions[3])
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
                        if($frame.GetPixel($xx,$yy).A -le 8) {
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
