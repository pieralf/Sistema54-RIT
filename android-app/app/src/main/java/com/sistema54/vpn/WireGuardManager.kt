package com.sistema54.vpn

import android.content.Context
import com.wireguard.android.backend.Backend
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import com.wireguard.config.Peer
import com.wireguard.config.Interface

class WireGuardManager(private val context: Context) {
    private var backend: Backend? = null
    private var tunnel: Tunnel? = null
    private val tunnelName = "sistema54-vpn"
    
    suspend fun initialize(): Boolean {
        return try {
            backend = GoBackend(context.applicationContext)
            tunnel = Tunnel(tunnelName, null, Backend.TunnelState.DOWN)
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
            peerBuilder.parsePersistentKeepalive(it)
        }
        
        val peer = peerBuilder.build()
        
        return Config.Builder()
            .setInterface(interfaceConfig)
            .addPeer(peer)
            .build()
    }
    
    suspend fun startVPN(config: Config): Boolean {
        return try {
            tunnel = Tunnel(tunnelName, config, Backend.TunnelState.DOWN)
            val state = backend?.setState(tunnel!!, Backend.TunnelState.UP, config)
            state == Backend.TunnelState.UP
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
    
    suspend fun stopVPN(): Boolean {
        return try {
            if (tunnel != null) {
                backend?.setState(tunnel!!, Backend.TunnelState.DOWN, null)
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
    
    fun getVPNState(): Backend.TunnelState? {
        return try {
            if (tunnel != null) {
                backend?.getState(tunnel!!)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }
}
