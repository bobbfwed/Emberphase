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
function Save([string]$name, [switch]$Centered) {
    $output = New-Object System.Drawing.Bitmap($script:logicalWidth, $script:logicalHeight)
    $outputGraphics = [System.Drawing.Graphics]::FromImage($output)
    $outputGraphics.CompositingMode = 'SourceCopy'
    $outputGraphics.InterpolationMode = 'HighQualityBicubic'
    # The moon-window parts rotate and must line up with each other exactly, so
    # they are reduced with half-pixel offsets (no quarter-pixel drift).
    if($Centered) { $outputGraphics.PixelOffsetMode = 'HighQuality' }
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

# ---------------------------------------------------------------------------
# Per-pixel helpers for the tritium, moon-cup and low-light art.
# ---------------------------------------------------------------------------
if (-not ('EmberphaseArt' -as [type])) {
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class EmberphaseArt {
    static byte[] Read(Bitmap b, out BitmapData d) {
        d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        byte[] buf = new byte[d.Stride * b.Height];
        Marshal.Copy(d.Scan0, buf, 0, buf.Length);
        return buf;
    }
    static void Write(Bitmap b, BitmapData d, byte[] buf) { Marshal.Copy(buf, 0, d.Scan0, buf.Length); b.UnlockBits(d); }
    static byte[] Copy(Bitmap b) { BitmapData d; byte[] p = Read(b, out d); b.UnlockBits(d); return p; }
    static byte B(double v) { v = Math.Round(v); return (byte)(v < 0 ? 0 : (v > 255 ? 255 : v)); }
    static double Smooth(double e0, double e1, double x) { double t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }

    // Brightness level, partial desaturation, then an RGB tint. Alpha is kept.
    public static void Grade(Bitmap b, double level, double desat, double tr, double tg, double tb) {
        BitmapData d; byte[] p = Read(b, out d);
        for (int i = 0; i < p.Length; i += 4) {
            double bb = p[i], gg = p[i + 1], rr = p[i + 2];
            double y = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
            rr += (y - rr) * desat; gg += (y - gg) * desat; bb += (y - bb) * desat;
            p[i] = B(bb * level * tb); p[i + 1] = B(gg * level * tg); p[i + 2] = B(rr * level * tr);
        }
        Write(b, d, p);
    }

    static void BoxH(float[] s, float[] t, int w, int h, int r) {
        float inv = 1f / (2 * r + 1);
        for (int y = 0; y < h; y++) {
            int row = y * w; float acc = 0;
            for (int x = 0; x <= r && x < w; x++) acc += s[row + x];
            for (int x = 0; x < w; x++) {
                t[row + x] = acc * inv;
                if (x + r + 1 < w) acc += s[row + x + r + 1];
                if (x - r >= 0) acc -= s[row + x - r];
            }
        }
    }
    static void BoxV(float[] s, float[] t, int w, int h, int r) {
        float inv = 1f / (2 * r + 1);
        for (int x = 0; x < w; x++) {
            float acc = 0;
            for (int y = 0; y <= r && y < h; y++) acc += s[y * w + x];
            for (int y = 0; y < h; y++) {
                t[y * w + x] = acc * inv;
                if (y + r + 1 < h) acc += s[(y + r + 1) * w + x];
                if (y - r >= 0) acc -= s[(y - r) * w + x];
            }
        }
    }
    // Three box passes approximate a Gaussian of the given sigma (pixels).
    static void Gauss(float[] a, int w, int h, double sigma) {
        int r = (int)Math.Round((Math.Sqrt(4 * sigma * sigma + 1) - 1) / 2); if (r < 1) r = 1;
        float[] t = new float[a.Length];
        for (int k = 0; k < 3; k++) { BoxH(a, t, w, h, r); BoxV(t, a, w, h, r); }
    }

    // Blurs the emission layer and screens it onto dst; the blurred alpha is
    // normalised so its strongest point reaches 'peak'.
    public static void Bloom(Bitmap dst, Bitmap emit, double sigma, double peak) {
        int w = emit.Width, h = emit.Height, n = w * h;
        byte[] E = Copy(emit);
        float[] r = new float[n], g = new float[n], b = new float[n], a = new float[n];
        for (int i = 0; i < n; i++) {
            float al = E[i * 4 + 3] / 255f; a[i] = al;
            b[i] = E[i * 4] / 255f * al; g[i] = E[i * 4 + 1] / 255f * al; r[i] = E[i * 4 + 2] / 255f * al;
        }
        Gauss(r, w, h, sigma); Gauss(g, w, h, sigma); Gauss(b, w, h, sigma); Gauss(a, w, h, sigma);
        float m = 0; for (int i = 0; i < n; i++) if (a[i] > m) m = a[i];
        if (m <= 0) return;
        double k = peak / m;
        BitmapData dd; byte[] D = Read(dst, out dd);
        for (int i = 0; i < n; i++) {
            int j = i * 4;
            D[j] = B(255 * (1 - (1 - D[j] / 255.0) * (1 - Math.Min(1, b[i] * k))));
            D[j + 1] = B(255 * (1 - (1 - D[j + 1] / 255.0) * (1 - Math.Min(1, g[i] * k))));
            D[j + 2] = B(255 * (1 - (1 - D[j + 2] / 255.0) * (1 - Math.Min(1, r[i] * k))));
        }
        Write(dst, dd, D);
    }

    // Adds light (an opaque black image with light screened onto it) to an
    // RGBA layer so that it brightens whatever dark dial lies underneath:
    // premultiplied colour + light, alpha raised only where needed.
    public static void AddLight(Bitmap dst, Bitmap light) {
        byte[] L = Copy(light);
        BitmapData dd; byte[] D = Read(dst, out dd);
        for (int i = 0; i < D.Length; i += 4) {
            double a = D[i + 3] / 255.0;
            double pb = D[i] / 255.0 * a + L[i] / 255.0, pg = D[i + 1] / 255.0 * a + L[i + 1] / 255.0, pr = D[i + 2] / 255.0 * a + L[i + 2] / 255.0;
            pb = Math.Min(1, pb); pg = Math.Min(1, pg); pr = Math.Min(1, pr);
            double na = Math.Max(a, Math.Max(pr, Math.Max(pg, pb)));
            if (na <= 0) continue;
            D[i] = B(pb / na * 255); D[i + 1] = B(pg / na * 255); D[i + 2] = B(pr / na * 255); D[i + 3] = B(na * 255);
        }
        Write(dst, dd, D);
    }

    // mask := min(mask, 1 - hole)
    public static void Cut(Bitmap mask, Bitmap hole) {
        byte[] H = Copy(hole);
        BitmapData md; byte[] M = Read(mask, out md);
        for (int i = 0; i < M.Length; i += 4) M[i + 3] = (byte)Math.Min(M[i + 3], 255 - H[i + 3]);
        Write(mask, md, M);
    }

    // Chamfer distance (pixels) from every pixel to the nearest target pixel.
    static float[] Distance(bool[] target, int w, int h) {
        float[] d = new float[w * h]; const float A = 1f, D = 1.41421356f;
        for (int i = 0; i < d.Length; i++) d[i] = target[i] ? 0 : 1e9f;
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            int i = y * w + x; float v = d[i];
            if (x > 0) v = Math.Min(v, d[i - 1] + A);
            if (y > 0) { v = Math.Min(v, d[i - w] + A); if (x > 0) v = Math.Min(v, d[i - w - 1] + D); if (x < w - 1) v = Math.Min(v, d[i - w + 1] + D); }
            d[i] = v;
        }
        for (int y = h - 1; y >= 0; y--) for (int x = w - 1; x >= 0; x--) {
            int i = y * w + x; float v = d[i];
            if (x < w - 1) v = Math.Min(v, d[i + 1] + A);
            if (y < h - 1) { v = Math.Min(v, d[i + w] + A); if (x < w - 1) v = Math.Min(v, d[i + w + 1] + D); if (x > 0) v = Math.Min(v, d[i + w - 1] + D); }
            d[i] = v;
        }
        return d;
    }

    // A blued cup on a transparent layer: the soft shadow it casts on the
    // moon (semi-transparent dark pixels inside 'disc'), then the cup itself
    // with its texture and a polished band just inside its outline.
    public static void Cup(Bitmap dst, Bitmap mask, Bitmap tex, Bitmap disc, double hiPx, int hr, int hg, int hb, int ha, double shadowPx, double shadowMax) {
        int w = dst.Width, h = dst.Height, n = w * h;
        byte[] M = Copy(mask), T = Copy(tex), S = Copy(disc);
        bool[] inside = new bool[n], outside = new bool[n];
        for (int i = 0; i < n; i++) { inside[i] = M[i * 4 + 3] >= 128; outside[i] = !inside[i]; }
        float[] din = Distance(outside, w, h), dout = Distance(inside, w, h);
        BitmapData dd; byte[] Dst = Read(dst, out dd);
        for (int i = 0; i < n; i++) {
            int j = i * 4;
            if (!inside[i] && S[j + 3] > 0 && dout[i] < shadowPx) {
                double f = 1 - dout[i] / shadowPx;
                Dst[j] = 0; Dst[j + 1] = 0; Dst[j + 2] = 0; Dst[j + 3] = B(255 * shadowMax * f * f * S[j + 3] / 255.0);
            }
            double ma = M[j + 3] / 255.0; if (ma <= 0) continue;
            double dist = inside[i] ? din[i] - 0.5 : 0;
            double hw = Smooth(hiPx, hiPx * 0.4, dist) * ha / 255.0;
            double tb = T[j] + (hb - T[j]) * hw, tg = T[j + 1] + (hg - T[j + 1]) * hw, tr = T[j + 2] + (hr - T[j + 2]) * hw;
            double da = Dst[j + 3] / 255.0, oa = ma + da * (1 - ma);
            Dst[j] = B((tb * ma + Dst[j] * da * (1 - ma)) / oa);
            Dst[j + 1] = B((tg * ma + Dst[j + 1] * da * (1 - ma)) / oa);
            Dst[j + 2] = B((tr * ma + Dst[j + 2] * da * (1 - ma)) / oa);
            Dst[j + 3] = B(oa * 255);
        }
        Write(dst, dd, Dst);
    }

    // Low-light overlay: outside 'radius' (pixels from cx,cy) the opaque
    // pre-rendered ring stays; inside, a veil of colour (vr,vg,vb) whose alpha
    // is aBase, lowered to aLift where maskLift is set and to aWeek where
    // maskWeek is set. Both masks are feathered with a Gaussian of 'sigma'.
    public static void Veil(Bitmap ring, Bitmap maskLift, Bitmap maskWeek, double sigma, double radius, double cx, double cy,
                            int vr, int vg, int vb, double aBase, double aLift, double aWeek) {
        int w = ring.Width, h = ring.Height, n = w * h;
        byte[] ML = Copy(maskLift), MW = Copy(maskWeek);
        float[] l = new float[n], k = new float[n];
        for (int i = 0; i < n; i++) { l[i] = ML[i * 4 + 3] / 255f; k[i] = MW[i * 4 + 3] / 255f; }
        Gauss(l, w, h, sigma); Gauss(k, w, h, sigma);
        BitmapData rd; byte[] R = Read(ring, out rd);
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            int i = y * w + x, j = i * 4;
            double dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.Sqrt(dx * dx + dy * dy);
            double t = Math.Max(0, Math.Min(1, (d - radius + 1) / 2));   // 1 = ring
            if (t >= 1) continue;
            double va = Math.Min(aBase - (aBase - aLift) * l[i], aBase - (aBase - aWeek) * k[i]);
            double ra = R[j + 3] / 255.0;
            double a = va * (1 - t) + ra * t;
            double pb = vb / 255.0 * va * (1 - t) + R[j] / 255.0 * ra * t;
            double pg = vg / 255.0 * va * (1 - t) + R[j + 1] / 255.0 * ra * t;
            double pr = vr / 255.0 * va * (1 - t) + R[j + 2] / 255.0 * ra * t;
            R[j] = B(pb / a * 255); R[j + 1] = B(pg / a * 255); R[j + 2] = B(pr / a * 255); R[j + 3] = B(a * 255);
        }
        Write(ring, rd, R);
    }
}
'@
}

