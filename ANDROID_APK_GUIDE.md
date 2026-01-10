# Guida Sviluppo APK Android con WireGuard VPN

## Obiettivo
Creare un'app Android che:
1. Si avvia automaticamente
2. Configura e attiva una connessione WireGuard VPN
3. Si collega alla web app in rete LAN tramite WebView
4. Funziona offline quando la VPN è attiva

## Architettura

### Componenti Principali
1. **WireGuard Android SDK** - Gestione VPN
2. **WebView** - Browser integrato per web app
3. **Network Discovery** - Rilevamento automatico server LAN
4. **Configuration Manager** - Gestione configurazione VPN

## Stack Tecnologico

### Android
- **Linguaggio**: Kotlin (moderno) o Java
- **Min SDK**: 24 (Android 7.0) per supporto WireGuard
- **Target SDK**: 34 (Android 14)
- **Architettura**: MVVM o Clean Architecture

### Librerie Necessarie
```gradle
// WireGuard Android
implementation 'com.wireguard.android:tunnel:1.0.+'

// WebView (incluso nel framework Android)
// Network utilities
implementation 'androidx.lifecycle:lifecycle-runtime-ktx:2.7.0'
implementation 'androidx.activity:activity-ktx:1.8.2'
```

## Struttura Progetto

```
Sistema54-Android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/sistema54/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── vpn/
│   │   │   │   │   ├── WireGuardManager.kt
│   │   │   │   │   ├── VPNConfig.kt
│   │   │   │   ├── webview/
│   │   │   │   │   ├── WebAppActivity.kt
│   │   │   │   │   ├── WebViewClient.kt
│   │   │   │   ├── network/
│   │   │   │   │   ├── NetworkDiscovery.kt
│   │   │   │   │   ├── ServerFinder.kt
│   │   │   │   └── utils/
│   │   │   │       ├── ConfigManager.kt
│   │   │   │       └── Constants.kt
│   │   │   ├── res/
│   │   │   │   ├── layout/
│   │   │   │   ├── values/
│   │   │   │   └── drawable/
│   │   │   └── AndroidManifest.xml
│   │   └── test/
├── build.gradle (module)
├── build.gradle (project)
└── settings.gradle
```

## Permessi Richiesti

### AndroidManifest.xml
```xml
<!-- VPN Permissions -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.BIND_VPN_SERVICE" />

<!-- Network Permissions -->
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />

<!-- Location (opzionale, per network discovery) -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Service Declaration -->
<service
    android:name="com.wireguard.android.backend.TunnelService"
    android:permission="android.permission.BIND_VPN_SERVICE"
    android:exported="false" />
```

## Implementazione Step-by-Step

### 1. Configurazione WireGuard

#### WireGuardManager.kt
```kotlin
package com.sistema54.vpn

import android.content.Context
import android.net.VpnService
import com.wireguard.android.backend.Backend
import com.wireguard.android.backend.GoBackend
import com.wireguard.config.Config
import com.wireguard.config.Peer
import com.wireguard.config.Interface
import java.net.InetAddress

class WireGuardManager(private val context: Context) {
    private var backend: Backend? = null
    private var tunnelName = "sistema54-vpn"
    
    suspend fun initialize(): Boolean {
        return try {
            backend = GoBackend(context.applicationContext)
            true
        } catch (e: Exception) {
            false
        }
    }
    
    fun createVPNConfig(
        serverIP: String,
        serverPort: Int,
        publicKey: String,
        privateKey: String,
        allowedIPs: String = "10.0.0.0/8"
    ): Config {
        val interfaceConfig = Interface.Builder()
            .parsePrivateKey(privateKey)
            .parseAddresses("10.0.0.2/24")
            .build()
        
        val peer = Peer.Builder()
            .parsePublicKey(publicKey)
            .parseEndpoint("$serverIP:$serverPort")
            .parseAllowedIPs(allowedIPs)
            .build()
        
        return Config.Builder()
            .setInterface(interfaceConfig)
            .addPeer(peer)
            .build()
    }
    
    suspend fun startVPN(config: Config): Boolean {
        return try {
            val state = backend?.setState(tunnelName, Backend.TunnelState.UP, config)
            state == Backend.TunnelState.UP
        } catch (e: Exception) {
            false
        }
    }
    
    suspend fun stopVPN(): Boolean {
        return try {
            backend?.setState(tunnelName, Backend.TunnelState.DOWN, null)
            true
        } catch (e: Exception) {
            false
        }
    }
    
    fun getVPNState(): Backend.TunnelState? {
        return backend?.getState(tunnelName)
    }
}
```

### 2. WebView per Web App

