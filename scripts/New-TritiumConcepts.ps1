[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
# Illustrative design concepts for the tritium / sleep / realistic-moon update.
# Composes preview images only; nothing here is used by the watch face build.
# Dot-sourcing New-DialAssets.ps1 provides the shared drawing helpers (and, as
# a side effect, rewrites the production PNGs with identical bytes).
. (Join-Path $PSScriptRoot 'New-DialAssets.ps1')
$sourceAssetRoot = $assetRoot
$repoRoot = Split-Path -Parent $PSScriptRoot
$outRoot = Join-Path $repoRoot 'docs\previews\tritium-concepts'
New-Item -ItemType Directory -Path $outRoot -Force | Out-Null
$degree = [string][char]0x00b0
$middot = [string][char]0x00b7

# ---------------------------------------------------------------------------
# Per-pixel helpers (moon shading, grading, bloom, grain), compiled once.
# ---------------------------------------------------------------------------
if (-not ('TritiumFx' -as [type])) {
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class TritiumFx {
    static byte[] Read(Bitmap b, out BitmapData d) {
        d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        byte[] buf = new byte[d.Stride * b.Height];
        Marshal.Copy(d.Scan0, buf, 0, buf.Length);
        return buf;
    }
    static void Write(Bitmap b, BitmapData d, byte[] buf) { Marshal.Copy(buf, 0, d.Scan0, buf.Length); b.UnlockBits(d); }
    static byte B(double v) { v = Math.Round(v); return (byte)(v < 0 ? 0 : (v > 255 ? 255 : v)); }
    static double Clamp01(double v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
    static double Smooth(double e0, double e1, double x) { double t = Clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }

    static double Hash(int x, int y, int s) {
        unchecked {
            uint h = (uint)(x * 374761393 + y * 668265263 + s * 1442695041);
            h = (h ^ (h >> 13)) * 1274126177u; h ^= h >> 16;
            return (h & 0xFFFFFF) / 16777216.0;
        }
    }
    static double VNoise(double x, double y, int s) {
        int xi = (int)Math.Floor(x), yi = (int)Math.Floor(y);
        double fx = x - xi, fy = y - yi;
        double u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
        double a = Hash(xi, yi, s), b = Hash(xi + 1, yi, s), c = Hash(xi, yi + 1, s), d = Hash(xi + 1, yi + 1, s);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    static double Fbm(double x, double y, int s, int octaves) {
        double sum = 0, amp = 0.5, f = 1, norm = 0;
        for (int i = 0; i < octaves; i++) { sum += amp * VNoise(x * f, y * f, s + i * 31); norm += amp; amp *= 0.5; f *= 2.03; }
        return sum / norm;
    }

    // Brightness multiplier, partial desaturation, then an RGB tint. Alpha is kept.
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

    // Straight-alpha source-over composite of src onto dst (same size).
    public static void Over(Bitmap dst, Bitmap src) {
        BitmapData dd, sd; byte[] D = Read(dst, out dd); byte[] S = Read(src, out sd); src.UnlockBits(sd);
        for (int i = 0; i < D.Length; i += 4) {
            double sa = S[i + 3] / 255.0; if (sa <= 0) continue;
            double da = D[i + 3] / 255.0; double oa = sa + da * (1 - sa);
            for (int c = 0; c < 3; c++) D[i + c] = B((S[i + c] * sa + D[i + c] * da * (1 - sa)) / oa);
            D[i + 3] = B(oa * 255);
        }
        Write(dst, dd, D);
    }

    static void BoxH(float[] s, float[] t, int w, int h, int r) {
        float inv = 1f / (2 * r + 1);
        for (int y = 0; y < h; y++) {
            int row = y * w; float acc = 0;
            for (int x = 0; x <= r && x < w; x++) acc += s[row + x];
            for (int x = 0; x < w; x++) {
                t[row + x] = acc * inv;
                int xa = x + r + 1, xr = x - r;
                if (xa < w) acc += s[row + xa];
                if (xr >= 0) acc -= s[row + xr];
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
                int ya = y + r + 1, yr = y - r;
                if (ya < h) acc += s[ya * w + x];
                if (yr >= 0) acc -= s[yr * w + x];
            }
        }
    }
    // Three box passes approximate a Gaussian of the given sigma (pixels).
    static void Gauss(float[] a, int w, int h, double sigma) {
        int r = (int)Math.Round((Math.Sqrt(4 * sigma * sigma + 1) - 1) / 2); if (r < 1) r = 1;
        float[] t = new float[a.Length];
        for (int k = 0; k < 3; k++) { BoxH(a, t, w, h, r); BoxV(t, a, w, h, r); }
    }

    // Blurs the emission layer and screens it onto dst. The blurred alpha is
    // normalised so its strongest point reaches 'peak'. Returns the gain used.
    public static double Bloom(Bitmap dst, Bitmap emit, double sigma, double peak) {
        int w = emit.Width, h = emit.Height, n = w * h;
        BitmapData ed; byte[] E = Read(emit, out ed); emit.UnlockBits(ed);
        float[] r = new float[n], g = new float[n], b = new float[n], a = new float[n];
        for (int i = 0; i < n; i++) {
            float al = E[i * 4 + 3] / 255f; a[i] = al;
            b[i] = E[i * 4] / 255f * al; g[i] = E[i * 4 + 1] / 255f * al; r[i] = E[i * 4 + 2] / 255f * al;
        }
        Gauss(r, w, h, sigma); Gauss(g, w, h, sigma); Gauss(b, w, h, sigma); Gauss(a, w, h, sigma);
        float m = 0; for (int i = 0; i < n; i++) if (a[i] > m) m = a[i];
        if (m <= 0) return 0;
        double k = peak / m;
        BitmapData dd; byte[] D = Read(dst, out dd);
        for (int i = 0; i < n; i++) {
            double sb = Math.Min(1, b[i] * k), sg = Math.Min(1, g[i] * k), sr = Math.Min(1, r[i] * k);
            int j = i * 4;
            D[j] = B(255 * (1 - (1 - D[j] / 255.0) * (1 - sb)));
            D[j + 1] = B(255 * (1 - (1 - D[j + 1] / 255.0) * (1 - sg)));
            D[j + 2] = B(255 * (1 - (1 - D[j + 2] / 255.0) * (1 - sr)));
        }
        Write(dst, dd, D);
        return k;
    }

    // Matte paint grain in cells of 'cell' pixels, applied to visible pixels only.
    public static void Grain(Bitmap b, double amount, int cell, int seed) {
        BitmapData d; byte[] p = Read(b, out d); int w = b.Width;
        for (int y = 0; y < b.Height; y++) for (int x = 0; x < w; x++) {
            int i = y * d.Stride + x * 4; if (p[i + 3] == 0) continue;
            double f = 1 + amount * (Hash(x / cell, y / cell, seed) * 2 - 1);
            p[i] = B(p[i] * f); p[i + 1] = B(p[i + 1] * f); p[i + 2] = B(p[i + 2] * f);
        }
        Write(b, d, p);
    }

    // ---- Moon -------------------------------------------------------------
    // Near-side maria as soft ellipses in orthographic disc coordinates
    // (x right, y down, unit radius): cx, cy, rx, ry, strength.
    static readonly double[] Maria = {
        -0.76, -0.24, 0.20, 0.44, 1.00,   // Oceanus Procellarum (west limb)
        -0.58,  0.04, 0.20, 0.24, 0.95,   // Procellarum (south)
        -0.60, -0.50, 0.17, 0.17, 0.90,   // Procellarum (north)
        -0.47, -0.30, 0.14, 0.18, 0.85,   // Procellarum to Imbrium
        -0.26, -0.50, 0.26, 0.21, 1.00,   // Mare Imbrium
        -0.45, -0.10, 0.13, 0.10, 0.80,   // Mare Insularum
        -0.42,  0.06, 0.10, 0.10, 0.70,   // Procellarum to Cognitum
        -0.35,  0.17, 0.12, 0.09, 0.70,   // Mare Cognitum
        -0.25,  0.37, 0.17, 0.12, 0.80,   // Mare Nubium
        -0.55,  0.42, 0.08, 0.08, 0.90,   // Mare Humorum
         0.03, -0.30, 0.11, 0.08, 0.70,   // Mare Vaporum (Imbrium to Serenitatis)
         0.27, -0.45, 0.15, 0.14, 0.88,   // Mare Serenitatis
         0.47, -0.13, 0.18, 0.15, 1.00,   // Mare Tranquillitatis
         0.35, -0.02, 0.12, 0.09, 0.90,   // Tranquillitatis (south-west)
         0.60, -0.02, 0.08, 0.08, 0.80,   // Tranquillitatis to Fecunditatis
         0.80, -0.29, 0.075, 0.095, 1.00, // Mare Crisium
         0.71,  0.13, 0.11, 0.17, 0.85,   // Mare Fecunditatis
         0.52,  0.27, 0.075, 0.075, 0.85, // Mare Nectaris
        -0.15, -0.79, 0.34, 0.07, 0.42    // Mare Frigoris
    };
    // Named features: x, y, rx, ry, kind (1 bright, 2 dark), strength.
    static readonly double[] Features = {
        -0.14,  0.68, 0.045, 0.040, 1, 0.85,  // Tycho
        -0.34, -0.17, 0.030, 0.028, 1, 0.45,  // Copernicus
        -0.61, -0.14, 0.016, 0.016, 1, 0.40,  // Kepler
        -0.68, -0.40, 0.016, 0.016, 1, 0.70,  // Aristarchus
        -0.10, -0.78, 0.032, 0.018, 2, 0.35,  // Plato
        -0.90,  0.09, 0.030, 0.055, 2, 0.30   // Grimaldi
    };
    static double[] Craters, Rays;

    // Soft "mare potential": Gaussian falloff per basin, combined as a union.
    // Thresholding it with noise added gives irregular, soft shorelines.
    static double MareMask(double u, double v) {
        double keep = 1;
        for (int k = 0; k < Maria.Length; k += 5) {
            double dx = (u - Maria[k]) / Maria[k + 2], dy = (v - Maria[k + 1]) / Maria[k + 3];
            keep *= 1 - Maria[k + 4] * Math.Exp(-0.9 * (dx * dx + dy * dy));
        }
        return 1 - keep;
    }

    static void Prepare() {
        if (Craters != null) return;
        Random rnd = new Random(1969);
        var list = new System.Collections.Generic.List<double>();
        int guard = 0;
        while (list.Count < 34 * 3 && guard++ < 5000) {
            double u = rnd.NextDouble() * 2 - 1, v = rnd.NextDouble() * 2 - 1;
            if (u * u + v * v > 0.85) continue;
            if (MareMask(u, v) > 0.3) continue;
            list.Add(u); list.Add(v); list.Add(0.010 + rnd.NextDouble() * 0.018);
        }
        Craters = list.ToArray();
        var rays = new System.Collections.Generic.List<double>();
        // Tycho rays: origin x, y, angle, length, half width, intensity
        Random rr = new Random(1601);
        for (int i = 0; i < 15; i++) {
            double a = i * 2 * Math.PI / 15 + (rr.NextDouble() - 0.5) * 0.35;
            rays.Add(-0.14); rays.Add(0.68); rays.Add(a); rays.Add(0.35 + rr.NextDouble() * 0.85);
            rays.Add(0.012 + rr.NextDouble() * 0.012); rays.Add(0.15 + rr.NextDouble() * 0.10);
        }
        for (int i = 0; i < 9; i++) {
            double a = i * 2 * Math.PI / 9 + (rr.NextDouble() - 0.5) * 0.5;
            rays.Add(-0.34); rays.Add(-0.17); rays.Add(a); rays.Add(0.12 + rr.NextDouble() * 0.18);
            rays.Add(0.010); rays.Add(0.06);
        }
        Rays = rays.ToArray();
    }

    static void Albedo(double u, double v, out double r, out double g, out double b) {
        // Two-scale domain warp gives the maria ragged, organic shorelines.
        double wu = u + 0.16 * (Fbm(u * 2.2 + 5.1, v * 2.2 + 1.3, 7, 4) - 0.5) + 0.05 * (Fbm(u * 9 + 2, v * 9 - 3, 17, 3) - 0.5);
        double wv = v + 0.16 * (Fbm(u * 2.2 - 4.2, v * 2.2 + 9.7, 8, 4) - 0.5) + 0.05 * (Fbm(u * 9 - 6, v * 9 + 4, 18, 3) - 0.5);
        double P = MareMask(wu, wv) + 0.36 * (Fbm(u * 7 + 1, v * 7 + 2, 23, 4) - 0.5);
        double M = Smooth(0.18, 0.70, P);
        double mott = Fbm(u * 5 + 11, v * 5 + 3, 3, 4), fine = Fbm(u * 20, v * 20, 5, 3);
        // Highlands: broad brightness drift plus fine speckle; the south is brighter.
        double hl = (0.84 + 0.22 * mott) * (0.93 + 0.12 * fine) + 0.03 * v;
        // Maria: 60-75 % of the local highland tone, with patchy internal variation.
        double rel = 0.60 + 0.15 * Fbm(u * 3.5 - 7, v * 3.5 + 5, 29, 4) + 0.04 * (fine - 0.5);
        double ml = hl * rel;
        r = 0.953 * hl + (0.905 * ml - 0.953 * hl) * M;
        g = 0.918 * hl + (0.900 * ml - 0.918 * hl) * M;
        b = 0.839 * hl + (0.860 * ml - 0.839 * hl) * M;
        double bright = 0, dark = 0;
        for (int k = 0; k < Features.Length; k += 6) {
            double dx = (u - Features[k]) / Features[k + 2], dy = (v - Features[k + 1]) / Features[k + 3];
            double e = Math.Sqrt(dx * dx + dy * dy);
            if (Features[k + 4] == 1) {
                bright = Math.Max(bright, Features[k + 5] * Smooth(1.25, 0.35, e));
                bright = Math.Max(bright, Features[k + 5] * 0.22 * Smooth(4.5, 1.2, e));
            } else dark = Math.Max(dark, Features[k + 5] * Smooth(1.1, 0.5, e));
        }
        // Tycho's dark collar: broad and faint so it never reads as a ring.
        { double dx = (u + 0.14) / 0.035, dy = (v - 0.68) / 0.030; double e = Math.Sqrt(dx * dx + dy * dy);
          dark = Math.Max(dark, 0.06 * Smooth(1.0, 1.8, e) * Smooth(4.0, 2.0, e)); }
        for (int k = 0; k < Craters.Length; k += 3) {
            // Soft dots: a dark floor with a bright rim spot offset up-left, no outline.
            double cr = Craters[k + 2];
            double dx = (u - Craters[k]) / cr, dy = (v - Craters[k + 1]) / cr;
            if (dx * dx + dy * dy > 9) continue;
            if ((k / 3) % 3 == 0) { bright = Math.Max(bright, 0.16 * Math.Exp(-1.6 * (dx * dx + dy * dy))); continue; }
            dark = Math.Max(dark, 0.04 * Math.Exp(-1.6 * (dx * dx + dy * dy)));
            double bx = dx + 0.55, by = dy + 0.55;
            bright = Math.Max(bright, 0.10 * Math.Exp(-2.5 * (bx * bx + by * by)));
        }
        for (int k = 0; k < Rays.Length; k += 6) {
            double ox = u - Rays[k], oy = v - Rays[k + 1];
            double ca = Math.Cos(Rays[k + 2]), sa = Math.Sin(Rays[k + 2]);
            double t = ox * ca + oy * sa; if (t < 0.03 || t > Rays[k + 3]) continue;
            double perp = Math.Abs(-ox * sa + oy * ca);
            double hw = Rays[k + 4] * (1 + 1.5 * t / Rays[k + 3]);
            double f = Math.Pow(1 - t / Rays[k + 3], 1.3) * Smooth(hw, 0, perp) * Rays[k + 5];
            bright = Math.Max(bright, f);
        }
        r *= 1 - dark; g *= 1 - dark; b *= 1 - dark;
        r += (1.0 - r) * bright; g += (0.98 - g) * bright; b += (0.93 - b) * bright;
    }

    // Shaded sphere of diameter 'disc' pixels inside a transparent margin.
    // phase: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
    // Northern-hemisphere view: waxing lit on the right, waning on the left.
    public static Bitmap RenderMoon(int disc, int pad, double phase, double earth) {
        Prepare();
        int size = disc + 2 * pad;
        Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        BitmapData d; byte[] p = Read(bmp, out d);
        double R = disc / 2.0, c = size / 2.0;
        double th = 2 * Math.PI * phase, sx = Math.Sin(th), sz = -Math.Cos(th);
        for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
            double px = x + 0.5 - c, py = y + 0.5 - c; double dist = Math.Sqrt(px * px + py * py);
            double cov = R - dist + 0.5; if (cov <= -2) continue; cov = Clamp01(cov);
            double u = px / R, v = py / R; double rr = Math.Sqrt(u * u + v * v);
            if (rr > 0.995) { u *= 0.995 / rr; v *= 0.995 / rr; }
            double nz = Math.Sqrt(Math.Max(0, 1 - u * u - v * v));
            double ar, ag, ab; Albedo(u, v, out ar, out ag, out ab);
            double mu0 = u * sx + nz * sz;
            // Screen-space distance to the terminator (in disc radii), so the
            // soft band is about 7 % of the diameter in every phase.
            double nzc = Math.Max(nz, 0.12);
            double gu = sx - sz * u / nzc, gv = -sz * v / nzc;
            double tdist = mu0 / Math.Max(0.35, Math.Sqrt(gu * gu + gv * gv));
            double T = Smooth(-0.07, 0.07, tdist);
            double m0 = Math.Max(mu0, 0);
            double ls = Math.Min(1.12, 2 * m0 / (m0 + nz + 0.03));   // Lommel-Seeliger
            double lit = T * (0.40 + 0.60 * ls) * (0.86 + 0.14 * nz);  // mild limb darkening
            double lum = 0.2126 * ar + 0.7152 * ag + 0.0722 * ab;
            double es = earth * (1 - T) * (0.85 + 0.15 * nz);
            double r = ar * lit + lum * es * 0.86, g = ag * lit + lum * es * 0.95, bl = ab * lit + lum * es * 1.10;
            int i = y * d.Stride + x * 4;
            p[i] = B(bl * 255); p[i + 1] = B(g * 255); p[i + 2] = B(r * 255); p[i + 3] = B(cov * 255);
        }
        Write(bmp, d, p);
        return bmp;
    }
}
'@
}

# ---------------------------------------------------------------------------
# Layers, colours, text
# ---------------------------------------------------------------------------
function New-Layer([int]$width=450,[int]$height=450) {
    $bmp=New-Object System.Drawing.Bitmap(($width*2),($height*2),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gr=[System.Drawing.Graphics]::FromImage($bmp)
    $gr.SmoothingMode='AntiAlias'; $gr.TextRenderingHint='AntiAliasGridFit'; $gr.InterpolationMode='HighQualityBicubic'
    $gr.Clear([System.Drawing.Color]::Transparent); $gr.ScaleTransform(2,2)
    return [pscustomobject]@{ Bitmap=$bmp; G=$gr; W=$width; H=$height }
}
function Use-Layer($layer) { $script:g=$layer.G }
function Close-Layer($layer) { $layer.G.Dispose(); $layer.Bitmap.Dispose() }
function Save-Layer($layer,[string]$path) {
    $out=New-Object System.Drawing.Bitmap($layer.W,$layer.H)
    $og=[System.Drawing.Graphics]::FromImage($out)
    $og.CompositingMode='SourceCopy'; $og.InterpolationMode='HighQualityBicubic'
    $og.DrawImage($layer.Bitmap,0,0,$layer.W,$layer.H)
    $out.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
    $og.Dispose(); $out.Dispose()
}
function Mix([string]$a,[string]$b,[double]$t) {
    $ca=C $a; $cb=C $b
    '#{0:x2}{1:x2}{2:x2}' -f [int]($ca.R+($cb.R-$ca.R)*$t),[int]($ca.G+($cb.G-$ca.G)*$t),[int]($ca.B+($cb.B-$ca.B)*$t)
}
function Argb([int]$alpha,[string]$hex) { $c=C $hex; [System.Drawing.Color]::FromArgb($alpha,$c.R,$c.G,$c.B) }
function Fill-Path($path,[string]$hex) { $b=Brush $hex; $script:g.FillPath($b,$path); $b.Dispose() }
function Stroke-Path($path,[string]$hex,[float]$width,[int]$alpha=255) {
    $p=New-Object System.Drawing.Pen((Argb $alpha $hex),$width); $script:g.DrawPath($p,$path); $p.Dispose()
}
function Blend-Brush([float]$x,[float]$y,[float]$w,[float]$h,[string[]]$colors,[single[]]$positions,[float]$angle=0) {
    $rect=[System.Drawing.RectangleF]::new($x,$y,$w,$h)
    $br=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,(C $colors[0]),(C $colors[-1]),$angle)
    $blend=New-Object System.Drawing.Drawing2D.ColorBlend($colors.Count)
    $blend.Colors=[System.Drawing.Color[]]@($colors | ForEach-Object { C $_ }); $blend.Positions=$positions
    $br.InterpolationColors=$blend; $br.WrapMode='TileFlipXY'
    return $br
}

$script:measureBitmap=New-Object System.Drawing.Bitmap(8,8)
$script:measureG=[System.Drawing.Graphics]::FromImage($script:measureBitmap)
$script:measureG.TextRenderingHint='AntiAliasGridFit'; $script:measureG.ScaleTransform(2,2)
$script:typo=[System.Drawing.StringFormat]::GenericTypographic.Clone()
$script:typo.FormatFlags=[System.Drawing.StringFormatFlags]'NoWrap,NoClip,MeasureTrailingSpaces'
# Same font request as the dial art's Label helper (it resolves the same way).
function New-Font([float]$size) { New-Object System.Drawing.Font('Arial Narrow',$size,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel) }
function Text-Width([string]$text,$font) { $script:measureG.MeasureString($text,$font,[System.Drawing.PointF]::new(0,0),$script:typo).Width }
function Font-Ascent($font) { $font.Size*$font.FontFamily.GetCellAscent($font.Style)/$font.FontFamily.GetEmHeight($font.Style) }
function Cap-Height([float]$size) { 0.72*$size }
function Tracked-Width([string]$text,$font,[float]$tracking) {
    if($tracking -eq 0) { return (Text-Width $text $font) }
    $w=0; foreach($ch in $text.ToCharArray()) { $w+=(Text-Width ([string]$ch) $font)+$tracking }
    return ($w-$tracking)
}
function Draw-Tracked([string]$text,$font,[string]$hex,[float]$x,[float]$top,[float]$tracking,[int]$alpha=255) {
    $b=New-Object System.Drawing.SolidBrush((Argb $alpha $hex))
    if($tracking -eq 0) { $script:g.DrawString($text,$font,$b,$x,$top,$script:typo) }
    else { foreach($ch in $text.ToCharArray()) { $s=[string]$ch; $script:g.DrawString($s,$font,$b,$x,$top,$script:typo); $x+=(Text-Width $s $font)+$tracking } }
    $b.Dispose()
}
# Draws a line of mixed-size runs sharing one baseline. Each run is a
# hashtable: T text, S size, C colour, Tr tracking, Pre gap before, Bar
# (a thin vertical separator of width W instead of text).
function Text-Runs([object[]]$runs,[float]$x,[float]$baseline,[string]$align='center',[float]$dy=0,[string]$override='',[int]$alpha=255) {
    $total=0; $widths=@()
    foreach($r in $runs) {
        $pre=0; if($r.Pre) { $pre=[float]$r.Pre }
        if($r.Bar) { $w=[float]$r.W } else { $f=New-Font ([float]$r.S); $tr=0; if($r.Tr) { $tr=[float]$r.Tr }; $w=Tracked-Width $r.T $f $tr; $f.Dispose() }
        $widths+=$w; $total+=$pre+$w
    }
    $cx=$x; if($align -eq 'center') { $cx=$x-$total/2 } elseif($align -eq 'right') { $cx=$x-$total }
    for($i=0;$i -lt $runs.Count;$i++) {
        $r=$runs[$i]; if($r.Pre) { $cx+=[float]$r.Pre }
        $color=$r.C; if($override) { $color=$override }
        if($r.Bar) {
            $p=New-Object System.Drawing.Pen((Argb $alpha $color),[float]$r.Lw)
            $script:g.DrawLine($p,($cx+$widths[$i]/2),($baseline+$dy-[float]$r.H),($cx+$widths[$i]/2),($baseline+$dy+1)); $p.Dispose()
        } else {
            $f=New-Font ([float]$r.S); $tr=0; if($r.Tr) { $tr=[float]$r.Tr }
            Draw-Tracked $r.T $f $color $cx ($baseline+$dy-(Font-Ascent $f)) $tr $alpha; $f.Dispose()
        }
        $cx+=$widths[$i]
    }
}
# Places each glyph rotated along a circle, centred on clock angle 0 (top).
# The baseline lies on the circle and glyphs stand outward.
function Arc-Text([object[]]$runs,[float]$cx,[float]$cy,[float]$radius,[float]$tracking,[string]$only='') {
    $glyphs=@()
    foreach($r in $runs) {
        $f=New-Font ([float]$r.S)
        foreach($ch in $r.T.ToCharArray()) { $glyphs+=,@([string]$ch,(Text-Width ([string]$ch) $f),$r) }
        $f.Dispose()
    }
    $total=0; foreach($gl in $glyphs) { $total+=$gl[1]+$tracking }; $total-=$tracking
    $pos=-$total/2
    foreach($gl in $glyphs) {
        $r=$gl[2]; $angle=($pos+$gl[1]/2)/$radius*180/[math]::PI
        if($gl[0] -ne ' ' -and (-not $only -or $r.Role -eq $only)) {
            $f=New-Font ([float]$r.S); $state=$script:g.Save()
            $script:g.TranslateTransform($cx,$cy); $script:g.RotateTransform($angle); $script:g.TranslateTransform(0,-$radius)
            $color=$r.C; if($r.Shadow) { Draw-Tracked $gl[0] $f $r.Shadow (-$gl[1]/2) (0.55-(Font-Ascent $f)) 0 150 }
            Draw-Tracked $gl[0] $f $color (-$gl[1]/2) (-(Font-Ascent $f)) 0
            $script:g.Restore($state); $f.Dispose()
        }
        $pos+=$gl[1]+$tracking
    }
}

# Copied from New-Previews.ps1 so the fixtures match normal.png exactly.
function Asset([string]$name,[float]$x,[float]$y,[float]$w,[float]$h,[float]$angle=0,[float]$px=0.5,[float]$py=0.5) {
    $image=[System.Drawing.Image]::FromFile((Join-Path $sourceAssetRoot ($name+'.png')))
    $state=$script:g.Save()
    $script:g.TranslateTransform(($x+$px*$w),($y+$py*$h)); $script:g.RotateTransform($angle)
    $script:g.TranslateTransform((-$px*$w),(-$py*$h))
    $script:g.DrawImage($image,[float]0,[float]0,$w,$h)
    $script:g.Restore($state); $image.Dispose()
}
function FillGauge([float]$radius,[float]$ratio,[string[]]$colors) {
    $ratio=[math]::Min(1.0,[math]::Max(0.0,[double]$ratio))
    if($ratio -le 0) { return }
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
function DrumLabel([string]$text,[float]$x,[float]$y,[float]$width,[bool]$receding,[string]$color='#f6f6f0',[float]$size=22) {
    $state=$script:g.Save()
    if($receding) {
        $script:g.TranslateTransform(($x+$width/2),($y+13)); $script:g.ScaleTransform(0.94,0.58)
        $script:g.TranslateTransform((-$x-$width/2),(-$y-13)); $color='#c3c3c3'
    }
    Label $text $x ($y-2) $size $color $width
    $script:g.Restore($state)
}

# ---------------------------------------------------------------------------
# Fixture moon phase: evaluate the production expression for the fixture date
# with the display easing term removed, which leaves the linear lunation angle.
# ---------------------------------------------------------------------------
$moonFixture=[DateTime]::new(2026,11,1,12,0,0,[DateTimeKind]::Utc)
[xml]$faceXml=Get-Content -LiteralPath (Join-Path $repoRoot 'watchface\src\main\res\raw\watchface.xml') -Raw -Encoding UTF8
$rawExpression=$faceXml.SelectSingleNode('//PartImage[@name="moon_disc_rotation"]/Transform').value
function Convert-MoonExpression([string]$expression) {
    $expression.Replace('[YEAR]',[string]$moonFixture.Year).Replace('[DAY_OF_YEAR]',[string]$moonFixture.DayOfYear).Replace('[AMPM_STATE]','1').Replace('floor(','[math]::Floor(').Replace('sin(','[math]::Sin(')
}
$fixturePhase=$null
if($rawExpression.Contains('7.5 * sin(')) {
    $fullAngle=& ([scriptblock]::Create((Convert-MoonExpression $rawExpression)))
    $linearAngle=& ([scriptblock]::Create((Convert-MoonExpression $rawExpression.Replace('7.5 * sin(','0 * sin('))))
    # Consistency check: the full expression must equal linear + 7.5 sin(2 linear).
    if([math]::Abs($fullAngle-($linearAngle+7.5*[math]::Sin($linearAngle*[math]::PI/90))) -lt 1e-6) {
        # -90 is new moon, and 180 degrees of wheel travel is one lunation.
        $fixturePhase=((($linearAngle+90)/180)%1+1)%1
    }
}
if($null -eq $fixturePhase) { Write-Warning 'Could not derive the fixture phase; using waning 55% illumination.'; $fixturePhase=1-[math]::Acos(1-2*0.55)/(2*[math]::PI) }
$illumination=(1-[math]::Cos(2*[math]::PI*$fixturePhase))/2
Write-Host ('Fixture moon phase {0:N4} of a lunation ({1}), {2:P0} illuminated.' -f $fixturePhase,$(if($fixturePhase -lt 0.5){'waxing'}else{'waning'}),$illumination)

$script:moonCache=@{}
function Draw-Moon([float]$cx,[float]$cy,[float]$diameter,[double]$phase) {
    $key='{0}:{1:N5}' -f $diameter,$phase
    if(-not $script:moonCache.ContainsKey($key)) { $script:moonCache[$key]=[TritiumFx]::RenderMoon([int]($diameter*4),8,$phase,0.11) }
    $bmp=$script:moonCache[$key]
    $attributes=New-Object System.Drawing.Imaging.ImageAttributes; $attributes.SetWrapMode('TileFlipXY')
    $half=$diameter/2+2
    $state=$script:g.Save(); $script:g.InterpolationMode='HighQualityBicubic'
    $script:g.TranslateTransform(($cx-$half),($cy-$half)); $script:g.ScaleTransform((2*$half/$bmp.Width),(2*$half/$bmp.Height))
    $script:g.DrawImage($bmp,([System.Drawing.Rectangle]::new(0,0,$bmp.Width,$bmp.Height)),0,0,$bmp.Width,$bmp.Height,[System.Drawing.GraphicsUnit]::Pixel,$attributes)
    $script:g.Restore($state); $attributes.Dispose()
}

# ---------------------------------------------------------------------------
# Dial
# ---------------------------------------------------------------------------
# The arch is unchanged (centre 225,133, radius 87); the scallops are gone and
# the clean dome runs down behind the top lip of the calendar bezel (y 116).
function Dome-Path {
    $p=New-Object System.Drawing.Drawing2D.GraphicsPath
    $start=180+[math]::Asin(14/87)*180/[math]::PI
    $p.AddArc(138,46,174,174,$start,(540-2*$start)); $p.CloseFigure(); return $p
}
function Numeral-Position([int]$hour) {
    $a=$hour*30*[math]::PI/180; $radius=174; $size=26
    if($hour -eq 12) { $radius=201; $size=29 }
    if($hour -eq 6) { $radius=210; $size=29 }
    return @((225+$radius*[math]::Sin($a)),(225-$radius*[math]::Cos($a)),$size)
}
function Draw-Numerals([int[]]$hours,[string]$color) {
    foreach($hour in $hours) { $n=Numeral-Position $hour; Label ([string]$hour) ($n[0]-25) ($n[1]-$n[2]*0.65) $n[2] $color 50 }
}

# Copy of the dial_frame construction in New-DialAssets.ps1 with three options:
# hour bars on or off, which numerals are printed, and the face gradient. The
# moon aperture is the plain dome without the cloud scallops.
function Draw-DialFrame($cfg) {
    Ellipse '#181818' 1 1 448 448
    $p=Pen '#a9a9a5' 0.8; $script:g.DrawEllipse($p,2,2,446,446); $p.Dispose()
    Ellipse '#020202' 5 5 440 440; Ellipse '#101112' 31 31 388 388
    $facePath=New-Object System.Drawing.Drawing2D.GraphicsPath; $facePath.AddEllipse(32,32,386,386)
    $faceBrush=New-Object System.Drawing.Drawing2D.PathGradientBrush($facePath)
    $faceBrush.CenterColor=C $cfg.FaceCenter; $faceBrush.SurroundColors=@((C $cfg.FaceEdge))
    $script:g.FillPath($faceBrush,$facePath); $faceBrush.Dispose(); $facePath.Dispose()
    for($index=0;$index -lt 60;$index++) {
        $angle=$index*6*[math]::PI/180
        $hour=($index%5 -eq 0); $outer=213; $inner=202; $thickness=2.8; $color='#ff5d0a'
        if($hour) { if(-not $cfg.HourBars) { continue }; $inner=197; $thickness=6; $color='#b7b7b4' }
        if($index -eq 0 -or $index -eq 30) { continue }
        # Minute ticks that would crowd a flanking tube at 12 or 6 are left out.
        if($cfg.Flank -and -not $hour) {
            $crowded=$false
            foreach($fa in (Get-FlankAngles)) { $diff=[math]::Abs((($index*6-$fa)%360+540)%360-180); if($diff -lt 3.6) { $crowded=$true } }
            if($crowded) { continue }
        }
        Line $color $thickness (225+$inner*[math]::Sin($angle)) (225-$inner*[math]::Cos($angle)) (225+$outer*[math]::Sin($angle)) (225-$outer*[math]::Cos($angle))
    }
    Draw-Numerals $cfg.Numerals '#b7b7b4'
    $aperture=Dome-Path
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
    RoundFill '#030404' 128 117 194 73 8
    foreach($drumX in @(135,195,255)) {
        $rect=[System.Drawing.RectangleF]::new($drumX,122,60,62)
        $b=New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,(C '#030404'),(C '#030404'),90)
        $blend=New-Object System.Drawing.Drawing2D.ColorBlend(5)
        $blend.Colors=@((C '#030404'),(C '#181c1e'),(C '#111416'),(C '#1c2022'),(C '#020303'))
        $blend.Positions=[single[]]@(0,0.24,0.5,0.76,1)
        $b.InterpolationColors=$blend; $script:g.FillRectangle($b,$rect); $b.Dispose()
    }
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
    $stepsIcon=RingPoint 150 222; $minutesIcon=RingPoint 168 222; $caloriesIcon=RingPoint 186 222
    Feet ($stepsIcon.X-5) ($stepsIcon.Y-4.5) '#ff6814'
    $iconState=$script:g.Save(); $script:g.TranslateTransform($minutesIcon.X,$minutesIcon.Y); $script:g.ScaleTransform(0.72,0.72)
    Runner -7 -10.5 '#00d8eb'; $script:g.Restore($iconState)
    $iconState=$script:g.Save(); $script:g.TranslateTransform($caloriesIcon.X,$caloriesIcon.Y); $script:g.ScaleTransform(0.72,0.72)
    Flame -7.5 -11.5 '#72f000'; $script:g.Restore($iconState)
}

# Fixed, seeded star field shared by all concepts.
$script:stars=@()
$starRandom=New-Object System.Random(2026)
for($i=0;$i -lt 60;$i++) {
    $x=146+$starRandom.NextDouble()*158; $y=50+$starRandom.NextDouble()*64
    $size=0.7+$starRandom.NextDouble()*0.8; $bright=$starRandom.NextDouble()
    if([math]::Sqrt([math]::Pow($x-225,2)+[math]::Pow($y-133,2)) -gt 82) { continue }
    $script:stars+=,@($x,$y,$size,$bright)
}
function Star-Allowed($cfg,$star) {
    $dm=[math]::Sqrt([math]::Pow($star[0]-$cfg.MoonX,2)+[math]::Pow($star[1]-$cfg.MoonY,2))
    if($dm -lt $cfg.MoonD/2+4) { return $false }
    if([math]::Sqrt([math]::Pow($star[0]-225,2)+[math]::Pow($star[1]-133,2)) -gt $cfg.StarMaxR) { return $false }
    foreach($r in $cfg.StarMask) { if($star[0] -ge $r[0] -and $star[0] -le $r[2] -and $star[1] -ge $r[1] -and $star[1] -le $r[3]) { return $false } }
    return $true
}
function Draw-Sky($cfg,[string]$part) {
    $dome=Dome-Path
    if($part -eq 'all' -or $part -eq 'sky') {
        $b=Blend-Brush 138 44 174 76 @('#03091a','#071631','#0b1f3c') ([single[]]@(0,0.55,1)) 90
        $script:g.FillPath($b,$dome); $b.Dispose()
    }
    if(($part -eq 'all' -or $part -eq 'sky') -and $cfg.Haze -gt 0) {
        # A faint moonlit haze around the disc.
        $haze=New-Object System.Drawing.Drawing2D.GraphicsPath; $hr=$cfg.MoonD*0.95
        $haze.AddEllipse(($cfg.MoonX-$hr),($cfg.MoonY-$hr),($hr*2),($hr*2))
        $hb=New-Object System.Drawing.Drawing2D.PathGradientBrush($haze)
        $hb.CenterColor=[System.Drawing.Color]::FromArgb([int]$cfg.Haze,120,150,190); $hb.SurroundColors=@([System.Drawing.Color]::FromArgb(0,120,150,190))
        $state=$script:g.Save(); $script:g.SetClip($dome); $script:g.FillPath($hb,$haze); $script:g.Restore($state)
        $hb.Dispose(); $haze.Dispose()
    }
    if($part -eq 'all' -or $part -eq 'stars') {
        foreach($s in $script:stars) {
            if(-not (Star-Allowed $cfg $s)) { continue }
            $color=Mix '#6f86a0' '#dfe8f2' $s[3]
            Ellipse $color ($s[0]-$s[2]/2) ($s[1]-$s[2]/2) $s[2] $s[2]
        }
    }
    if($part -eq 'all' -or $part -eq 'moon') {
        if($cfg.MoonStyle -eq 'mechanical') { Draw-MechMoon 'all' } else { Draw-Moon $cfg.MoonX $cfg.MoonY $cfg.MoonD $fixturePhase }
    }
    $dome.Dispose()
}

# ---------------------------------------------------------------------------
# Mechanical moon (round 2): an upright engraved metal disc that travels
# across the window, with a blued-steel shade covering exactly its unlit part.
# The dial frame is drawn over it afterwards, so the frame hides whatever
# passes behind the arch rim or the calendar lip.
# ---------------------------------------------------------------------------
$mechR=22
$script:mechPhase=$fixturePhase
function Get-MechCenter([double]$p) {
    $s=2*$p-1; $a=[math]::Abs($s); $sg=1; if($s -lt 0) { $sg=-1 }
    if($a -le 0.9) { return @((225+62*$s),(80+10*$s*$s)) }
    $t=($a-0.9)/0.1; $x0=225+$sg*62*0.9; $y0=80+10*0.81
    return @(($x0+(225+$sg*108-$x0)*$t),($y0+(100-$y0)*$t))
}
# Terminator x_t(y) = c * sqrt(R^2 - y^2) from the top pole to the bottom pole
# (moon-centred, y down); mirrored for waning. Sampled densely near the poles.
function Get-TerminatorPoints([double]$c,[bool]$waning,[double]$R) {
    $pts=New-Object System.Collections.Generic.List[System.Drawing.PointF]
    for($i=0;$i -le 120;$i++) {
        $y=-$R*[math]::Cos([math]::PI*$i/120); $x=$c*[math]::Sqrt([math]::Max(0,$R*$R-$y*$y)); if($waning) { $x=-$x }
        $pts.Add([System.Drawing.PointF]::new($x,$y))
    }
    return ,$pts.ToArray()
}
function Get-ShadePath([double]$c,[bool]$waning,[double]$R) {
    $path=New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddLines((Get-TerminatorPoints $c $waning $R))
    $ro=$R+1
    # Outer edge follows the limb at R+1 on the shaded side, bottom back to top.
    if($waning) { $path.AddArc(-$ro,-$ro,2*$ro,2*$ro,90,-180) } else { $path.AddArc(-$ro,-$ro,2*$ro,2*$ro,90,180) }
    $path.CloseFigure(); return $path
}
function Draw-MechMoon([string]$part='all') {
    $p=$script:mechPhase; $R=$mechR
    $center=Get-MechCenter $p
    $k=(1-[math]::Cos(2*[math]::PI*$p))/2; $c=1-2*$k; $waning=($p -gt 0.5)
    # Supersampled offscreen drawing at 8 px per unit, then scaled into the layer.
    $scale=8; $pad=4; $size=[int](2*($R+$pad)*$scale)
    $bmp=New-Object System.Drawing.Bitmap($size,$size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $mg=[System.Drawing.Graphics]::FromImage($bmp); $mg.SmoothingMode='AntiAlias'; $mg.Clear([System.Drawing.Color]::Transparent)
    $mg.TranslateTransform(($size/2),($size/2)); $mg.ScaleTransform($scale,$scale)
    $outer=$script:g; $script:g=$mg
    $discRect=[System.Drawing.RectangleF]::new(-$R,-$R,2*$R,2*$R)
    if($part -eq 'all' -or $part -eq 'moon') {
        # Production moon art (New-DialAssets.ps1): cream metallic gradient and
        # engraved craters, scaled from radius 26 to 22.
        $b=New-Object System.Drawing.Drawing2D.LinearGradientBrush($discRect,(C '#fff2d7'),(C '#8d8b83'),45)
        $mg.FillEllipse($b,$discRect); $b.Dispose()
        $state=$mg.Save(); $clip=New-Object System.Drawing.Drawing2D.GraphicsPath; $clip.AddEllipse($discRect); $mg.SetClip($clip)
        $f=$R/26
        foreach($crater in @(@(-8,-5,10),@(12.5,7.5,13),@(-2.5,16.5,7),@(15,-12,6),@(-16,10,4))) {
            $x=$crater[0]*$f; $y=$crater[1]*$f; $d=$crater[2]*$f
            Ellipse '#888b87' ($x-$d/2) ($y-$d/2) $d $d; Ellipse '#b9b8ac' ($x-$d/2+$f) ($y-$d/2+$f) ($d-2*$f) ($d-2*$f)
        }
        # Slight domed shading: a soft highlight up-left, darkening toward the rim.
        $dome=New-Object System.Drawing.Drawing2D.PathGradientBrush($clip)
        $dome.CenterPoint=[System.Drawing.PointF]::new((-0.32*$R),(-0.36*$R))
        $dome.CenterColor=[System.Drawing.Color]::FromArgb(70,255,250,236); $dome.SurroundColors=@([System.Drawing.Color]::FromArgb(70,52,46,36))
        $mg.FillPath($dome,$clip); $dome.Dispose()
        $mg.Restore($state); $clip.Dispose()
        $pen=New-Object System.Drawing.Pen((C '#5f5b50'),0.7); $mg.DrawEllipse($pen,(-$R+0.35),(-$R+0.35),(2*$R-0.7),(2*$R-0.7)); $pen.Dispose()
    }
    if(($part -eq 'all' -or $part -eq 'shade') -and $k -lt 0.995) {
        $shade=Get-ShadePath $c $waning $R
        $term=Get-TerminatorPoints $c $waning $R
        # Soft shadow cast by the shade onto the lit surface (about 1.5 units).
        $lit=New-Object System.Drawing.Region($discRect); $lit.Exclude($shade)
        $state=$mg.Save(); $mg.SetClip($lit,'Replace')
        foreach($w in @(@(3.0,34),@(2.0,40),@(1.0,52))) {
            $pen=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($w[1],0,0,0),$w[0]); $mg.DrawLines($pen,$term); $pen.Dispose()
        }
        $mg.Restore($state); $lit.Dispose()
        # Blued steel with faint brushed lines.
        $b=Blend-Brush (-$R-1) (-$R-1) (2*$R+2) (2*$R+2) @('#16233d','#1d2d4b','#24375c') ([single[]]@(0,0.5,1)) 60
        $mg.FillPath($b,$shade); $b.Dispose()
        $state=$mg.Save(); $mg.SetClip($shade)
        $rnd=New-Object System.Random(3101)
        for($ly=-$R-1;$ly -le $R+1;$ly+=0.45) {
            $tone=255; if($rnd.NextDouble() -lt 0.5) { $tone=0 }
            $pen=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb((6+$rnd.Next(0,12)),$tone,$tone,$tone),0.22)
            $mg.DrawLine($pen,(-$R-1),$ly,($R+1),($ly+0.6)); $pen.Dispose()
        }
        # Polished highlight along the terminator edge, kept inside the shade.
        $pen=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180,143,163,196),1.6); $pen.LineJoin='Round'
        $mg.DrawLines($pen,$term); $pen.Dispose()
        $mg.Restore($state); $shade.Dispose()
    }
    $script:g=$outer; $mg.Dispose()
    $attributes=New-Object System.Drawing.Imaging.ImageAttributes; $attributes.SetWrapMode('TileFlipXY')
    $half=$R+$pad
    $state=$script:g.Save(); $script:g.InterpolationMode='HighQualityBicubic'
    $script:g.TranslateTransform(($center[0]-$half),($center[1]-$half)); $script:g.ScaleTransform((2*$half/$size),(2*$half/$size))
    $script:g.DrawImage($bmp,([System.Drawing.Rectangle]::new(0,0,$size,$size)),0,0,$size,$size,[System.Drawing.GraphicsUnit]::Pixel,$attributes)
    $script:g.Restore($state); $attributes.Dispose(); $bmp.Dispose()
}
# Restricts drawing to what the window shows: the dome, above the calendar lip.
function Set-WindowClip {
    $dome=Dome-Path; $script:g.SetClip($dome)
    $script:g.SetClip([System.Drawing.RectangleF]::new(0,0,450,116),[System.Drawing.Drawing2D.CombineMode]::Intersect); $dome.Dispose()
}