# ---------------------------------------------------------------------------
# Shared drawing helpers for the tritium hands and markers and the moon window
# ---------------------------------------------------------------------------
$emberLume=@{Glass='#f2c7a0';Glow='#ff7a18';Core='#ffe0b8'}
$warmTint=@(1.0,0.62,0.38)
function Mix([string]$a,[string]$b,[double]$t) {
    $ca=C $a; $cb=C $b
    '#{0:x2}{1:x2}{2:x2}' -f [int]($ca.R+($cb.R-$ca.R)*$t),[int]($ca.G+($cb.G-$ca.G)*$t),[int]($ca.B+($cb.B-$ca.B)*$t)
}
function Argb([int]$alpha,[string]$hex) { $c=C $hex; [System.Drawing.Color]::FromArgb($alpha,$c.R,$c.G,$c.B) }
function Fill-Path($path,[string]$hex) { $b=Brush $hex; $script:g.FillPath($b,$path); $b.Dispose() }
function Stroke-Path($path,[string]$hex,[float]$width) { $p=Pen $hex $width; $script:g.DrawPath($p,$path); $p.Dispose() }
function Blend-Brush([float]$x,[float]$y,[float]$w,[float]$h,[string[]]$colors,[single[]]$positions,[float]$angle=0) {
    $rect=[System.Drawing.RectangleF]::new($x,$y,$w,$h)
    $br=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,(C $colors[0]),(C $colors[-1]),$angle)
    $blend=New-Object System.Drawing.Drawing2D.ColorBlend($colors.Count)
    $blend.Colors=[System.Drawing.Color[]]@($colors | ForEach-Object { C $_ }); $blend.Positions=$positions
    $br.InterpolationColors=$blend; $br.WrapMode='TileFlipXY'
    return $br
}
# Offscreen drawing surface at 'scale' pixels per unit, made current.
function New-Offscreen([int]$width,[int]$height,[int]$scale) {
    $bmp=New-Object System.Drawing.Bitmap(($width*$scale),($height*$scale),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gr=[System.Drawing.Graphics]::FromImage($bmp); $gr.SmoothingMode='AntiAlias'; $gr.TextRenderingHint='AntiAliasGridFit'
    $gr.Clear([System.Drawing.Color]::Transparent); $gr.ScaleTransform($scale,$scale)
    $script:g=$gr
    return [pscustomobject]@{ Bitmap=$bmp; G=$gr }
}
function Close-Offscreen($off) { $off.G.Dispose(); $off.Bitmap.Dispose() }
# Draws a supersampled bitmap into the current canvas over (0,0)-(width,height).
function Put-Image($bitmap,[float]$width,[float]$height) {
    $attributes=New-Object System.Drawing.Imaging.ImageAttributes; $attributes.SetWrapMode('TileFlipXY')
    # Half-pixel offsets keep the shrunk image centred where it was drawn
    # (the default mode shifts it by about a pixel at this 4:1 reduction).
    $state=$script:g.Save(); $script:g.InterpolationMode='HighQualityBicubic'; $script:g.PixelOffsetMode='HighQuality'
    $script:g.ScaleTransform(($width/$bitmap.Width),($height/$bitmap.Height))
    $script:g.DrawImage($bitmap,([System.Drawing.Rectangle]::new(0,0,$bitmap.Width,$bitmap.Height)),0,0,$bitmap.Width,$bitmap.Height,[System.Drawing.GraphicsUnit]::Pixel,$attributes)
    $script:g.Restore($state); $attributes.Dispose()
}

# Tritium tube along +y from (x,y), width w, length h, rounded ends.
# seat: steel bed; glass: unlit tube; glow: lit tube; emit: bloom source.
function Tube([float]$x,[float]$y,[float]$w,[float]$h,[string]$style) {
    $r=$w/2; $pal=$emberLume
    if($style -eq 'seat') {
        $m=0.9; $p=RoundPath ($x-$m) ($y-$m) ($w+2*$m) ($h+2*$m) ($r+$m)
        Fill-Path $p '#3c4244'; Stroke-Path $p '#151819' 0.45; $p.Dispose(); return
    }
    $path=RoundPath $x $y $w $h $r
    if($style -eq 'glass') {
        $g0=$pal.Glass
        $b=Blend-Brush $x $y $w $h @((Mix $g0 '#000000' 0.36),$g0,(Mix $g0 '#ffffff' 0.4),$g0,(Mix $g0 '#000000' 0.24)) ([single[]]@(0,0.3,0.46,0.7,1))
        $script:g.FillPath($b,$path); $b.Dispose()
        Stroke-Path $path (Mix $g0 '#000000' 0.55) 0.35
        $sp=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(225,255,255,255),0.5); $sp.StartCap='Round'; $sp.EndCap='Round'
        $script:g.DrawLine($sp,($x+$w*0.3),($y+$r*0.9),($x+$w*0.3),($y+$h-$r*0.9)); $sp.Dispose()
    } elseif($style -eq 'glow') {
        $mid=Mix $pal.Glow $pal.Core 0.62
        $b=Blend-Brush $x $y $w $h @($pal.Glow,$mid,$pal.Core,$pal.Core,$mid,$pal.Glow) ([single[]]@(0,0.22,0.42,0.58,0.78,1))
        $script:g.FillPath($b,$path); $b.Dispose()
    } else { Fill-Path $path $pal.Glow }
    $path.Dispose()
}
# Clock angles of the tube pairs flanking "12" and "6": each tube sits 3.5
# units clear of the numeral glyph (plus its 0.9-unit seat) at radius 205.
function Get-FlankAngles {
    if(-not $script:flankAngles) {
        $mb=New-Object System.Drawing.Bitmap(8,8); $mg=[System.Drawing.Graphics]::FromImage($mb)
        $mg.TextRenderingHint='AntiAliasGridFit'; $mg.ScaleTransform(2,2)
        $format=[System.Drawing.StringFormat]::GenericTypographic.Clone(); $format.FormatFlags=[System.Drawing.StringFormatFlags]'NoWrap,NoClip,MeasureTrailingSpaces'
        $font=New-Object System.Drawing.Font('Arial Narrow',29,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
        $half12=$mg.MeasureString('12',$font,[System.Drawing.PointF]::new(0,0),$format).Width/2
        $half6=$mg.MeasureString('6',$font,[System.Drawing.PointF]::new(0,0),$format).Width/2
        $font.Dispose(); $format.Dispose(); $mg.Dispose(); $mb.Dispose()
        $script:flank12=[math]::Asin(($half12+3.5+2.2+0.9)/205)*180/[math]::PI
        $script:flank6=[math]::Asin(($half6+3.5+2.2+0.9)/205)*180/[math]::PI
        $script:flankAngles=@((360-$script:flank12),$script:flank12,(180-$script:flank6),(180+$script:flank6))
    }
    return $script:flankAngles
}
# Hour tubes on the outer ring; "12" and "6" each get a flanking pair.
function Draw-HourTubes([string]$style) {
    $null=Get-FlankAngles
    for($hour=0;$hour -lt 12;$hour++) {
        $state=$script:g.Save(); $script:g.TranslateTransform(225,225); $script:g.RotateTransform($hour*30)
        if($hour -eq 0 -or $hour -eq 6) {
            $a=$script:flank12; if($hour -eq 6) { $a=$script:flank6 }
            foreach($side in @(-1,1)) {
                $inner=$script:g.Save(); $script:g.RotateTransform([float]($side*$a)); Tube -2.2 -212.5 4.4 15 $style; $script:g.Restore($inner)
            }
        } else { Tube -2.2 -212.5 4.4 15 $style }
        $script:g.Restore($state)
    }
}
$hourHandPoints=@(@(11,1),@(18,11),@(17,95),@(21,127),@(16,145),@(6,145),@(1,127),@(5,95),@(4,11))
$minuteHandPoints=@(@(8,1),@(15,10),@(12,151),@(15,180),@(11,193),@(5,193),@(1,180),@(4,151),@(1,10))
# Inlays in hand-image units: hour tube 5 x 57 (44 % of the hand, 60-117
# units from the pivot); minute tube 4 x 80 (45 %, 85-165 units out).
$hourTube=@(8.5,15,5,57); $minuteTube=@(6,15,4,80)
function Draw-HandSteel([string]$kind) {
    if($kind -eq 'hour') { $pts=$hourHandPoints; $t=$hourTube } else { $pts=$minuteHandPoints; $t=$minuteTube }
    $polygon=[System.Drawing.PointF[]]@($pts | ForEach-Object { [System.Drawing.PointF]::new($_[0],$_[1]) })
    $b=Brush '#f5f5ef'; $script:g.FillPolygon($b,$polygon); $b.Dispose()
    Tube $t[0] $t[1] $t[2] $t[3] 'seat'
}
function Draw-HandTube([string]$kind,[string]$style) {
    if($kind -eq 'hour') { $t=$hourTube } else { $t=$minuteTube }
    Tube $t[0] $t[1] $t[2] $t[3] $style
}

# Moon window parts. The carrier turns about its pivot; each moon is fixed to
# it with its "up" pointing outward. R = 26, path radius 38, hub 7.5.
$moonRadius=26; $carrierRadius=38; $hubRadius=7.5
function PolarAt([double]$cx,[double]$cy,[double]$r,[double]$deg) { $a=$deg*[math]::PI/180; [System.Drawing.PointF]::new(($cx+$r*[math]::Sin($a)),($cy-$r*[math]::Cos($a))) }
# Mechanical moon at the origin: cream metallic gradient, engraved craters,
# domed highlight and a rim line.
function Draw-MoonArt([double]$R) {
    $rect=[System.Drawing.RectangleF]::new(-$R,-$R,2*$R,2*$R)
    $b=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,(C '#fff2d7'),(C '#8d8b83'),45)
    $script:g.FillEllipse($b,$rect); $b.Dispose()
    $state=$script:g.Save(); $clip=New-Object System.Drawing.Drawing2D.GraphicsPath; $clip.AddEllipse($rect); $script:g.SetClip($clip)
    $f=$R/26
    foreach($crater in @(@(-8,-5,10),@(12.5,7.5,13),@(-2.5,16.5,7),@(15,-12,6),@(-16,10,4))) {
        $x=$crater[0]*$f; $y=$crater[1]*$f; $d=$crater[2]*$f
        Ellipse '#888b87' ($x-$d/2) ($y-$d/2) $d $d; Ellipse '#b9b8ac' ($x-$d/2+$f) ($y-$d/2+$f) ($d-2*$f) ($d-2*$f)
    }
    $dome=New-Object System.Drawing.Drawing2D.PathGradientBrush($clip)
    $dome.CenterPoint=[System.Drawing.PointF]::new((-0.32*$R),(-0.36*$R))
    $dome.CenterColor=[System.Drawing.Color]::FromArgb(70,255,250,236); $dome.SurroundColors=@([System.Drawing.Color]::FromArgb(70,52,46,36))
    $script:g.FillPath($dome,$clip); $dome.Dispose()
    $script:g.Restore($state); $clip.Dispose()
    $pen=New-Object System.Drawing.Pen((C '#5f5b50'),0.7); $script:g.DrawEllipse($pen,(-$R+0.35),(-$R+0.35),(2*$R-0.7),(2*$R-0.7)); $pen.Dispose()
}
function Draw-Screw([double]$x,[double]$y,[double]$r,[double]$slotDeg) {
    $path=New-Object System.Drawing.Drawing2D.GraphicsPath; $path.AddEllipse(($x-$r),($y-$r),(2*$r),(2*$r))
    $b=New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
    $b.CenterPoint=[System.Drawing.PointF]::new(($x-$r*0.35),($y-$r*0.35)); $b.CenterColor=C '#eef1f4'; $b.SurroundColors=@((C '#565e67'))
    $script:g.FillPath($b,$path); $b.Dispose()
    $p=Pen '#22272c' 0.35; $script:g.DrawPath($p,$path); $p.Dispose(); $path.Dispose()
    $a=$slotDeg*[math]::PI/180; $dx=$r*0.8*[math]::Cos($a); $dy=$r*0.8*[math]::Sin($a)
    $p=Pen '#1b1f23' ($r*0.36); $script:g.DrawLine($p,($x-$dx),($y-$dy),($x+$dx),($y+$dy)); $p.Dispose()
}
# Brass carrier wheel about (cx,cy): rim, six spokes and a 20-tooth hub.
function Draw-CarrierWheel([double]$cx,[double]$cy,[double]$rim,[double]$hub) {
    $rect=[System.Drawing.RectangleF]::new(($cx-$rim-6),($cy-$rim-6),(2*$rim+12),(2*$rim+12))
    $brass=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,(C '#d6b06a'),(C '#7d6230'),60)
    $dark=C '#3e2f14'
    $p=New-Object System.Drawing.Pen($dark,2.5); $script:g.DrawEllipse($p,($cx-$rim),($cy-$rim),(2*$rim),(2*$rim))
    for($n=0;$n -lt 6;$n++) { $script:g.DrawLine($p,(PolarAt $cx $cy ($hub-1) ($n*60)),(PolarAt $cx $cy $rim ($n*60))) }; $p.Dispose()
    $p=New-Object System.Drawing.Pen($brass,1.8); $script:g.DrawEllipse($p,($cx-$rim),($cy-$rim),(2*$rim),(2*$rim)); $p.Dispose()
    $p=New-Object System.Drawing.Pen($brass,1.6); $p.StartCap='Flat'; $p.EndCap='Flat'
    for($n=0;$n -lt 6;$n++) { $script:g.DrawLine($p,(PolarAt $cx $cy $hub ($n*60)),(PolarAt $cx $cy $rim ($n*60))) }; $p.Dispose()
    $pts=@()
    for($i=0;$i -lt 20;$i++) {
        $t=$i*18
        $pts+=PolarAt $cx $cy $hub ($t-5.4); $pts+=PolarAt $cx $cy ($hub+3.5) ($t-2.9); $pts+=PolarAt $cx $cy ($hub+3.5) ($t+2.9); $pts+=PolarAt $cx $cy $hub ($t+5.4)
    }
    $gear=New-Object System.Drawing.Drawing2D.GraphicsPath; $gear.AddPolygon([System.Drawing.PointF[]]$pts)
    $script:g.FillPath($brass,$gear); $p=New-Object System.Drawing.Pen($dark,0.4); $script:g.DrawPath($p,$gear)
    $e=$hub*0.72; $script:g.DrawEllipse($p,($cx-$e),($cy-$e),(2*$e),(2*$e)); $p.Dispose(); $gear.Dispose(); $brass.Dispose()
    Draw-Screw $cx $cy ([math]::Min(3.2,$hub*0.4)) 35
}
# Blued-steel cup texture in moon-local coordinates.
function Draw-CupTexture([double]$R) {
    $e=$R+3
    $b=Blend-Brush (-$e) (-$e) (2*$e) (2*$e) @('#16233d','#1d2d4b','#24375c') ([single[]]@(0,0.5,1)) 60
    $script:g.FillRectangle($b,(-$e),(-$e),(2*$e),(2*$e)); $b.Dispose()
    $rnd=New-Object System.Random(3101)
    for($ly=-$e;$ly -le $e;$ly+=0.45) {
        $tone=255; if($rnd.NextDouble() -lt 0.5) { $tone=0 }
        $pen=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb((6+$rnd.Next(0,12)),$tone,$tone,$tone),0.22)
        $script:g.DrawLine($pen,(-$e),$ly,$e,($ly+0.6)); $pen.Dispose()
    }
}
# Region the cup covers, in moon-local coordinates (x right = travel, y down,
# "up" = outward): the terminator x = c*sqrt(R^2 - y^2) from pole to pole,
# closed on the dark side by the limb at radius 'outer'.
function Get-CupPath([double]$c,[bool]$waning,[double]$R,[double]$outer) {
    $pts=New-Object System.Collections.Generic.List[System.Drawing.PointF]
    for($i=0;$i -le 120;$i++) {
        $y=-$R*[math]::Cos([math]::PI*$i/120); $x=$c*[math]::Sqrt([math]::Max(0,$R*$R-$y*$y)); if($waning) { $x=-$x }
        $pts.Add([System.Drawing.PointF]::new($x,$y))
    }
    $path=New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddLines($pts.ToArray())
    if($waning) { $path.AddArc(-$outer,-$outer,2*$outer,2*$outer,90,-180) } else { $path.AddArc(-$outer,-$outer,2*$outer,2*$outer,90,180) }
    $path.CloseFigure(); return $path
}

