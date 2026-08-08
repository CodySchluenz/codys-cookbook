# Resize a photo for the cookbook: JPEG, max 1600px wide, ~85 quality.
# Usage: powershell -File scripts/prep-photo.ps1 -Source "C:\path\IMG_1234.jpg" -RecipeId "esquites"
# Writes site/photos/<RecipeId>.jpg. HEIC is not supported — export/share as JPEG first.
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$RecipeId
)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($Source)
try {
  $maxW = 1600
  $w = [Math]::Min($img.Width, $maxW)
  $h = [int]($img.Height * ($w / $img.Width))
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)
  $out = Join-Path $PSScriptRoot "..\site\photos\$RecipeId.jpg"
  New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null
  $bmp.Save($out, $codec, $params)
  $bmp.Dispose()
  Write-Output ("wrote " + (Resolve-Path $out) + " (" + [int]((Get-Item $out).Length / 1KB) + " KB)")
} finally {
  $img.Dispose()
}