# Readouts that match normal.png. Groups let low-light exceptions redraw a
# single element on its own layer.
function Draw-Readouts([string]$part='all') {
    if($part -eq 'all' -or $part -eq 'date' -or $part -eq 'weekday' -or $part -eq 'monthday') {
        if($part -eq 'all') { DrumLabel 'SAT' 136 114 57 $true; DrumLabel 'OCT' 197 114 55 $true; DrumLabel '31' 258 114 55 $true }
        if($part -ne 'monthday') { DrumLabel 'SUN' 136 136 57 $false '#ff6a15' 26 }
        if($part -ne 'weekday') { DrumLabel 'NOV' 197 136 55 $false '#f6f6f0' 26; DrumLabel '01' 258 136 55 $false '#f6f6f0' 26 }
        if($part -eq 'all') { DrumLabel 'MON' 136 166 57 $true; DrumLabel 'DEC' 197 166 55 $true; DrumLabel '02' 258 166 55 $true }
    }
    if($part -eq 'all') { Asset 'calendar_bezel' 125 114 200 79 }
    if($part -eq 'all' -or $part -eq 'battery') { Asset 'battery_slider' 359 (274-99*73/100) 21 13 }
    if($part -eq 'all') {
        Asset 'wx_14' 63 194 47 47
        Label ('56'+$degree) 52 236 29 '#f4f4ef' 75; Label ('H 61'+$degree+'F') 52 267 14 '#f4f4ef' 75
    }
    if($part -eq 'all' -or $part -eq 'steps') { Label '6,482' 169 257 34 '#f4f4ef' 112 }
    if($part -eq 'all') { Label '42' 178 307 23 '#f4f4ef' 53; Label '380' 262 307 23 '#f4f4ef' 57 }
    if($part -eq 'all' -or $part -eq 'gauges') {
        FillGauge 150 (6482/8000) @('#662400','#bf4005','#ff7415','#ffd79b','#ff9c40','#df5206','#702500')
        FillGauge 168 (42/60) @('#004955','#008f9e','#00d6e9','#b2faff','#38e9f4','#00a7bc','#004e60')
        FillGauge 186 (380/500) @('#254d00','#4a9700','#79ef06','#e0ffad','#a0ff30','#65c900','#2b5b00')
    }
    if($part -eq 'all') { Label '8,000' 312 318 13 '#eeeeeb' 43; Label '60' 325 331 13 '#eeeeeb' 43; Label '500' 337 343 13 '#eeeeeb' 43 }
}