# Moon window sky: opaque navy gradient with sparse fixed stars.
Canvas 174 72
$script:g.TranslateTransform(-138,-46)
$b=Blend-Brush 138 44 174 76 @('#03091a','#071631','#0b1f3c') ([single[]]@(0,0.55,1)) 90
$script:g.FillRectangle($b,138,46,174,72); $b.Dispose()
$starRandom=New-Object System.Random(2026)
for($i=0;$i -lt 60;$i++) {
    $x=146+$starRandom.NextDouble()*158; $y=50+$starRandom.NextDouble()*64
    $size=0.7+$starRandom.NextDouble()*0.8; $bright=$starRandom.NextDouble()
    if([math]::Sqrt([math]::Pow($x-225,2)+[math]::Pow($y-133,2)) -gt 82) { continue }
    Ellipse (Mix '#6f86a0' '#dfe8f2' $bright) ($x-$size/2) ($y-$size/2) $size $size
}
Save 'moon_sky' -Centered

# Carrier: brass wheel and two moons half a turn apart, each with its pole
# screws. Centre (70,70) is the pivot; at rotation 0 the top moon is full.
Canvas 140 140
Draw-CarrierWheel 70 70 $carrierRadius $hubRadius
foreach($angle in @(0,180)) {
    $centre=PolarAt 70 70 $carrierRadius $angle
    $state=$script:g.Save(); $script:g.TranslateTransform($centre.X,$centre.Y); $script:g.RotateTransform($angle)
    Draw-MoonArt $moonRadius
    $script:g.Restore($state)
    foreach($sign in @(1,-1)) {
        $screw=PolarAt 70 70 ($carrierRadius+$sign*($moonRadius+1.5)) $angle
        Draw-Screw $screw.X $screw.Y 2.4 ($angle+20+$sign*25)
    }
}
Save 'moon_carrier' -Centered

