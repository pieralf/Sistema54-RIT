package com.git

import android.app.Application
import com.git.vpn.WireGuardManager

/**
 * Application class per gestire il WireGuardManager come singleton
 * così può essere accessibile da tutte le Activity
 */
class GitApplication : Application() {
    lateinit var vpnManager: WireGuardManager
        private set
    
    override fun onCreate() {
        super.onCreate()
        vpnManager = WireGuardManager(this)
    }
}