# ---------------------------------------------------------------------------
# Lume elements. Styles: seat (steel bed), glass (unlit tube), paint (unlit
# painted lume), glow (crisp lit tube), emit (bloom source).
# ---------------------------------------------------------------------------
function Tube([float]$x,[float]$y,[float]$w,[float]$h,[string]$style,$pal) {
    $r=$w/2
    if($style -eq 'seat') {
        $m=0.9; $p=RoundPath ($x-$m) ($y-$m) ($w+2*$m) ($h+2*$m) ($r+$m)
        Fill-Path $p '#3c4244'; Stroke-Path $p '#151819' 0.45; $p.Dispose(); return
    }
    $path=RoundPath $x $y $w $h $r
    if($pal.Kind -eq 'paint') {
        if($style -eq 'glass') {
            Fill-Path $path $pal.Glass; Stroke-Path $path (Mix $pal.Glass '#000000' 0.3) 0.45
        } elseif($style -eq 'glow') {
            Fill-Path $path (Mix $pal.Glow $pal.Core 0.55); Stroke-Path $path $pal.Glow 0.5
        } else { Fill-Path $path $pal.Glow }
    } elseif($style -eq 'glass') {
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
function Dot([float]$cx,[float]$cy,[float]$r,[string]$style,$pal) {
    if($style -eq 'seat') { Ellipse '#3c4244' ($cx-$r-0.9) ($cy-$r-0.9) (2*$r+1.8) (2*$r+1.8); return }
    $path=New-Object System.Drawing.Drawing2D.GraphicsPath; $path.AddEllipse(($cx-$r),($cy-$r),(2*$r),(2*$r))
    if($style -eq 'glass') {
        $b=New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
        $b.CenterPoint=[System.Drawing.PointF]::new(($cx-$r*0.25),($cy-$r*0.25))
        $b.CenterColor=C (Mix $pal.Glass '#ffffff' 0.3); $b.SurroundColors=@((C (Mix $pal.Glass '#000000' 0.35)))
        $script:g.FillPath($b,$path); $b.Dispose()
        Stroke-Path $path (Mix $pal.Glass '#000000' 0.55) 0.35
        $sp=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220,255,255,255),0.5); $sp.StartCap='Round'; $sp.EndCap='Round'
        $script:g.DrawArc($sp,($cx-$r*0.62),($cy-$r*0.62),($r*1.24),($r*1.24),195,60); $sp.Dispose()
    } elseif($style -eq 'glow') {
        $b=New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
        $b.CenterColor=C $pal.Core; $b.SurroundColors=@((C $pal.Glow))
        $blend=New-Object System.Drawing.Drawing2D.Blend(3); $blend.Factors=[single[]]@(0,0.85,1); $blend.Positions=[single[]]@(0,0.45,1)
        $b.Blend=$blend; $script:g.FillPath($b,$path); $b.Dispose()
    } else { Fill-Path $path $pal.Glow }
    $path.Dispose()
}
function Ring-Lume([float]$radius,[float]$width,[string]$style,$pal) {
    $rect=[System.Drawing.RectangleF]::new((225-$radius),(225-$radius),(2*$radius),(2*$radius))
    if($style -eq 'glass') {
        $p=Pen (Mix $pal.Glass '#000000' 0.45) ($width+0.7); $script:g.DrawEllipse($p,$rect); $p.Dispose()
        $p=Pen $pal.Glass $width; $script:g.DrawEllipse($p,$rect); $p.Dispose()
        $p=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200,255,255,255),0.4); $script:g.DrawArc($p,$rect,200,70); $p.Dispose()
    } elseif($style -eq 'glow') {
        $p=Pen $pal.Glow $width; $script:g.DrawEllipse($p,$rect); $p.Dispose()
        $p=Pen $pal.Core ($width*0.45); $script:g.DrawEllipse($p,$rect); $p.Dispose()
    } elseif($style -eq 'emit') { $p=Pen $pal.Glow $width; $script:g.DrawEllipse($p,$rect); $p.Dispose() }
}

