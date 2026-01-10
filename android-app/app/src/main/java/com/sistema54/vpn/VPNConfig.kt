package com.sistema54.vpn

/**
 * Configurazione VPN.
 * IMPORTANTE: In produzione, salvare queste informazioni in modo sicuro
 * (es: Android Keystore, file cifrato, server di configurazione).
 */
object VPNConfig {
    // TODO: Configurare questi valori con le tue credenziali WireGuard
    const val serverIP = "YOUR_SERVER_IP"  // IP pubblico o LAN del server
    const val serverPort = 51820
    const val serverPublicKey = "SERVER_PUBLIC_KEY"  // Chiave pubblica del server WireGuard
    const val clientPrivateKey = "CLIENT_PRIVATE_KEY"  // Chiave privata del client
    const val clientIP = "10.0.0.2/24"  // IP del client nella VPN
    const val allowedIPs = "10.0.0.0/8,172.16.0.0/12"  // Reti da instradare tramite VPN
    
    // URL della web app (tramite IP VPN)
    const val webAppUrl = "http://10.0.0.1:26081"  // IP del server nella VPN
    
    /**
     * Restituisce la configurazione VPN di default.
     * DEPRECATED: Usare ConfigStorage per caricare configurazione importata da file .conf
     * In produzione, questo dovrebbe caricare da storage sicuro o server remoto.
     */
    fun getDefaultConfig(): VPNConfigData {
        return VPNConfigData(
            serverIP = serverIP,
            serverPort = serverPort,
            serverPublicKey = serverPublicKey,
            clientPrivateKey = clientPrivateKey,
            clientIP = clientIP,
            allowedIPs = allowedIPs,
            webAppUrl = webAppUrl,
            dns = null,
            persistentKeepalive = null
        )
    }
}

// VPNConfigData è ora definito in WireGuardConfigParser.kt per evitare duplicati