# Cup frames for a moon at the top of the carrier (up = outward N, right =
# travel T). Frame k is for moon angle a = -90 + 3k; frame 30 (full) has no
# cup. Drawn at 8 px per unit; the cup is cut around the two pole screws so
# the screw heads sit on top of it.
for($k=0;$k -lt 60;$k++) {
    if($k -eq 30) { continue }
    $a=-90+3*$k; $c=-[math]::Cos(2*$a*[math]::PI/180); $waning=($a -gt 0)
    $disc=New-Offscreen 58 58 8; $script:g.TranslateTransform(29,29); Ellipse '#ffffff' (-$moonRadius) (-$moonRadius) (2*$moonRadius) (2*$moonRadius)
    $mask=New-Offscreen 58 58 8; $script:g.TranslateTransform(29,29)
    if($k -eq 0) { Ellipse '#ffffff' (-$moonRadius-1.5) (-$moonRadius-1.5) (2*$moonRadius+3) (2*$moonRadius+3) }
    else { $cup=Get-CupPath $c $waning $moonRadius ($moonRadius+1.5); Fill-Path $cup '#ffffff'; $cup.Dispose() }
    $holes=New-Offscreen 58 58 8; $script:g.TranslateTransform(29,29)
    foreach($sign in @(1,-1)) { Ellipse '#ffffff' -2.45 ($sign*($moonRadius+1.5)-2.45) 4.9 4.9 }
    [EmberphaseArt]::Cut($mask.Bitmap,$holes.Bitmap)
    $tex=New-Offscreen 58 58 8; $script:g.TranslateTransform(29,29); Draw-CupTexture $moonRadius
    $out=New-Offscreen 58 58 8
    [EmberphaseArt]::Cup($out.Bitmap,$mask.Bitmap,$tex.Bitmap,$disc.Bitmap,6.4,143,163,196,180,12,0.5)
    Canvas 58 58
    Put-Image $out.Bitmap 58 58
    Save ('moon_cup_{0:00}' -f $k) -Centered
    foreach($off in @($disc,$mask,$holes,$tex,$out)) { Close-Offscreen $off }
}

