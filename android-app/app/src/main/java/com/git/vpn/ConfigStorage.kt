package com.git.vpn

import android.content.Context
import android.content.SharedPreferences

/**
 * Gestisce il salvataggio e caricamento della configurazione VPN
 * Usa SharedPreferences per persistenza
 */
class ConfigStorage(private val context: Context) {
    
    companion object {
        private const val PREFS_NAME = "git_vpn_config"
        private const val KEY_HAS_CONFIG = "has_config"
        private const val KEY_SERVER_IP = "server_ip"
        private const val KEY_SERVER_PORT = "server_port"
        private const val KEY_SERVER_PUBLIC_KEY = "server_public_key"
        private const val KEY_CLIENT_PRIVATE_KEY = "client_private_key"
        private const val KEY_CLIENT_IP = "client_ip"
        private const val KEY_ALLOWED_IPS = "allowed_ips"
        private const val KEY_WEB_APP_URL = "web_app_url"
        private const val KEY_DNS = "dns"
        private const val KEY_PERSISTENT_KEEPALIVE = "persistent_keepalive"
        private const val KEY_PENDING_WEB_APP_URL = "pending_web_app_url"
        private const val KEY_HAS_COMPLETED_SETUP = "has_completed_setup"
    }
    
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    
    /**
     * Salva la configurazione VPN
     */
    fun saveConfig(config: VPNConfigData) {
        prefs.edit().apply {
            putBoolean(KEY_HAS_CONFIG, true)
            putString(KEY_SERVER_IP, config.serverIP)
            putInt(KEY_SERVER_PORT, config.serverPort)
            putString(KEY_SERVER_PUBLIC_KEY, config.serverPublicKey)
            putString(KEY_CLIENT_PRIVATE_KEY, config.clientPrivateKey)
            putString(KEY_CLIENT_IP, config.clientIP)
            putString(KEY_ALLOWED_IPS, config.allowedIPs)
            putString(KEY_WEB_APP_URL, config.webAppUrl)
            config.dns?.let { putString(KEY_DNS, it) }
            config.persistentKeepalive?.let { putInt(KEY_PERSISTENT_KEEPALIVE, it) }
            apply()
        }
    }
    
    /**
     * Carica la configurazione VPN salvata
     */
    fun loadConfig(): VPNConfigData? {
        if (!prefs.getBoolean(KEY_HAS_CONFIG, false)) {
            return null
        }
        
        return VPNConfigData(
            serverIP = prefs.getString(KEY_SERVER_IP, "") ?: "",
            serverPort = prefs.getInt(KEY_SERVER_PORT, 51820),
            serverPublicKey = prefs.getString(KEY_SERVER_PUBLIC_KEY, "") ?: "",
            clientPrivateKey = prefs.getString(KEY_CLIENT_PRIVATE_KEY, "") ?: "",
            clientIP = prefs.getString(KEY_CLIENT_IP, "10.0.0.2/24") ?: "10.0.0.2/24",
            allowedIPs = prefs.getString(KEY_ALLOWED_IPS, "0.0.0.0/0") ?: "0.0.0.0/0",
            webAppUrl = prefs.getString(KEY_WEB_APP_URL, "http://10.0.0.1:26081") ?: "http://10.0.0.1:26081",
            dns = prefs.getString(KEY_DNS, null),
            persistentKeepalive = if (prefs.contains(KEY_PERSISTENT_KEEPALIVE)) {
                prefs.getInt(KEY_PERSISTENT_KEEPALIVE, 0)
            } else {
                null
            }
        ).takeIf { it.serverIP.isNotEmpty() && it.serverPublicKey.isNotEmpty() && it.clientPrivateKey.isNotEmpty() }
    }

    fun setPendingWebAppUrl(url: String) {
        prefs.edit().putString(KEY_PENDING_WEB_APP_URL, url).apply()
    }

    fun getPendingWebAppUrl(): String? {
        return prefs.getString(KEY_PENDING_WEB_APP_URL, null)
    }

    fun clearPendingWebAppUrl() {
        prefs.edit().remove(KEY_PENDING_WEB_APP_URL).apply()
    }

    fun hasCompletedSetup(): Boolean {
        return prefs.getBoolean(KEY_HAS_COMPLETED_SETUP, false)
    }

    fun setCompletedSetup() {
        prefs.edit().putBoolean(KEY_HAS_COMPLETED_SETUP, true).apply()
    }

    fun updateWebAppUrl(url: String): Boolean {
        val current = loadConfig() ?: return false
        saveConfig(
            current.copy(webAppUrl = url)
        )
        return true
    }

    fun updateAllowedIps(allowedIps: String): Boolean {
        val current = loadConfig() ?: return false
        saveConfig(
            current.copy(allowedIPs = allowedIps)
        )
        return true
    }
    
    /**
     * Verifica se esiste una configurazione salvata
     */
    fun hasConfig(): Boolean {
        return prefs.getBoolean(KEY_HAS_CONFIG, false) && loadConfig() != null
    }
    
    /**
     * Elimina la configurazione salvata
     */
    fun clearConfig() {
        prefs.edit().clear().apply()
    }
}
