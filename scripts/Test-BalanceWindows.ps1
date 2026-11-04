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