# Hand frames: identical pivots and angles to the hand assets in New-Previews.ps1.
function Hand-Frame([string]$kind) {
    switch($kind) {
        'hour'   { $w=22; $h=150; $py=0.88; $a=305 }
        'minute' { $w=16; $h=198; $py=0.9090909; $a=60 }
        'second' { $w=6;  $h=230; $py=0.8782609; $a=132 }
    }
    $script:g.TranslateTransform(225,225); $script:g.RotateTransform($a); $script:g.TranslateTransform((-0.5*$w),(-$py*$h))
}
$hourHandPoints=@(@(11,1),@(18,11),@(17,95),@(21,127),@(16,145),@(6,145),@(1,127),@(5,95),@(4,11))
$minuteHandPoints=@(@(8,1),@(15,10),@(12,151),@(15,180),@(11,193),@(5,193),@(1,180),@(4,151),@(1,10))
# Inlay geometry in hand-image units. Hour: 131 visible units from pivot to
# tip, tube 5 x 57 (44 %), 60-117 units out. Minute: 179 units, tube 4 x 80
# (45 %), 85-165 units out. Both sit in the outer part of the old slot.
$hourTube=@(8.5,15,5,57); $minuteTube=@(6,15,4,80)
function Draw-Steel($cfg) {
    foreach($kind in @('hour','minute')) {
        $state=$script:g.Save(); Hand-Frame $kind
        if($kind -eq 'hour') { $pts=$hourHandPoints; $t=$hourTube } else { $pts=$minuteHandPoints; $t=$minuteTube }
        $polygon=[System.Drawing.PointF[]]@($pts | ForEach-Object { [System.Drawing.PointF]::new($_[0],$_[1]) })
        $b=Brush '#f5f5ef'; $script:g.FillPolygon($b,$polygon); $b.Dispose()
        Tube $t[0] $t[1] $t[2] $t[3] 'seat' $null
        $script:g.Restore($state)
    }
    Asset 'second_hand' 222 23 6 230 132 0.5 0.8782609
    Asset 'center_cap' 211 211 28 28
}
function Draw-HandLume($cfg,[string]$style) {
    $state=$script:g.Save(); Hand-Frame 'hour'; Tube $hourTube[0] $hourTube[1] $hourTube[2] $hourTube[3] $style $cfg.HourLume; $script:g.Restore($state)
    $state=$script:g.Save(); Hand-Frame 'minute'; Tube $minuteTube[0] $minuteTube[1] $minuteTube[2] $minuteTube[3] $style $cfg.MinuteLume; $script:g.Restore($state)
    if($cfg.SecondPip) {
        $state=$script:g.Save(); Hand-Frame 'second'
        if($style -eq 'glass') { Tube 1.2 21 3.6 13 'seat' $null }
        Tube 1.2 21 3.6 13 $style $cfg.SecondPip; $script:g.Restore($state)
    }
    if($cfg.HubRing) { Ring-Lume 9.6 1.7 $style $cfg.HubRing }
}
# Clock angles of the flanking tubes: each sits 3.5 units clear of the numeral
# glyph (plus the 0.9-unit seat), measured at the tube's mid radius of 205.
function Get-FlankAngles {
    if(-not $script:flankAngles) {
        $f=New-Font 29; $half12=(Text-Width '12' $f)/2; $half6=(Text-Width '6' $f)/2; $f.Dispose()
        $a12=[math]::Asin(($half12+3.5+2.2+0.9)/205)*180/[math]::PI
        $a6=[math]::Asin(($half6+3.5+2.2+0.9)/205)*180/[math]::PI
        $script:flankAngles=@((360-$a12),$a12,(180-$a6),(180+$a6))
        Write-Host ('Flanking tubes: 12 at +/-{0:N1} deg, 6 at +/-{1:N1} deg' -f $a12,$a6)
    }
    return $script:flankAngles
}
function Draw-Markers($cfg,[string]$style) {
    if($cfg.Markers -eq 'tubes' -or $cfg.Markers -eq 'dots') {
        for($hour=0;$hour -lt 12;$hour++) {
            $state=$script:g.Save(); $script:g.TranslateTransform(225,225); $script:g.RotateTransform($hour*30)
            if($cfg.Markers -eq 'tubes' -and $cfg.Flank -and ($hour -eq 0 -or $hour -eq 6)) {
                # A pair of radial tubes flanking the 12 or 6 numeral.
                $a=(Get-FlankAngles)[[int]($hour/6)*2+1]; $lume=$cfg.TwelveLume; if($hour -eq 6) { $lume=$cfg.SixLume }
                foreach($side in @(-1,1)) {
                    $inner=$script:g.Save(); $script:g.RotateTransform([float]($side*[math]::Abs($a-$hour*30)))
                    Tube -2.2 -212.5 4.4 15 $style $lume; $script:g.Restore($inner)
                }
            } elseif($cfg.Markers -eq 'tubes') {
                if($hour -eq 0) {
                    if($style -eq 'seat') { RoundFill '#3c4244' -5.9 -213.4 11.8 16.8 2.9 }
                    else { Tube -4.9 -212.5 4.1 15 $style $cfg.TwelveLume; Tube 0.8 -212.5 4.1 15 $style $cfg.TwelveLume }
                } else { Tube -2.2 -212.5 4.4 15 $style $cfg.MarkerLume }
            } else {
                if($hour % 3 -eq 0) { Tube -2.5 -213 5 16 $style $cfg.MarkerLume }
                else { Dot 0 -205 3.2 $style $cfg.MarkerLume }
            }
            $script:g.Restore($state)
        }
    }
    if($cfg.LumeNumerals -and $style -ne 'seat') {
        $color=$cfg.HourLume.Glass
        if($style -eq 'glow') { $color=Mix $cfg.HourLume.Glow $cfg.HourLume.Core 0.55 } elseif($style -eq 'emit') { $color=$cfg.HourLume.Glow }
        Draw-Numerals @(1,2,3,4,6,8,9,10,11,12) $color
    }
}

