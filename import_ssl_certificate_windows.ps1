# Script PowerShell per importare un certificato SSL esistente nel Trusted Root Certificate Authority di Windows
# Utile se hai già generato certificati con altri metodi (es. OpenSSL)

param(
    [Parameter(Mandatory=$false)]
    [string]$CertPath = "nginx\ssl\cert.pem",
    
    [Parameter(Mandatory=$false)]
    [string]$StoreLocation = "LocalMachine",  # LocalMachine o CurrentUser
    
    [Parameter(Mandatory=$false)]
    [string]$StoreName = "Root"  # Root = Trusted Root Certification Authorities
)

Write-Host "`n=== IMPORT CERTIFICATO SSL IN WINDOWS ===" -ForegroundColor Green

# Verifica se il file certificato esiste
if (-not (Test-Path $CertPath)) {
    Write-Host "[ERRORE] File certificato non trovato: $CertPath" -ForegroundColor Red
    Write-Host "`nGenera prima i certificati con:" -ForegroundColor Yellow
    Write-Host "  .\generate_trusted_ssl_certs.ps1" -ForegroundColor White
    exit 1
}

# Verifica privilegi amministratore
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin -and $StoreLocation -eq "LocalMachine") {
    Write-Host "[ERRORE] Privilegi amministratore richiesti per importare in LocalMachine." -ForegroundColor Red
    Write-Host "`nEsegui PowerShell come Administrator oppure usa:" -ForegroundColor Yellow
    Write-Host "  .\import_ssl_certificate_windows.ps1 -StoreLocation CurrentUser" -ForegroundColor White
    exit 1
}

try {
    Write-Host "`nImportazione certificato da: $CertPath" -ForegroundColor Cyan
    Write-Host "Store: $StoreLocation\$StoreName" -ForegroundColor Cyan
    
    # Importa il certificato
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
    $cert.Import($CertPath)
    
    # Aggiungi al certificate store
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($StoreName, $StoreLocation)
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    
    # Verifica se il certificato esiste già
    $existing = $store.Certificates | Where-Object { $_.Thumbprint -eq $cert.Thumbprint }
    
    if ($existing) {
        Write-Host "[INFO] Certificato già presente nello store. Nessuna modifica necessaria." -ForegroundColor Yellow
    } else {
        $store.Add($cert)
        Write-Host "[OK] Certificato importato con successo!" -ForegroundColor Green
    }
    
    $store.Close()
    
    Write-Host "`n[OK] Certificato disponibile nello store Windows." -ForegroundColor Green
    Write-Host "Il browser Windows (Edge, Chrome) riconoscerà il certificato come trusted." -ForegroundColor Cyan
    Write-Host "`nNote:" -ForegroundColor Yellow
    Write-Host "  - Riavvia il browser per applicare le modifiche" -ForegroundColor Gray
    Write-Host "  - Firefox ha il proprio certificate store e potrebbe richiedere importazione separata" -ForegroundColor Gray
    
} catch {
    Write-Host "[ERRORE] Errore durante l'importazione: $_" -ForegroundColor Red
    exit 1
}