#### WebAppActivity.kt
```kotlin
package com.sistema54.webview

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import androidx.appcompat.app.AppCompatActivity
import com.sistema54.R

class WebAppActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private val webAppUrl = "http://10.0.0.1:26081" // IP server VPN
    
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_webapp)
        
        webView = findViewById(R.id.webView)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
        }
        
        webView.webViewClient = CustomWebViewClient()
        webView.webChromeClient = WebChromeClient()
        
        // Carica la web app
        webView.loadUrl(webAppUrl)
    }
    
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
    
    private class CustomWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
            // Carica tutte le URL nella WebView
            return false
        }
    }
}
```

### 3. Main Activity - Flusso Principale

#### MainActivity.kt
```kotlin
package com.sistema54

import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.sistema54.vpn.WireGuardManager
import com.sistema54.webview.WebAppActivity
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var vpnManager: WireGuardManager
    private val VPN_REQUEST_CODE = 100
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        vpnManager = WireGuardManager(this)
        
        lifecycleScope.launch {
            initializeAndStartVPN()
        }
    }
    
    private suspend fun initializeAndStartVPN() {
        // Inizializza WireGuard
        if (!vpnManager.initialize()) {
            showError("Errore inizializzazione VPN")
            return
        }
        
        // Richiedi permesso VPN se necessario
        val intent = VpnService.prepare(this)
        if (intent != null) {
            startActivityForResult(intent, VPN_REQUEST_CODE)
            return
        }
        
        // Configura VPN (valori da configurazione o hardcoded per test)
        val config = vpnManager.createVPNConfig(
            serverIP = "YOUR_SERVER_IP",
            serverPort = 51820,
            publicKey = "SERVER_PUBLIC_KEY",
            privateKey = "CLIENT_PRIVATE_KEY"
        )
        
        // Avvia VPN
        if (vpnManager.startVPN(config)) {
            // VPN attiva, apri WebView
            openWebApp()
        } else {
            showError("Errore attivazione VPN")
        }
    }
    
    private fun openWebApp() {
        val intent = Intent(this, WebAppActivity::class.java)
        startActivity(intent)
        finish()
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == VPN_REQUEST_CODE && resultCode == RESULT_OK) {
            lifecycleScope.launch {
                initializeAndStartVPN()
            }
        }
    }
}
```

## Configurazione VPN Server

### Sul Server (Backend)
Il server deve avere WireGuard configurato e attivo.

#### Configurazione WireGuard Server (Ubuntu/Debian)
```bash
# Installa WireGuard
sudo apt update
sudo apt install wireguard

# Genera chiavi
wg genkey | sudo tee /etc/wireguard/private.key
sudo chmod 600 /etc/wireguard/private.key
sudo cat /etc/wireguard/private.key | wg pubkey | sudo tee /etc/wireguard/public.key

# Crea configurazione server
sudo nano /etc/wireguard/wg0.conf
```

#### wg0.conf (Server)
```ini
[Interface]
PrivateKey = SERVER_PRIVATE_KEY
Address = 10.0.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
PublicKey = CLIENT_PUBLIC_KEY
AllowedIPs = 10.0.0.2/32
```

#### Avvia WireGuard Server
```bash
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

## Configurazione Client Android

### Configurazione VPN da App
L'app deve generare/gestire le chiavi e configurare il tunnel.

**Nota**: Per produzione, considera:
- QR code per configurazione facile
- Backup/restore configurazione
- Gestione multiple connessioni VPN

## Test e Debug

### Test Locale
1. Configura server WireGuard
2. Installa app su dispositivo Android
3. Verifica connessione VPN
4. Test accesso web app tramite IP VPN

### Debug
- Usa `adb logcat` per vedere i log
- Verifica stato VPN: `adb shell dumpsys connectivity`
- Test connessione: `adb shell ping 10.0.0.1`

## Prossimi Step Implementazione

1. ✅ Creare struttura progetto Android
2. ✅ Implementare WireGuardManager
3. ✅ Implementare WebView
4. ✅ Test connessione VPN base
5. ⏳ Rilevamento automatico server LAN
6. ⏳ Gestione configurazione dinamica
7. ⏳ UI per stato VPN
8. ⏳ Gestione errori e riconnessione

## Note Importanti

### Sicurezza
- **Non committare chiavi private nel repository**
- Usa Android Keystore per salvare chiavi sensibili
- Valida configurazione VPN prima di attivarla

### Performance
- WebView può essere pesante, considera caching
- VPN attivo consuma batteria, gestisci timeout automatici

### UX
- Mostra indicatore stato VPN
- Notifica utente quando VPN si disconnette
- Offri opzione per riconnessione automatica

## Risorse

- [WireGuard Android Documentation](https://www.wireguard.com/install/)
- [WireGuard Protocol](https://www.wireguard.com/protocol/)
- [Android WebView Guide](https://developer.android.com/develop/ui/views/layout/webapps)
- [VPN Service Android](https://developer.android.com/guide/topics/connectivity/vpn)