# One shared balance wheel, with the same toothed rim as before. The pale
# treatment and the dark treatment alternate every 36 degrees, the slice that
# fills a 31-degree opening. The openings are 180 degrees apart and 180/36 is
# odd, so one is pale while the other is dark. Slice 0 is centered on the left.
Canvas 148 148
Ellipse '#050606' 4 4 140 140
Ellipse '#101313' 10 10 128 128
$p=Pen '#222624' 4; $script:g.DrawEllipse($p,9,9,130,130); $p.Dispose()
for($tooth=0;$tooth -lt 72;$tooth++) {
    $a=$tooth*5
    $segment=[math]::Floor((($a - 162 + 360) % 360) / 36)
    $color='#242822'; if($segment % 2 -eq 0) { $color='#777461' }
    $rad=$a*[math]::PI/180
    Line $color 1.6 (74+52*[math]::Cos($rad)) (74+52*[math]::Sin($rad)) (74+73*[math]::Cos($rad)) (74+73*[math]::Sin($rad))
}
$rimColors=@('#31362f','#55594d','#777967','#a5a18a','#bbb39b','#898774','#5e6255','#373d34')
for($segment=0;$segment -lt 10;$segment+=2) {
    $start=162+$segment*36
    for($i=0;$i -lt $rimColors.Count;$i++) {
        $radius=54+$i*2.3
        $p=Pen $rimColors[$i] 1.6
        $script:g.DrawArc($p,([System.Drawing.RectangleF]::new((74-$radius),(74-$radius),($radius*2),($radius*2))),$start,36)
        $p.Dispose()
    }
}
Save 'balance_wheel'

