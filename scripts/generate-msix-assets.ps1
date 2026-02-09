Add-Type -AssemblyName System.Drawing

$sourceIcon = "d:\Repos\Murmur\resources\icons\icon.png"
$outputDir = "d:\Repos\Murmur\resources\msix-assets"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$img = [System.Drawing.Image]::FromFile($sourceIcon)
Write-Host "Source icon size: $($img.Width)x$($img.Height)"

# Required tile sizes for MSIX
$sizes = @{
    "icon.png" = @(50, 50)
    "Square44x44Logo.png" = @(44, 44)
    "Square44x44Logo.scale-200.png" = @(88, 88)
    "Square44x44Logo.targetsize-24_altform-unplated.png" = @(24, 24)
    "Square150x150Logo.png" = @(150, 150)
    "Square150x150Logo.scale-200.png" = @(300, 300)
    "Wide310x150Logo.scale-200.png" = @(620, 300)
    "SplashScreen.scale-200.png" = @(1240, 600)
    "LockScreenLogo.scale-200.png" = @(48, 48)
}

foreach ($entry in $sizes.GetEnumerator()) {
    $filename = $entry.Key
    $w = $entry.Value[0]
    $h = $entry.Value[1]

    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # For wide/splash images, center the icon
    if ($w -gt $h) {
        # Wide format - center the icon maintaining aspect ratio
        $iconSize = [Math]::Min($h, $img.Width)
        $x = [int](($w - $iconSize) / 2)
        $y = [int](($h - $iconSize) / 2)
        $graphics.DrawImage($img, $x, $y, $iconSize, $iconSize)
    } else {
        # Square format - fill entirely
        $graphics.DrawImage($img, 0, 0, $w, $h)
    }

    $outPath = Join-Path $outputDir $filename
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Created: $filename ($w x $h)"

    $graphics.Dispose()
    $bmp.Dispose()
}

$img.Dispose()
Write-Host "`nAll MSIX assets generated in: $outputDir"