# ---------------------------------------------------------------------------
# Sleep readouts (sample data: 7 h 42 min, score 86)
# ---------------------------------------------------------------------------
$ink='#f4f4ef'; $caption='#9ba2a6'
function Sleep-Field([string]$part) {
    Text-Runs @(@{T='7';S=15;C=$ink},@{T='h';S=9;C=$ink;Pre=0.6},@{T='42';S=15;C=$ink;Pre=1.6},@{T='m';S=9;C=$ink;Pre=0.6}) 176 96
    Text-Runs @(@{T='SLEEP';S=7;C=$caption;Tr=0.8}) 176 106
    Text-Runs @(@{T='86';S=15;C=$ink}) 274 96
    Text-Runs @(@{T='SCORE';S=7;C=$caption;Tr=0.8}) 274 106
}
function Sleep-Ember([string]$part) {
    $cx=225; $cy=133; $r=81.5
    $start=180+[math]::Asin(19/$r)*180/[math]::PI; $sweep=540-2*$start
    $rect=[System.Drawing.RectangleF]::new(($cx-$r),($cy-$r),(2*$r),(2*$r))
    if($part -eq 'all') {
        $p=Pen '#241a14' 3.2; $p.StartCap='Round'; $p.EndCap='Round'; $script:g.DrawArc($p,$rect,$start,$sweep); $p.Dispose()
        foreach($t in @(0,0.5,1)) {
            $a=($start+$sweep*$t)*[math]::PI/180
            Line '#8a8f92' 0.8 ($cx+77.2*[math]::Cos($a)) ($cy+77.2*[math]::Sin($a)) ($cx+79.4*[math]::Cos($a)) ($cy+79.4*[math]::Sin($a))
        }
    }
    $b=New-Object System.Drawing.Pen((C '#ff7a18'),2.4); $b.StartCap='Round'; $b.EndCap='Round'
    $script:g.DrawArc($b,$rect,$start,($sweep*0.86)); $b.Dispose()
    $hp=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150,255,214,170),0.5)
    $script:g.DrawArc($hp,([System.Drawing.RectangleF]::new(($cx-$r-0.5),($cy-$r-0.5),(2*$r+1),(2*$r+1))),($start+1),($sweep*0.86-2)); $hp.Dispose()
    Text-Runs @(@{T='7';S=12;C=$ink},@{T='h';S=8;C=$ink;Pre=0.5},@{T='42';S=12;C=$ink;Pre=1.3},@{T='m';S=8;C=$ink;Pre=0.5}) 172 110.5
    Text-Runs @(@{T='86';S=12;C='#ff8a2a'}) 278 110.5
}
function Crescent([float]$cx,[float]$cy,[float]$r,[string]$hex) {
    $a=New-Object System.Drawing.Drawing2D.GraphicsPath; $a.AddEllipse(($cx-$r),($cy-$r),(2*$r),(2*$r))
    $bp=New-Object System.Drawing.Drawing2D.GraphicsPath; $bp.AddEllipse(($cx-$r+$r*0.62),($cy-$r-$r*0.28),(2*$r),(2*$r))
    $region=New-Object System.Drawing.Region($a); $region.Exclude($bp)
    $b=Brush $hex; $script:g.FillRegion($b,$region); $b.Dispose(); $region.Dispose(); $a.Dispose(); $bp.Dispose()
}
function Sleep-Ice([string]$part) {
    $iceText='#8fd8ff'
    Crescent 101 302.5 4.6 $iceText
    Text-Runs @(@{T='7';S=15;C=$ink},@{T='h';S=9;C=$ink;Pre=0.6},@{T='42';S=15;C=$ink;Pre=1.6},@{T='m';S=9;C=$ink;Pre=0.6}) 109 308 'left'
    Text-Runs @(@{T='SLEEP';S=7;C=$caption;Tr=0.8},@{T='86';S=12;C=$iceText;Pre=4}) 97 323.5 'left'
}
function Heritage-Runs([string]$capColor,[string]$valColor) {
    @(@{T='SLEEP ';S=8.8;C=$capColor;Role='cap';Shadow='#000000'},@{T='7H 42M';S=8.8;C=$valColor;Role='val';Shadow='#000000'},
      @{T=('   '+$middot+'   ');S=8.8;C=$capColor;Role='cap'},
      @{T='SCORE ';S=8.8;C=$capColor;Role='cap';Shadow='#000000'},@{T='86';S=8.8;C=$valColor;Role='val';Shadow='#000000'})
}
function Sleep-Heritage([string]$part) {
    if($part -eq 'all') {
        # A narrow chapter flange inside the arch carries the engraving.
        $outer=New-Object System.Drawing.Drawing2D.GraphicsPath
        $start=180+[math]::Asin(14/86)*180/[math]::PI
        $outer.AddArc(139,47,172,172,$start,(540-2*$start))
        $innerR=74; $istart=180+[math]::Asin(14/$innerR)*180/[math]::PI
        $outer.AddArc((225-$innerR),(133-$innerR),(2*$innerR),(2*$innerR),(540-$istart),(-(540-2*$istart))); $outer.CloseFigure()
        $b=Blend-Brush 139 47 172 72 @('#1d2021','#141617') ([single[]]@(0,1)) 90
        $script:g.FillPath($b,$outer); $b.Dispose(); $outer.Dispose()
        $p=Pen '#3b3f3f' 0.6; $script:g.DrawArc($p,(225-$innerR),(133-$innerR),(2*$innerR),(2*$innerR),$istart,(540-2*$istart)); $p.Dispose()
        Arc-Text (Heritage-Runs '#8c8a82' $cfgHeritageValue) 225 133 76.6 1.05
    } else {
        Arc-Text (Heritage-Runs '#8c8a82' $cfgHeritageValue) 225 133 76.6 1.05 'val'
    }
}
function Sleep-Reactor([string]$part) {
    $x=153; $y=103.5; $w=144; $h=12.5
    $engrave='#141718'
    $runs=@(@{T='SLEEP';S=9;C=$engrave;Tr=0.7},@{T='7H 42M';S=9;C=$engrave;Tr=0.7;Pre=3.2},
            @{Bar=$true;W=9;H=7;Lw=0.6;C=$engrave},@{T='SCORE';S=9;C=$engrave;Tr=0.7},@{T='86';S=9;C=$engrave;Tr=0.7;Pre=3.2})
    if($part -eq 'values') {
        # Low light: the engraving is lit like instrument lettering.
        Text-Runs $runs 225 113.2 'center' 0 '#e4e8e9'; return
    }
    $plate=RoundPath $x $y $w $h 2
    $b=Blend-Brush $x $y $w $h @('#3f4446','#6b7173','#5a6062','#4a5052') ([single[]]@(0,0.35,0.7,1)) 90
    $script:g.FillPath($b,$plate); $b.Dispose()
    $state=$script:g.Save(); $script:g.SetClip($plate)
    $rnd=New-Object System.Random(77)
    for($i=0;$i -lt 46;$i++) {
        $ly=$y+0.3+$rnd.NextDouble()*($h-0.6); $lx=$x+$rnd.NextDouble()*$w*0.6; $len=20+$rnd.NextDouble()*70
        $alpha=18+$rnd.Next(0,30); $tone='#ffffff'; if($i%2) { $tone='#000000' }
        $p=New-Object System.Drawing.Pen((Argb $alpha $tone),0.3); $script:g.DrawLine($p,$lx,$ly,($lx+$len),$ly); $p.Dispose()
    }
    $script:g.Restore($state)
    Line '#0b0d0e' 0.8 ($x+1.5) ($y+0.4) ($x+$w-1.5) ($y+0.4)
    Line '#8b9193' 0.5 ($x+1.5) ($y+$h-0.3) ($x+$w-1.5) ($y+$h-0.3)
    Stroke-Path $plate '#16191a' 0.5; $plate.Dispose()
    Text-Runs $runs 225 113.2 'center' 0.55 '#9aa0a2' 160
    Text-Runs $runs 225 113.2 'center'
}

