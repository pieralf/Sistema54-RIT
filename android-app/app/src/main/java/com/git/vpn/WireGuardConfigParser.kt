package com.git.vpn

import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.net.InetSocketAddress
import java.util.regex.Pattern

/**
 * Parser per file di configurazione WireGuard (.conf)
 * Supporta il formato standard WireGuard config file
 */
object WireGuardConfigParser {
    
    /**
     * Parsea un file .conf di WireGuard e restituisce VPNConfigData
     * 
     * @param inputStream InputStream del file .conf
     * @param webAppUrl URL della web app (opzionale, può essere nel file come commento)
     * @return VPNConfigData o null se il parsing fallisce
     */
    fun parseConfig(inputStream: InputStream, webAppUrl: String? = null): VPNConfigData? {
        try {
            val reader = BufferedReader(InputStreamReader(inputStream))
            val lines = reader.readLines()
            
            var interfacePrivateKey: String? = null
            var interfaceAddress: String? = null
            var interfaceDNS: String? = null
            
            var peerPublicKey: String? = null
            var peerEndpoint: String? = null
            var peerAllowedIPs: String? = null
            var peerPersistentKeepalive: Int? = null
            var peerPresharedKey: String? = null
            
            var currentSection: String? = null
            var extractedWebAppUrl: String? = webAppUrl
            
            for (line in lines) {
                val trimmedLine = line.trim()
                
                // Skip commenti e righe vuote
                if (trimmedLine.isEmpty() || trimmedLine.startsWith("#")) {
                    // Estrai webAppUrl da commento se presente
                    if (trimmedLine.contains("# WebAppURL:") || trimmedLine.contains("# WebAppUrl:")) {
                        val urlPattern = Pattern.compile("#\\s*WebAppUrl:\\s*(.+)", Pattern.CASE_INSENSITIVE)
                        val matcher = urlPattern.matcher(trimmedLine)
                        if (matcher.find()) {
                            extractedWebAppUrl = matcher.group(1)?.trim()
                        }
                    }
                    continue
                }
                
                // Controlla sezione [Interface] o [Peer]
                if (trimmedLine.startsWith("[Interface]")) {
                    currentSection = "Interface"
                    continue
                } else if (trimmedLine.startsWith("[Peer]")) {
                    currentSection = "Peer"
                    continue
                }
                
                // Parse chiave-valore
                val keyValuePattern = Pattern.compile("([^=]+)=\\s*(.+)")
                val matcher = keyValuePattern.matcher(trimmedLine)
                if (matcher.find()) {
                    val key = matcher.group(1)?.trim() ?: continue
                    val value = matcher.group(2)?.trim() ?: continue
                    
                    when (currentSection) {
                        "Interface" -> {
                            when (key.lowercase()) {
                                "privatekey" -> interfacePrivateKey = value
                                "address" -> interfaceAddress = value
                                "dns" -> interfaceDNS = value
                            }
                        }
                        "Peer" -> {
                            when (key.lowercase()) {
                                "publickey" -> peerPublicKey = value
                                "presharedkey" -> peerPresharedKey = value
                                "endpoint" -> peerEndpoint = value
                                "allowedips" -> peerAllowedIPs = value
                                "persistentkeepalive" -> {
                                    try {
                                        peerPersistentKeepalive = value.toInt()
                                    } catch (e: NumberFormatException) {
                                        // Ignora se non è un numero valido
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // Verifica che tutti i campi necessari siano presenti
            if (interfacePrivateKey == null || peerPublicKey == null || peerEndpoint == null) {
                return null
            }
            
            // Parse endpoint per estrarre IP e porta
            val endpointParts = parseEndpoint(peerEndpoint)
            val serverIP = endpointParts.first
            val serverPort = endpointParts.second
            
            // Usa address se specificato, altrimenti default
            val clientIP = interfaceAddress ?: "10.0.0.2/24"
            
            // Usa allowedIPs se specificato, altrimenti default
            val allowedIPs = peerAllowedIPs ?: "0.0.0.0/0"
            
            // Estrai webAppUrl da commento o usa quello fornito
            val finalWebAppUrl = extractedWebAppUrl ?: extractWebAppUrlFromAddress(clientIP)
            
            return VPNConfigData(
                serverIP = serverIP,
                serverPort = serverPort,
                serverPublicKey = peerPublicKey,
                clientPrivateKey = interfacePrivateKey,
                clientIP = clientIP,
                allowedIPs = allowedIPs,
                webAppUrl = finalWebAppUrl,
                dns = interfaceDNS,
                persistentKeepalive = peerPersistentKeepalive,
                presharedKey = peerPresharedKey
            )
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }
    
    /**
     * Parsea l'endpoint nel formato "IP:PORT" o "HOSTNAME:PORT"
     */
    private fun parseEndpoint(endpoint: String): Pair<String, Int> {
        try {
            val parts = endpoint.split(":")
            if (parts.size != 2) {
                throw IllegalArgumentException("Endpoint format invalid: $endpoint")
            }
            
            val host = parts[0]
            val port = parts[1].toInt()
            
            return Pair(host, port)
        } catch (e: Exception) {
            throw IllegalArgumentException("Endpoint format invalid: $endpoint", e)
        }
    }
    
    /**
     * Estrae l'URL della web app dall'indirizzo IP del client
     * Es: se clientIP è "10.0.0.2/24", assume che il server sia "10.0.0.1"
     */
    private fun extractWebAppUrlFromAddress(clientIP: String): String {
        try {
            // Rimuovi CIDR (es: /24)
            val ip = clientIP.split("/")[0]
            val ipParts = ip.split(".")
            
            // Assume che il server sia .1 (es: 10.0.0.1)
            if (ipParts.size == 4) {
                val mutableParts = ipParts.toMutableList()
                mutableParts[3] = "1"
                val serverIP = mutableParts.joinToString(".")
                return "http://$serverIP:26080"
            }
        } catch (e: Exception) {
            // Ignora errori
        }
        
        // Default fallback - usa IP rete locale se la VPN instrada verso la rete locale
        return "http://192.168.1.119:26080"
    }
    
    /**
     * Valida se un file .conf è valido (contiene almeno [Interface] e [Peer])
     */
    fun isValidConfig(inputStream: InputStream): Boolean {
        return try {
            val reader = BufferedReader(InputStreamReader(inputStream))
            val content = reader.readText()
            
            content.contains("[Interface]", ignoreCase = true) &&
            content.contains("[Peer]", ignoreCase = true) &&
            content.contains("PrivateKey", ignoreCase = true) &&
            content.contains("PublicKey", ignoreCase = true)
        } catch (e: Exception) {
            false
        }
    }
}

/**
 * Estensione di VPNConfigData per includere DNS, PersistentKeepalive e PresharedKey
 */
data class VPNConfigData(
    val serverIP: String,
    val serverPort: Int,
    val serverPublicKey: String,
    val clientPrivateKey: String,
    val clientIP: String,
    val allowedIPs: String,
    val webAppUrl: String,
    val dns: String? = null,
    val persistentKeepalive: Int? = null,
    val presharedKey: String? = null
)