# Concentric arc openings, centered on the dial. A chamfer and a darker inner
# wall show the thickness of the metal plate; the clear slot is the view past
# that backing onto the wheel. The live hands render above both openings.
function Add-RingSector([System.Drawing.Drawing2D.GraphicsPath]$path,[float]$inner,[float]$outer,[float]$start,[float]$sweep) {
    $path.AddArc((225-$outer),(225-$outer),($outer*2),($outer*2),$start,$sweep)
    $path.AddArc((225-$inner),(225-$inner),($inner*2),($inner*2),($start+$sweep),(-$sweep))
    $path.CloseFigure()
}
# The moon aperture: the arch centred on (225,133), radius 87, cut off at the
# carrier horizon y = 116 so the carrier's lower half stays hidden.
$moonHorizon=116
function Get-MoonAperture {
    $aperture=New-Object System.Drawing.Drawing2D.GraphicsPath
    $archStart=180+[math]::Asin((133-$moonHorizon)/87)*180/[math]::PI
    $aperture.AddArc(138,46,174,174,$archStart,(540-2*$archStart)); $aperture.CloseFigure()
    return $aperture
}

# Bevelled black dial, minute track, drums, and recessed activity channels.
# tubeStyle 'glass' draws the unlit tritium tubes; 'none' leaves only their
# steel seats (the low-light ring adds glowing tubes itself).
function Draw-DialFrameArt([string]$tubeStyle) {
Ellipse '#181818' 1 1 448 448
$p=Pen '#a9a9a5' 0.8; $script:g.DrawEllipse($p,2,2,446,446); $p.Dispose()
Ellipse '#020202' 5 5 440 440; Ellipse '#101112' 31 31 388 388
$facePath=New-Object System.Drawing.Drawing2D.GraphicsPath; $facePath.AddEllipse(32,32,386,386)
$faceBrush=New-Object System.Drawing.Drawing2D.PathGradientBrush($facePath)
$faceBrush.CenterColor=C '#121414'; $faceBrush.SurroundColors=@((C '#030404'))
$script:g.FillPath($faceBrush,$facePath); $faceBrush.Dispose(); $facePath.Dispose()
$flanks=Get-FlankAngles
for($index=0;$index -lt 60;$index++) {
    # Hour marks are tritium tubes (drawn below); minute ticks crowding the
    # tube pairs beside "12" and "6" are left out.
    if($index%5 -eq 0) { continue }
    $crowded=$false
    foreach($fa in $flanks) { if([math]::Abs((($index*6-$fa)%360+540)%360-180) -lt 3.6) { $crowded=$true } }
    if($crowded) { continue }
    $angle=$index*6*[math]::PI/180; $outer=213; $inner=202
    Line '#ff5d0a' 2.8 (225+$inner*[math]::Sin($angle)) (225-$inner*[math]::Cos($angle)) (225+$outer*[math]::Sin($angle)) (225-$outer*[math]::Cos($angle))
}
foreach($hour in @(1,2,3,4,6,8,9,10,11,12)) {
    $a=$hour*30*[math]::PI/180; $radius=174; $size=26
    if($hour -eq 12) { $radius=201; $size=29 }
    # The calorie channel ends near radius 196, so the 6 sits further out than the 12.
    if($hour -eq 6) { $radius=210; $size=29 }
    $x=225+$radius*[math]::Sin($a); $y=225-$radius*[math]::Cos($a)
    Label ([string]$hour) ($x-25) ($y-$size*0.65) $size '#b7b7b4' 50
}
$aperture=Get-MoonAperture
$p=Pen '#494b48' 3; $script:g.DrawPath($p,$aperture); $p.Dispose()
$script:g.CompositingMode='SourceCopy'; $transparent=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Transparent)
$script:g.FillPath($transparent,$aperture); $transparent.Dispose(); $script:g.CompositingMode='SourceOver'; $aperture.Dispose()

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

