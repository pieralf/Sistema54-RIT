# Guida per APK Android con WireGuard VPN

## Panoramica

Questa guida descrive come creare un'app Android che:
1. Si connette automaticamente a una VPN WireGuard
2. Si collega alla web app Sistema54-RIT in LAN

## Architettura Proposta

### Opzione 1: WebView con VPN (Consigliata)
Un'app Android che:
- Utilizza WireGuard Android SDK per gestire la connessione VPN
- Contiene un WebView che carica la web app
- Gestisce automaticamente la connessione/disconnessione VPN

### Opzione 2: Browser Custom
- App che apre il browser di sistema con configurazione VPN
- Meno controllo ma più semplice

## Implementazione Consigliata (Opzione 1)

### Tecnologie Richieste
- **Android Studio** (ultima versione)
- **Kotlin** o **Java** per Android
- **WireGuard Android SDK**: https://github.com/WireGuard/wireguard-android
- **WebView** per caricare la web app

### Struttura App

```
sistema54-android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/sistema54/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── VpnManager.kt
│   │   │   │   └── ConfigManager.kt
│   │   │   ├── res/
│   │   │   └── AndroidManifest.xml
│   ├── build.gradle
├── build.gradle
└── settings.gradle
```

### Implementazione Step-by-Step

#### 1. Configurazione WireGuard

**File: `app/build.gradle`**
```gradle
dependencies {
    implementation 'com.wireguard.android:tunnel:1.0.20230223'
    // Altri dependencies
}
```

#### 2. MainActivity con WebView

```kotlin
class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var vpnManager: VpnManager
    private val WEB_APP_URL = "http://[IP_SERVER]:[FRONTEND_PORT]"
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        webView = findViewById(R.id.webView)
        vpnManager = VpnManager(this)
        
        setupWebView()
        connectVpnAndLoadApp()
    }
    
    private fun connectVpnAndLoadApp() {
        // 1. Connetti VPN
        vpnManager.connect { success ->
            if (success) {
                // 2. Carica web app dopo connessione VPN
                runOnUiThread {
                    webView.loadUrl(WEB_APP_URL)
                }
            } else {
                // Mostra errore
                showError("Impossibile connettersi alla VPN")
            }
        }
    }
    
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
        }
    }
}
```

#### 3. VpnManager per Gestione WireGuard

```kotlin
class VpnManager(private val context: Context) {
    private var tunnel: Tunnel? = null
    
    fun connect(callback: (Boolean) -> Unit) {
        // Carica configurazione WireGuard
        val config = loadWireGuardConfig()
        
        try {
            tunnel = Tunnel(config, context)
            tunnel?.setStateChangedListener { state ->
                when (state) {
                    Tunnel.State.UP -> callback(true)
                    Tunnel.State.DOWN -> callback(false)
                }
            }
            tunnel?.up()
        } catch (e: Exception) {
            callback(false)
        }
    }
    
    fun disconnect() {
        tunnel?.down()
    }
    
    private fun loadWireGuardConfig(): String {
        // Carica configurazione da assets o server
        // Formato: standard WireGuard .conf
        return """
            [Interface]
            PrivateKey = [PRIVATE_KEY]
            Address = [VPN_IP]
            DNS = [DNS_SERVER]
            
            [Peer]
            PublicKey = [SERVER_PUBLIC_KEY]
            Endpoint = [SERVER_IP]:[PORT]
            AllowedIPs = [ALLOWED_IPS]
        """.trimIndent()
    }
}
```

#### 4. AndroidManifest.xml

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <application>
        <activity android:name=".MainActivity">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### Configurazione WireGuard Server

Per permettere connessioni VPN, devi configurare WireGuard sul server:

```bash
# Installa WireGuard sul server
sudo apt install wireguard wireguard-tools

# Genera chiavi
wg genkey | tee private.key | wg pubkey > public.key

# Configurazione server: /etc/wireguard/wg0.conf
[Interface]
PrivateKey = [SERVER_PRIVATE_KEY]
Address = 10.0.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
PublicKey = [CLIENT_PUBLIC_KEY]
AllowedIPs = 10.0.0.2/32
```

### Configurazione Cliente (da includere nell'APK)

```conf
[Interface]
PrivateKey = [CLIENT_PRIVATE_KEY]
Address = 10.0.0.2/24
DNS = 10.0.0.1

[Peer]
PublicKey = [SERVER_PUBLIC_KEY]
Endpoint = [SERVER_PUBLIC_IP]:51820
AllowedIPs = 192.168.0.0/16  # Rete LAN del server
PersistentKeepalive = 25
```

### Varianti Implementative

#### Variante A: Configurazione Hardcoded
- Config WireGuard inclusa nell'APK
- Pro: Semplice
- Contro: Meno flessibile

#### Variante B: Configurazione Dinamica
- Config scaricata da server alla prima apertura
- Pro: Più flessibile, può cambiare configurazione
- Contro: Più complessa

#### Variante C: QR Code Setup
- Utente scansiona QR code per configurare VPN
- Pro: Setup facile per utenti
- Contro: Richiede server di provisioning

### Sicurezza

1. **Chiavi Private**: Mai committate nel repository
2. **HTTPS**: Usa HTTPS per la web app se possibile
3. **Validazione Certificati**: Verifica certificati SSL
4. **Obfuscazione**: Offusca l'APK per proteggere configurazioni

### Testing

1. Testa connessione VPN prima di caricare web app
2. Gestisci disconnessioni VPN durante l'uso
3. Mostra notifiche di stato VPN
4. Permetti riconnessione automatica

### Risorse Utili

- WireGuard Android: https://github.com/WireGuard/wireguard-android
- WebView Guide: https://developer.android.com/develop/ui/views/layout/webapps
- VPN Best Practices: https://www.wireguard.com/

### Note Implementative

- L'URL della web app deve essere configurabile (non hardcoded)
- Considera l'uso di Deep Linking per aprire sezioni specifiche
- Implementa fallback se VPN non disponibile (es. connessione diretta LAN)

## Alternative: Soluzione Più Semplice

Se la soluzione completa è troppo complessa, considera:

1. **App Minimalista**: Apre semplicemente il browser con URL pre-configurato
2. **WireGuard App Ufficiale + Bookmark**: Usa l'app WireGuard ufficiale + bookmark browser
3. **PWA (Progressive Web App)**: Converti la web app in PWA installabile
