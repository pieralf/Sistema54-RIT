package com.sistema54.vpn

import android.content.Context
import com.wireguard.android.backend.Backend
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import com.wireguard.config.Peer
import com.wireguard.config.Interface

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
    private val tunnelName = "sistema54-vpn"
    
    // Creiamo il tunnel come oggetto che implementa l'interfaccia
    private val tunnel: Tunnel = SimpleTunnel(tunnelName)
    
    suspend fun initialize(): Boolean {
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
        persistentKeepalive: Int? = null
    ): Config {
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
    
    suspend fun startVPN(config: Config): Boolean {
        return try {
            val state = backend?.setState(tunnel, Tunnel.State.UP, config)
            state == Tunnel.State.UP
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
    
    suspend fun stopVPN(): Boolean {
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