# The drum body sits against the moon aperture. A cylindrical light band
# sits behind the live text. A separate foreground bezel occludes the
# receding rows after text is drawn.
RoundFill '#030404' 128 117 194 73 8
foreach($drumX in @(135,195,255)) {
    $rect=[System.Drawing.RectangleF]::new($drumX,122,60,62)
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
Draw-HourTubes 'seat'
if($tubeStyle -ne 'none') { Draw-HourTubes $tubeStyle }
}
Canvas 450 450
Draw-DialFrameArt 'glass'
Save 'dial_frame'

# Foreground calendar rim: transparent aperture, opaque lips, and shadows over
# the compressed neighboring labels. Cropped to avoid a full-face extra layer.
Canvas 200 79
$script:g.TranslateTransform(-125,-114)
RoundFill '#020303' 126 116 198 77 9
RoundFill '#5b615f' 128 117 194 73 8
RoundFill '#151819' 129 119 192 70 7
RoundFill '#343a3c' 132 122 186 64 5
$opening=RoundPath 135 124 180 59 3
$script:g.CompositingMode='SourceCopy'; $clear=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Transparent)
$script:g.FillPath($clear,$opening); $clear.Dispose(); $script:g.CompositingMode='SourceOver'
$clipState=$script:g.Save(); $script:g.SetClip($opening)
foreach($strip in @(@(124,134,175,0),@(175,183,0,200))) {
    $rect=[System.Drawing.RectangleF]::new(135,$strip[0],180,($strip[1]-$strip[0]))
    $b=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,([System.Drawing.Color]::FromArgb($strip[2],0,0,0)),([System.Drawing.Color]::FromArgb($strip[3],0,0,0)),90)
    $script:g.FillRectangle($b,$rect); $b.Dispose()
}
foreach($divider in @(194,254)) {
    Line '#010202' 4 $divider 124 $divider 183
    Line '#616665' 0.8 ($divider-1.5) 126 ($divider-1.5) 181
    Line '#262b2d' 1 ($divider+1) 124 ($divider+1) 183
}
$script:g.Restore($clipState); $opening.Dispose()
Line '#080b0c' 1.2 138 124 312 124
Line '#686e6a' 0.7 138 184 312 184
Save 'calendar_bezel'

# Steel hands with an unlit Ember tritium tube in a steel seat.
Canvas 22 150
Draw-HandSteel 'hour'; Draw-HandTube 'hour' 'glass'
Save 'hour_hand'
Canvas 16 198
Draw-HandSteel 'minute'; Draw-HandTube 'minute' 'glass'
Save 'minute_hand'