# ---------------------------------------------------------------------------
# Concepts
# ---------------------------------------------------------------------------
$green=@{Kind='tube';Glass='#d6e8c8';Glow='#6dff4a';Core='#eaffd8'}
$orange=@{Kind='tube';Glass='#f0c9a6';Glow='#ff8a1e';Core='#ffe2c2'}
$emberLume=@{Kind='tube';Glass='#f2c7a0';Glow='#ff7a18';Core='#ffe0b8'}
$iceLume=@{Kind='tube';Glass='#d3e6ee';Glow='#5cc8ff';Core='#e8f8ff'}
$paint=@{Kind='paint';Glass='#e6d7a8';Glow='#b9ff9a';Core='#e6ffd6'}
$cfgHeritageValue='#e6d7a8'
$innerNumerals=@(1,2,3,4,8,9,10,11)
$allNumerals=@(1,2,3,4,6,8,9,10,11,12)

$concepts=@(
    @{Key='01-field';Title='1 Field';Name='Field';Description='Classic military tritium tubes.'
      NumeralNote='12 and 6 numerals kept as on the current dial, each flanked by a pair of tubes (orange at 12, green at 6).'
      HourLume=$green;MinuteLume=$green;Markers='tubes';MarkerLume=$green;TwelveLume=$orange;SixLume=$green;Flank=$true
      Numerals=$allNumerals;HourBars=$false;FaceCenter='#121414';FaceEdge='#030404'
      MoonX=225;MoonY=84;MoonD=56;Haze=26;StarMaxR=82;StarMask=@(@(150,82,203,112),@(256,82,296,112))
      Sleep={ param($part) Sleep-Field $part }
      Low=@{Level=0.12;Desat=0.35;Tint=@(1,1,1);Hand=0.22;Wide=4.2;WidePeak=0.45;Tight=1.2;TightPeak=0.55;Exceptions=@()}}
    @{Key='02-ember';Title='2 Ember';Name='Ember';Description="The face's own orange, a warm night dial."
      NumeralNote='12 and 6 numerals replaced by lume bars (bars at 12, 3, 6 and 9; round lume dots at the other hours).'
      HourLume=$emberLume;MinuteLume=$emberLume;Markers='dots';MarkerLume=$emberLume
      Numerals=$innerNumerals;HourBars=$false;FaceCenter='#121414';FaceEdge='#030404'
      MoonX=225;MoonY=86;MoonD=52;Haze=22;StarMaxR=76;StarMask=@(@(150,100,200,116),@(262,100,296,116))
      Sleep={ param($part) Sleep-Ember $part }
      Low=@{Level=0.14;Desat=0.85;Tint=@(1.0,0.62,0.38);Hand=0.22;Wide=4.2;WidePeak=0.45;Tight=1.2;TightPeak=0.55
            Exceptions=@(@{Level=0.34;Desat=0.85;Tint=@(1.0,0.62,0.38);Draw={ Draw-Readouts 'monthday'; Draw-Readouts 'steps'; Sleep-Ember 'values' }},
                         # The weekday keeps its saturated orange so the date hierarchy survives.
                         @{Level=0.52;Desat=0;Tint=@(1.0,0.85,0.7);Draw={ Draw-Readouts 'weekday' }})}}
    @{Key='03-ice';Title='3 Ice';Name='Ice';Description='Cold blue, moonlit.'
      NumeralNote='12 and 6 numerals kept as on the current dial, each flanked by a pair of ice-blue tubes.'
      HourLume=$iceLume;MinuteLume=$iceLume;Markers='tubes';MarkerLume=$iceLume;TwelveLume=$iceLume;SixLume=$iceLume;Flank=$true
      Numerals=$allNumerals;HourBars=$false;FaceCenter='#121414';FaceEdge='#030404'
      MoonX=225;MoonY=82;MoonD=64;Haze=34;StarMaxR=82;StarMask=@()
      Sleep={ param($part) Sleep-Ice $part }
      Low=@{Level=0.11;Desat=0.6;Tint=@(0.72,0.86,1.0);Hand=0.20;Wide=4.2;WidePeak=0.45;Tight=1.2;TightPeak=0.55
            Exceptions=@(@{Level=0.4;Desat=0.3;Tint=@(0.85,0.93,1.0);Draw={ Draw-Sky $script:cfg 'stars' }},
                         @{Level=0.6;Desat=0.15;Tint=@(0.92,0.97,1.0);Draw={ Draw-Sky $script:cfg 'moon' }})}}
    @{Key='04-heritage';Title='4 Heritage';Name='Heritage';Description='Vintage painted lume instead of glass tubes.'
      NumeralNote='All numerals kept, 12 and 6 included, repainted in lume; they are the hour markers.'
      HourLume=$paint;MinuteLume=$paint;Markers='none';LumeNumerals=$true;Grain=$true
      Numerals=@();HourBars=$true;FaceCenter='#121414';FaceEdge='#030404'
      MoonX=225;MoonY=90;MoonD=50;Haze=22;StarMaxR=71;StarMask=@()
      Sleep={ param($part) Sleep-Heritage $part }
      Low=@{Level=0.08;Desat=0.3;Tint=@(1,1,1);Hand=0.18;Wide=6.0;WidePeak=0.30;Tight=1.8;TightPeak=0.32
            Exceptions=@(@{Level=0.5;Desat=0;Tint=@(1,1,1);Draw={ $script:cfgHeritageValue=Mix $paint.Glow $paint.Core 0.5; Sleep-Heritage 'values'; $script:cfgHeritageValue='#e6d7a8' }})}}
    @{Key='05-reactor';Title='5 Reactor';Name='Reactor';Description='Multi-colour tubes on a near-black instrument dial.'
      NumeralNote='12 and 6 numerals replaced by tube markers (orange double tube at 12, green tube at 6).'
      HourLume=$iceLume;MinuteLume=$green;Markers='tubes';MarkerLume=$green;TwelveLume=$orange;SecondPip=$orange;HubRing=$orange
      Numerals=$innerNumerals;HourBars=$false;FaceCenter='#0a0b0b';FaceEdge='#020202'
      MoonX=225;MoonY=76.5;MoonD=50;Haze=22;StarMaxR=82;StarMask=@(@(150,100,300,118))
      Sleep={ param($part) Sleep-Reactor $part }
      Low=@{Level=0.05;Desat=0.2;Tint=@(1,1,1);Hand=0.10;Wide=4.2;WidePeak=0.45;Tight=1.2;TightPeak=0.55
            Exceptions=@(@{Level=0.40;Desat=0;Tint=@(1,1,1);Draw={ Draw-Readouts 'gauges'; Draw-Readouts 'battery' }},
                         @{Level=0.30;Desat=0;Tint=@(1,1,1);Draw={ Draw-Readouts 'steps'; Sleep-Reactor 'values' }})}}
)

