# Script PowerShell per generare icone Android da un'immagine source
# Richiede ImageMagick: https://imagemagick.org/script/download.php#windows

param(
    [Parameter(Mandatory=$true)]
    [string]$SourceImage,
    
    [string]$OutputDir = "app/src/main/res"
)

if (-not (Test-Path $SourceImage)) {
    Write-Host "ERRORE: File immagine non trovato: $SourceImage" -ForegroundColor Red
    exit 1
}

# Verifica ImageMagick
$magick = Get-Command magick -ErrorAction SilentlyContinue
if (-not $magick) {
    Write-Host "ERRORE: ImageMagick non trovato. Installa da: https://imagemagick.org/script/download.php#windows" -ForegroundColor Red
    Write-Host "Oppure usa Android Asset Studio: https://icon.kitchen/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Generazione icone Android da: $SourceImage" -ForegroundColor Cyan

# Dimensioni per le diverse densità
$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($density in $sizes.Keys) {
    $size = $sizes[$density]
    $outputPath = Join-Path $OutputDir $density
    
    if (-not (Test-Path $outputPath)) {
        New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
    }
    
    $iconPath = Join-Path $outputPath "ic_launcher.png"
    
    Write-Host "Generando $density ($size x $size)..." -ForegroundColor Gray
    & magick $SourceImage -resize "${size}x${size}" -background transparent -gravity center -extent "${size}x${size}" $iconPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] $iconPath" -ForegroundColor Green
    } else {
        Write-Host "  [ERR] Errore generazione $iconPath" -ForegroundColor Red
    }
}

Write-Host "`nIcone generate con successo!" -ForegroundColor Green
Write-Host "`nNOTA: Per le icone rotonde, usa Android Asset Studio: https://icon.kitchen/" -ForegroundColor Yellow
