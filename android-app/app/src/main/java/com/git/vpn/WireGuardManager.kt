package com.git.vpn

import android.content.Context
import com.wireguard.android.backend.Backend
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import com.wireguard.config.Peer
import com.wireguard.config.Interface
import java.io.BufferedReader
import java.io.StringReader

/**
 * Implementazione semplice di Tunnel per WireGuard
 */
class SimpleTunnel(private val name: String) : Tunnel {
    override fun getName(): String = name
    
    override fun onStateChange(newState: Tunnel.State) {
        // Gestione cambio stato tunnel (opzionale)
        // Può essere lasciato vuoto se non serve logica particolare
    }
}

class WireGuardManager(private val context: Context) {
    private var backend: Backend? = null
    private val tunnelName = "git-vpn"
    
    // Creiamo il tunnel come oggetto che implementa l'interfaccia
    private val tunnel: Tunnel = SimpleTunnel(tunnelName)
    
    fun initialize(): Boolean {
        return try {
            backend = GoBackend(context.applicationContext)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
    
    fun createVPNConfig(
        serverIP: String,
        serverPort: Int,
        serverPublicKey: String,
        clientPrivateKey: String,
        clientIP: String = "10.0.0.2/24",
        allowedIPs: String = "10.0.0.0/8,172.16.0.0/12",
        dns: String? = null,
        persistentKeepalive: Int? = null,
        presharedKey: String? = null
    ): Config {
        // Se c'è un PresharedKey, usa Config.parse() per gestirlo correttamente
        if (presharedKey != null) {
            return createVPNConfigFromString(
                clientPrivateKey = clientPrivateKey,
                clientIP = clientIP,
                dns = dns,
                serverPublicKey = serverPublicKey,
                serverIP = serverIP,
                serverPort = serverPort,
                allowedIPs = allowedIPs,
                persistentKeepalive = persistentKeepalive,
                presharedKey = presharedKey
            )
        }
        
        // Altrimenti usa il Builder (metodo originale)
        val interfaceBuilder = Interface.Builder()
            .parsePrivateKey(clientPrivateKey)
            .parseAddresses(clientIP)
        
        // Aggiungi DNS se specificato
        dns?.let {
            interfaceBuilder.parseDnsServers(it)
        }
        
        val interfaceConfig = interfaceBuilder.build()
        
        val peerBuilder = Peer.Builder()
            .parsePublicKey(serverPublicKey)
            .parseEndpoint("$serverIP:$serverPort")
            .parseAllowedIPs(allowedIPs)
        
        // Aggiungi PersistentKeepalive se specificato
        persistentKeepalive?.let {
            peerBuilder.parsePersistentKeepalive(it.toString())
        }
        
        val peer = peerBuilder.build()
        
        return Config.Builder()
            .setInterface(interfaceConfig)
            .addPeer(peer)
            .build()
    }
    
    /**
     * Crea una configurazione WireGuard da una stringa (supporta PresharedKey)
     */
    private fun createVPNConfigFromString(
        clientPrivateKey: String,
        clientIP: String,
        dns: String?,
        serverPublicKey: String,
        serverIP: String,
        serverPort: Int,
        allowedIPs: String,
        persistentKeepalive: Int?,
        presharedKey: String
    ): Config {
        // Costruisci la configurazione come stringa nel formato WireGuard
        val configString = buildString {
            appendLine("[Interface]")
            appendLine("PrivateKey = $clientPrivateKey")
            appendLine("Address = $clientIP")
            dns?.let {
                appendLine("DNS = $it")
            }
            appendLine()
            appendLine("[Peer]")
            appendLine("PublicKey = $serverPublicKey")
            appendLine("PresharedKey = $presharedKey")
            appendLine("Endpoint = $serverIP:$serverPort")
            appendLine("AllowedIPs = $allowedIPs")
            persistentKeepalive?.let {
                appendLine("PersistentKeepalive = $it")
            }
        }
        
        // Converti la stringa in BufferedReader e parsala usando Config.parse()
        val reader = BufferedReader(StringReader(configString))
        return Config.parse(reader)
    }
    
    fun startVPN(config: Config): Boolean {
        return try {
            val state = backend?.setState(tunnel, Tunnel.State.UP, config)
            state == Tunnel.State.UP
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
    
    fun stopVPN(): Boolean {
        return try {
            backend?.setState(tunnel, Tunnel.State.DOWN, null)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
    
    fun getVPNState(): Tunnel.State? {
        return try {
            backend?.getState(tunnel)
        } catch (e: Exception) {
            null
        }
    }
}