function Compose-Face($cfg,[string]$mode,[double]$mechPhase=-1,[switch]$Keep) {
    $script:cfg=$cfg
    $script:mechPhase=$fixturePhase; if($mechPhase -ge 0) { $script:mechPhase=$mechPhase }
    $D=New-Layer; Use-Layer $D; $script:g.Clear([System.Drawing.Color]::Black)
    Asset 'balance_wheel' 151 151 148 148 0
    Draw-Sky $cfg 'all'
    $F=New-Layer; Use-Layer $F; Draw-DialFrame $cfg; [TritiumFx]::Over($D.Bitmap,$F.Bitmap); Close-Layer $F
    Use-Layer $D
    Draw-Readouts 'all'
    & $cfg.Sleep 'all'
    Draw-Markers $cfg 'seat'
    if($mode -eq 'normal') {
        $DL=New-Layer; Use-Layer $DL; Draw-Markers $cfg 'glass'
        if($cfg.Grain) { [TritiumFx]::Grain($DL.Bitmap,0.07,2,11) }
        [TritiumFx]::Over($D.Bitmap,$DL.Bitmap); Close-Layer $DL
        $S=New-Layer; Use-Layer $S; Draw-Steel $cfg; [TritiumFx]::Over($D.Bitmap,$S.Bitmap); Close-Layer $S
        $HL=New-Layer; Use-Layer $HL; Draw-HandLume $cfg 'glass'
        if($cfg.Grain) { [TritiumFx]::Grain($HL.Bitmap,0.07,2,12) }
        [TritiumFx]::Over($D.Bitmap,$HL.Bitmap); Close-Layer $HL
    } else {
        $low=$cfg.Low
        [TritiumFx]::Grade($D.Bitmap,$low.Level,$low.Desat,$low.Tint[0],$low.Tint[1],$low.Tint[2])
        foreach($ex in $low.Exceptions) {
            $X=New-Layer; Use-Layer $X; & $ex.Draw
            [TritiumFx]::Grade($X.Bitmap,$ex.Level,$ex.Desat,$ex.Tint[0],$ex.Tint[1],$ex.Tint[2])
            [TritiumFx]::Over($D.Bitmap,$X.Bitmap); Close-Layer $X
        }
        $DL=New-Layer; Use-Layer $DL; Draw-Markers $cfg 'glow'; [TritiumFx]::Over($D.Bitmap,$DL.Bitmap); Close-Layer $DL
        $S=New-Layer; Use-Layer $S; Draw-Steel $cfg
        [TritiumFx]::Grade($S.Bitmap,$low.Hand,$low.Desat,$low.Tint[0],$low.Tint[1],$low.Tint[2])
        [TritiumFx]::Over($D.Bitmap,$S.Bitmap); Close-Layer $S
        $E=New-Layer; Use-Layer $E; Draw-Markers $cfg 'emit'; Draw-HandLume $cfg 'emit'
        [void][TritiumFx]::Bloom($D.Bitmap,$E.Bitmap,($low.Wide*2),$low.WidePeak)
        [void][TritiumFx]::Bloom($D.Bitmap,$E.Bitmap,($low.Tight*2),$low.TightPeak)
        Close-Layer $E
        $HL=New-Layer; Use-Layer $HL; Draw-HandLume $cfg 'glow'; [TritiumFx]::Over($D.Bitmap,$HL.Bitmap); Close-Layer $HL
    }
    # -Keep hands the 2x layer to the caller (for window crops) instead of saving.
    if($Keep) { $script:keptLayer=$D; return }
    $suffix='normal'; if($mode -ne 'normal') { $suffix='lowlight' }
    $path=Join-Path $outRoot ($cfg.Key+'-'+$suffix+'.png')
    Save-Layer $D $path; Close-Layer $D
    return $path
}

foreach($cfg in $concepts) {
    foreach($mode in @('normal','lowlight')) { $null=Compose-Face $cfg $mode }
    Write-Host ('Rendered concept {0}' -f $cfg.Title)
}

# ---------------------------------------------------------------------------
# Moon phase strip
# ---------------------------------------------------------------------------
$phases=@(@('New',0),@('Waxing crescent',0.125),@('First quarter',0.25),@('Waxing gibbous',0.375),@('Full',0.5),@('Waning gibbous',0.625),@('Last quarter',0.75),@('Waning crescent',0.875))
$cell=132; $strip=New-Layer ($cell*8+16) 168; Use-Layer $strip
$b=Blend-Brush 0 0 ($cell*8+16) 168 @('#03091a','#0b1f3c') ([single[]]@(0,1)) 90
$script:g.FillRectangle($b,0,0,($cell*8+16),168); $b.Dispose()
for($i=0;$i -lt 8;$i++) {
    $cx=8+$cell*$i+$cell/2
    Draw-Moon $cx 66 96 $phases[$i][1]
    Text-Runs @(@{T=$phases[$i][0];S=13;C='#e6e8ea'}) $cx 140
    Text-Runs @(@{T=('{0:P0} lit' -f ((1-[math]::Cos(2*[math]::PI*$phases[$i][1]))/2));S=10;C='#8d9aa8'}) $cx 155
}
Save-Layer $strip (Join-Path $outRoot 'moon-phases.png'); Close-Layer $strip