# Low-light hands: dim steel (level 0.22, warm), glowing tube with its bloom,
# on an 11-unit transparent margin around the normal hand image.
foreach($kind in @('hour','minute')) {
    if($kind -eq 'hour') { $w=22; $h=150 } else { $w=16; $h=198 }
    Canvas ($w+22) ($h+22)
    $script:g.TranslateTransform(11,11); Draw-HandSteel $kind
    [EmberphaseArt]::Grade($script:bitmap,0.22,0.85,$warmTint[0],$warmTint[1],$warmTint[2])
    $canvasG=$script:g
    $emit=New-Offscreen ($w+22) ($h+22) 2; $script:g.TranslateTransform(11,11); Draw-HandTube $kind 'emit'
    $light=New-Offscreen ($w+22) ($h+22) 2; $script:g.Clear([System.Drawing.Color]::Black)
    [EmberphaseArt]::Bloom($light.Bitmap,$emit.Bitmap,8.4,0.45)
    [EmberphaseArt]::Bloom($light.Bitmap,$emit.Bitmap,2.4,0.55)
    [EmberphaseArt]::AddLight($script:bitmap,$light.Bitmap)
    Close-Offscreen $emit; Close-Offscreen $light
    $script:g=$canvasG; Draw-HandTube $kind 'glow'
    Save ('lowlight_'+$kind+'_hand')
}

# Low-light dial overlay, drawn over the complete normal dial and under the
# hands. Inside radius 192 a dark warm veil lets 14 % of the live dial through
# (34 % over the moon window, the current month/date cells and the steps
# number; 52 % over the current weekday). From radius 192 out it is the
# static ring pre-rendered at the low-light level with glowing tubes.
Canvas 450 450
$script:g.Clear([System.Drawing.Color]::Black)
Draw-DialFrameArt 'none'
$script:g.CompositingMode='SourceOver'
[EmberphaseArt]::Grade($script:bitmap,0.14,0.85,$warmTint[0],$warmTint[1],$warmTint[2])
Draw-HourTubes 'glow'
$canvasG=$script:g
# Brighter-veil areas, from the dial art: moon window, the middle drum row
# cells (columns at x 135/195/255, label boxes y 134-169) and the steps box.
$lift=New-Offscreen 450 450 2
$window=Get-MoonAperture; Fill-Path $window '#ffffff'; $window.Dispose()
$b=Brush '#ffffff'; $script:g.FillRectangle($b,195,134,60,35); $script:g.FillRectangle($b,255,134,60,35); $script:g.FillRectangle($b,169,259,112,39); $b.Dispose()
$week=New-Offscreen 450 450 2
$b=Brush '#ffffff'; $script:g.FillRectangle($b,135,134,60,35); $b.Dispose()
[EmberphaseArt]::Veil($script:bitmap,$lift.Bitmap,$week.Bitmap,2.4,384,450,450,10,5,3,0.86,0.66,0.48)
$emit=New-Offscreen 450 450 2; Draw-HourTubes 'emit'
$light=New-Offscreen 450 450 2; $script:g.Clear([System.Drawing.Color]::Black)
[EmberphaseArt]::Bloom($light.Bitmap,$emit.Bitmap,8.4,0.45)
[EmberphaseArt]::Bloom($light.Bitmap,$emit.Bitmap,2.4,0.55)
[EmberphaseArt]::AddLight($script:bitmap,$light.Bitmap)
foreach($off in @($lift,$week,$emit,$light)) { Close-Offscreen $off }
$script:g=$canvasG
Save 'lowlight_dial'

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
# The same cap at the low-light level (about 0.3, warm), opaque where the cap is.
Canvas 28 28
Ellipse '#070808' 0 0 28 28
$rect=[System.Drawing.RectangleF]::new(1,1,26,26)
$b=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,(C '#ffb15b'),(C '#e24100'),45)
$script:g.FillEllipse($b,$rect); $b.Dispose(); Ellipse '#070909' 8.5 8.5 11 11
[EmberphaseArt]::Grade($script:bitmap,0.3,0.85,$warmTint[0],$warmTint[1],$warmTint[2])
Save 'lowlight_center_cap'
Canvas 21 13
RoundFill '#8e2900' 0 0 21 13 2
$rect=[System.Drawing.RectangleF]::new(1,1,19,11)
$b=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,(C '#ffb056'),(C '#ff5900'),90)
$p=RoundPath 1 1 19 11 2; $script:g.FillPath($b,$p); $b.Dispose(); $p.Dispose()
Save 'battery_slider'

Canvas 450 450
# The 12 and 6 numerals sit on those hour ticks, so those marks are omitted.
foreach($i in @(5,10,15,20,25,35,40,45,50,55)) {
    $a=$i*6*[math]::PI/180
    $p=Pen '#d94c20' 6; $p.StartCap='Flat'; $p.EndCap='Flat'
    $script:g.DrawLine($p,[float](225+197*[math]::Sin($a)),[float](225-197*[math]::Cos($a)),[float](225+213*[math]::Sin($a)),[float](225-213*[math]::Cos($a))); $p.Dispose()
}
# Match the interactive dial: same hours, radii, and sizes. Hours 5 and 7
# stay unmarked so the lower face matches the active layout.
foreach($hour in @(1,2,3,4,6,8,9,10,11,12)) {
    $a=$hour*30*[math]::PI/180; $radius=174; $size=26
    if($hour -eq 12) { $radius=201; $size=29 }
    if($hour -eq 6) { $radius=210; $size=29 }
    $x=225+$radius*[math]::Sin($a); $y=225-$radius*[math]::Cos($a)
    Label ([string]$hour) ($x-25) ($y-$size*0.65) $size '#d94c20' 50
}
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

# The single twin-moon disc was replaced by moon_sky, moon_carrier and the cups.
$retired=Join-Path $assetRoot 'moon_disc.png'
if(Test-Path -LiteralPath $retired) { Remove-Item -LiteralPath $retired }
Write-Host "Static dial, hand, moon, and weather artwork written to $assetRoot"
