# Guida Importazione Configurazione WireGuard

L'app Sistema54 supporta l'importazione di file di configurazione WireGuard (.conf) per configurare automaticamente la connessione VPN.

## Come Funziona

1. **Primo Avvio**: All'avvio dell'app, se non è presente una configurazione salvata, viene mostrato un pulsante per importare un file .conf
2. **Selezione File**: Tocca il pulsante "Importa file .conf WireGuard" e seleziona il file .conf dal dispositivo
3. **Parsing Automatico**: L'app parserà automaticamente il file e estrarrà tutti i parametri necessari
4. **Salvataggio**: La configurazione viene salvata in modo sicuro sul dispositivo
5. **Connessione**: L'app procederà automaticamente con la connessione VPN

## Formato File .conf Supportato

L'app supporta il formato standard WireGuard `.conf`:

```conf
[Interface]
PrivateKey = YOUR_CLIENT_PRIVATE_KEY
Address = 10.0.0.2/24
DNS = 10.0.0.1, 8.8.8.8

[Peer]
PublicKey = SERVER_PUBLIC_KEY
Endpoint = YOUR_SERVER_IP:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

### Parametri Supportati

**Sezione [Interface]:**
- `PrivateKey` (obbligatorio): Chiave privata del client
- `Address` (opzionale): Indirizzo IP del client nella VPN (default: 10.0.0.2/24)
- `DNS` (opzionale): Server DNS da utilizzare

**Sezione [Peer]:**
- `PublicKey` (obbligatorio): Chiave pubblica del server WireGuard
- `Endpoint` (obbligatorio): IP o hostname del server e porta (es: 192.168.1.1:51820)
- `AllowedIPs` (opzionale): Reti da instradare tramite VPN (default: 0.0.0.0/0)
- `PersistentKeepalive` (opzionale): Intervallo in secondi per keepalive (default: nessuno)

### URL Web App (Opzionale)

Puoi specificare l'URL della web app in due modi:

1. **Nel file .conf come commento:**
   ```conf
   # WebAppUrl: http://10.0.0.1:26081
   ```

2. **Automatico**: Se non specificato, l'app assumerà che il server sia `.1` rispetto all'IP del client (es: se Address è 10.0.0.2/24, userà 10.0.0.1:26081)

## Esempio File .conf per RouterOS Mikrotik

Se usi un server WireGuard su RouterOS Mikrotik, puoi esportare la configurazione del client e usarla direttamente:

```conf
[Interface]
PrivateKey = CLIENT_PRIVATE_KEY_FROM_MIKROTIK
Address = 10.0.0.100/24
DNS = 10.0.0.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY_FROM_MIKROTIK
Endpoint = YOUR_MIKROTIK_PUBLIC_IP:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25

# WebAppUrl: http://10.0.0.1:26081
```

## Creazione File .conf dal RouterOS Mikrotik

1. **Export Configurazione Client**:
   - Vai su IP → WireGuard → Peers
   - Seleziona il peer del client
   - Clicca su "Export" o "Copy Config"
   - Salva come file `.conf`

2. **Modifica se necessario**:
   - Verifica che `Endpoint` contenga l'IP pubblico o raggiungibile del server
   - Aggiungi `# WebAppUrl: http://10.0.0.1:26081` se l'URL della web app è diverso
   - Verifica che `AllowedIPs` sia configurato correttamente per le tue esigenze

## Reset Configurazione

Per reimportare una configurazione o cambiare file .conf:

1. Elimina i dati dell'app nelle impostazioni Android
2. Oppure disinstalla e reinstalla l'app
3. All'avvio successivo, verrà richiesta nuovamente l'importazione

## Troubleshooting

**Errore "File .conf non valido"**
- Verifica che il file contenga almeno le sezioni `[Interface]` e `[Peer]`
- Verifica che siano presenti `PrivateKey` e `PublicKey`
- Verifica che il formato sia corretto (nessun carattere speciale extra)

**Errore "Endpoint format invalid"**
- Verifica che `Endpoint` sia nel formato `IP:PORTA` o `HOSTNAME:PORTA`
- Esempio corretto: `192.168.1.1:51820` o `vpn.example.com:51820`

**VPN non si connette dopo l'importazione**
- Verifica che l'`Endpoint` sia raggiungibile dal dispositivo
- Verifica che le chiavi (PrivateKey e PublicKey) siano corrette
- Verifica che il server WireGuard sia attivo e raggiungibile
- Controlla i log dell'app per errori specifici