# ---------------------------------------------------------------------------
# Contact sheet
# ---------------------------------------------------------------------------
$margin=28; $gap=18; $titleH=46; $rowLabelH=34
$sheetW=$margin*2+5*450+4*$gap; $sheetH=$margin+$titleH+2*($rowLabelH+450)+$gap+$margin
$sheet=New-Object System.Drawing.Bitmap($sheetW,$sheetH)
$sg=[System.Drawing.Graphics]::FromImage($sheet)
$sg.SmoothingMode='AntiAlias'; $sg.TextRenderingHint='AntiAliasGridFit'; $sg.InterpolationMode='HighQualityBicubic'
$sg.Clear((C '#1b1c1e'))
$titleFont=New-Object System.Drawing.Font('Segoe UI Semibold',22,[System.Drawing.GraphicsUnit]::Pixel)
$rowFont=New-Object System.Drawing.Font('Segoe UI',17,[System.Drawing.GraphicsUnit]::Pixel)
$center=New-Object System.Drawing.StringFormat; $center.Alignment='Center'; $center.LineAlignment='Center'
$left=New-Object System.Drawing.StringFormat; $left.Alignment='Near'; $left.LineAlignment='Center'
$white=Brush '#f0f0ee'; $grey=Brush '#a7abb0'
for($c=0;$c -lt 5;$c++) {
    $x=$margin+$c*(450+$gap)
    $sg.DrawString($concepts[$c].Title,$titleFont,$white,([System.Drawing.RectangleF]::new($x,$margin,450,$titleH)),$center)
    for($row=0;$row -lt 2;$row++) {
        $y=$margin+$titleH+$row*($rowLabelH+450+$gap)+$rowLabelH
        $suffix=@('normal','lowlight')[$row]
        $img=[System.Drawing.Image]::FromFile((Join-Path $outRoot ($concepts[$c].Key+'-'+$suffix+'.png')))
        $sg.DrawImage($img,$x,$y,450,450); $img.Dispose()
    }
}
foreach($row in 0,1) {
    $y=$margin+$titleH+$row*($rowLabelH+450+$gap)
    $label=@('Normal brightness','Low light (15% or below)')[$row]
    $sg.DrawString($label,$rowFont,$grey,([System.Drawing.RectangleF]::new($margin,$y,1200,$rowLabelH)),$left)
}
$sheet.Save((Join-Path $outRoot 'comparison.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$white.Dispose(); $grey.Dispose(); $titleFont.Dispose(); $rowFont.Dispose(); $sg.Dispose(); $sheet.Dispose()

# ---------------------------------------------------------------------------
# Round 2: the selected "Ember Field" pair with the mechanical moon
# ---------------------------------------------------------------------------
$warm=@(1.0,0.62,0.38)
$emberField=@{Key='06-emberfield';Title='Ember Field';Name='Ember Field'
    HourLume=$emberLume;MinuteLume=$emberLume;Markers='tubes';MarkerLume=$emberLume;TwelveLume=$emberLume;SixLume=$emberLume;Flank=$true
    Numerals=$allNumerals;HourBars=$false;FaceCenter='#121414';FaceEdge='#030404'
    MoonStyle='mechanical';MoonX=-999;MoonY=-999;MoonD=0;Haze=0;StarMaxR=82;StarMask=@()
    Sleep={ param($part) }
    Low=@{Level=0.14;Desat=0.85;Tint=$warm;Hand=0.22;Wide=4.2;WidePeak=0.45;Tight=1.2;TightPeak=0.55
          Exceptions=@(@{Level=0.34;Desat=0.85;Tint=$warm;Draw={ Draw-Readouts 'monthday'; Draw-Readouts 'steps' }},
                       @{Level=0.52;Desat=0;Tint=@(1.0,0.85,0.7);Draw={ Draw-Readouts 'weekday' }},
                       # The lit moon stays at 0.34 amber; the shade dims with the dial and is redrawn over it.
                       @{Level=0.34;Desat=0.85;Tint=$warm;Draw={ Set-WindowClip; Draw-MechMoon 'moon'; $script:g.ResetClip() }},
                       @{Level=0.14;Desat=0.85;Tint=$warm;Draw={ Set-WindowClip; Draw-MechMoon 'shade'; $script:g.ResetClip() }})}}
foreach($mode in @('normal','lowlight')) { $null=Compose-Face $emberField $mode }
Write-Host 'Rendered round 2: Ember Field'

# Mechanical moon strip: window crops (x 128-322, y 34-128) of the real face
# composition at 2x, normal and low light, for a set of illuminated fractions.
$mechColumns=@(@('New',0.0,$false),@('Thin crescent',0.03,$false),@('Waxing crescent',0.15,$false),@('First quarter',0.5,$false),
               @('Waxing gibbous',0.85,$false),@('Full',1.0,$false),@('Waning gibbous',0.85,$true),@('Last quarter',0.5,$true),@('Waning crescent',0.15,$true))
$cropX=128; $cropY=34; $cropW=194; $cropH=94
$colW=$cropW*2; $colH=$cropH*2; $colGap=14; $labelW=170; $headH=74; $rowGap=16; $mg2=24
$stripW=$mg2*2+$labelW+9*$colW+8*$colGap; $stripH=$mg2+$headH+2*$colH+$rowGap+$mg2
$strip2=New-Object System.Drawing.Bitmap($stripW,$stripH)
$s2=[System.Drawing.Graphics]::FromImage($strip2)
$s2.SmoothingMode='AntiAlias'; $s2.TextRenderingHint='AntiAliasGridFit'; $s2.Clear((C '#1b1c1e'))
$nameFont=New-Object System.Drawing.Font('Segoe UI Semibold',24,[System.Drawing.GraphicsUnit]::Pixel)
$pctFont=New-Object System.Drawing.Font('Segoe UI',19,[System.Drawing.GraphicsUnit]::Pixel)
$rowFont2=New-Object System.Drawing.Font('Segoe UI',21,[System.Drawing.GraphicsUnit]::Pixel)
$cfmt=New-Object System.Drawing.StringFormat; $cfmt.Alignment='Center'; $cfmt.LineAlignment='Center'
$lfmt=New-Object System.Drawing.StringFormat; $lfmt.Alignment='Near'; $lfmt.LineAlignment='Center'
$white=Brush '#f0f0ee'; $grey=Brush '#a7abb0'
for($i=0;$i -lt $mechColumns.Count;$i++) {
    $k=[double]$mechColumns[$i][1]; $p=[math]::Acos(1-2*$k)/(2*[math]::PI); if($mechColumns[$i][2]) { $p=1-$p }
    $x=$mg2+$labelW+$i*($colW+$colGap)
    $s2.DrawString($mechColumns[$i][0],$nameFont,$white,([System.Drawing.RectangleF]::new($x,$mg2,$colW,40)),$cfmt)
    $s2.DrawString(('{0:0}% lit' -f ($k*100)),$pctFont,$grey,([System.Drawing.RectangleF]::new($x,($mg2+38),$colW,30)),$cfmt)
    for($row=0;$row -lt 2;$row++) {
        Compose-Face $emberField (@('normal','lowlight')[$row]) $p -Keep
        $y=$mg2+$headH+$row*($colH+$rowGap)
        $s2.DrawImage($script:keptLayer.Bitmap,([System.Drawing.Rectangle]::new($x,$y,$colW,$colH)),($cropX*2),($cropY*2),$colW,$colH,[System.Drawing.GraphicsUnit]::Pixel)
        Close-Layer $script:keptLayer
    }
}
foreach($row in 0,1) {
    $y=$mg2+$headH+$row*($colH+$rowGap)
    $s2.DrawString(@('Normal','Low light')[$row],$rowFont2,$grey,([System.Drawing.RectangleF]::new($mg2,$y,$labelW,$colH)),$lfmt)
}
$strip2.Save((Join-Path $outRoot 'moon-mechanical-phases.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$s2.Dispose(); $nameFont.Dispose(); $pctFont.Dispose(); $rowFont2.Dispose()

# Selected sheet: both faces at native size with the strip underneath at half size.
$selMargin=28; $selGap=24; $selTitleH=52; $selLabelH=36
$halfStripW=[int]($stripW/2); $halfStripH=[int]($stripH/2)
$selW=[math]::Max($selMargin*2+2*450+$selGap,$selMargin*2+$halfStripW)
$selH=$selMargin+$selTitleH+$selLabelH+450+$selGap+$halfStripH+$selMargin
$sel=New-Object System.Drawing.Bitmap($selW,$selH)
$sg=[System.Drawing.Graphics]::FromImage($sel)
$sg.SmoothingMode='AntiAlias'; $sg.TextRenderingHint='AntiAliasGridFit'; $sg.InterpolationMode='HighQualityBicubic'; $sg.Clear((C '#1b1c1e'))
$titleFont=New-Object System.Drawing.Font('Segoe UI Semibold',28,[System.Drawing.GraphicsUnit]::Pixel)
$rowFont=New-Object System.Drawing.Font('Segoe UI',18,[System.Drawing.GraphicsUnit]::Pixel)
$sg.DrawString('Ember Field',$titleFont,$white,([System.Drawing.RectangleF]::new(0,$selMargin,$selW,$selTitleH)),$cfmt)
$facesX=($selW-(2*450+$selGap))/2
for($i=0;$i -lt 2;$i++) {
    $x=$facesX+$i*(450+$selGap); $y=$selMargin+$selTitleH
    $sg.DrawString(@('Normal brightness','Low light (15% or below)')[$i],$rowFont,$grey,([System.Drawing.RectangleF]::new($x,$y,450,$selLabelH)),$cfmt)
    $img=[System.Drawing.Image]::FromFile((Join-Path $outRoot ('06-emberfield-'+@('normal','lowlight')[$i]+'.png')))
    $sg.DrawImage($img,[float]$x,[float]($y+$selLabelH),[float]450,[float]450); $img.Dispose()
}
$img=[System.Drawing.Image]::FromFile((Join-Path $outRoot 'moon-mechanical-phases.png'))
$sg.DrawImage($img,[float](($selW-$halfStripW)/2),[float]($selMargin+$selTitleH+$selLabelH+450+$selGap),[float]$halfStripW,[float]$halfStripH); $img.Dispose()
$sel.Save((Join-Path $outRoot 'selected.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$white.Dispose(); $grey.Dispose(); $titleFont.Dispose(); $rowFont.Dispose(); $sg.Dispose(); $sel.Dispose(); $strip2.Dispose()

# ---------------------------------------------------------------------------
# Static index page (no external resources)
# ---------------------------------------------------------------------------
$cells=New-Object System.Text.StringBuilder
foreach($cfg in $concepts) {
    [void]$cells.AppendLine(('    <section class="concept"><h2>{0}</h2><p>{1}</p><p class="numerals">{2}</p>' -f $cfg.Title,[System.Net.WebUtility]::HtmlEncode($cfg.Description),[System.Net.WebUtility]::HtmlEncode($cfg.NumeralNote)))
    [void]$cells.AppendLine(('      <a href="{0}-normal.png"><img src="{0}-normal.png" width="450" height="450" alt="{1}, normal brightness"></a>' -f $cfg.Key,$cfg.Name))
    [void]$cells.AppendLine(('      <a href="{0}-lowlight.png"><img src="{0}-lowlight.png" width="450" height="450" alt="{1}, low light"></a></section>' -f $cfg.Key,$cfg.Name))
}
$html=@"
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Emberphase tritium concepts</title>
<style>
  body { margin: 0; padding: 24px; background: #161719; color: #e8e8e6; font-family: "Segoe UI", system-ui, sans-serif; }
  h1 { font-size: 24px; font-weight: 600; margin: 0 0 6px; }
  p.note { color: #a9adb2; margin: 0 0 22px; max-width: 70em; }
  .grid { display: grid; grid-template-columns: repeat(5, 450px); gap: 18px; overflow-x: auto; }
  .rows { display: grid; grid-template-columns: 1fr; }
  .concept h2 { font-size: 20px; font-weight: 600; margin: 0 0 2px; }
  .concept p { color: #b9bdc2; margin: 0 0 6px; }
  .concept p.numerals { color: #e0b48a; font-size: 14px; margin: 0 0 12px; min-height: 2.8em; }
  .concept img { display: block; width: 450px; height: 450px; margin-bottom: 18px; border-radius: 50%; }
  .legend { color: #a9adb2; margin: 0 0 12px; }
  img.wide { max-width: 100%; height: auto; display: block; margin: 8px 0 24px; }
  a { color: #f0a868; }
  .round2 { border-bottom: 1px solid #34363a; margin-bottom: 28px; padding-bottom: 8px; }
  .round2 h2 { font-size: 22px; font-weight: 600; margin: 0 0 8px; }
  p.r2 { color: #c9ccd0; margin: 0 0 4px; max-width: 70em; }
  .pair { display: flex; flex-wrap: wrap; gap: 24px; margin: 16px 0 8px; }
  .pair figure { margin: 0; }
  .pair img { display: block; width: 450px; height: 450px; border-radius: 50%; }
  .pair figcaption { color: #a9adb2; text-align: center; margin-top: 8px; }
  h2.round1 { font-size: 22px; font-weight: 600; color: #a9adb2; margin: 0 0 6px; }
</style>
</head>
<body>
<h1>Emberphase: tritium and moon concepts</h1>
<p class="note">These are illustrative composites with sample data (1 November 2026), not device screenshots. Low-light images show the pixels the face would draw at 15% brightness or below.</p>
<section class="round2">
<h2>Round 2: Ember Field</h2>
<p class="r2">Orange tritium tubes on Field's hour layout, with the 12 and 6 numerals kept as on the current dial and flanked by pairs of tubes.</p>
<p class="r2">There is no sleep readout.</p>
<p class="r2">The moon travels across its window and a blued-steel shade covers exactly its unlit part, so each phase has its true shape and the window is empty at new moon.</p>
<div class="pair">
  <figure><a href="06-emberfield-normal.png"><img src="06-emberfield-normal.png" width="450" height="450" alt="Ember Field, normal brightness"></a><figcaption>Normal brightness</figcaption></figure>
  <figure><a href="06-emberfield-lowlight.png"><img src="06-emberfield-lowlight.png" width="450" height="450" alt="Ember Field, low light"></a><figcaption>Low light (15% or below)</figcaption></figure>
</div>
<img class="wide" src="moon-mechanical-phases.png" alt="The mechanical moon in nine phases, normal and low light">
<p><a href="selected.png">Selected sheet (both faces and the moon strip)</a></p>
</section>
<h2 class="round1">Round 1 (superseded)</h2>
<p class="note">Five earlier concepts, with sleep readouts (sample: 7 h 42 min, score 86). Top image in each column: normal brightness. Bottom image: low light.</p>
<div class="grid">
$($cells.ToString())</div>
<h2>Moon phases</h2>
<p class="legend">Northern-hemisphere view: waxing phases are lit on the right, waning on the left. The faces show the phase for the fixture date.</p>
<img class="wide" src="moon-phases.png" alt="The new moon rendering in eight phases">
<p><a href="comparison.png">Contact sheet (all ten faces)</a></p>
</body>
</html>
"@
[System.IO.File]::WriteAllText((Join-Path $outRoot 'index.html'),$html,(New-Object System.Text.UTF8Encoding($false)))
foreach($bmp in $script:moonCache.Values) { $bmp.Dispose() }
Write-Host "Illustrative concept composites (not device screenshots): $outRoot"
