# Setup WireGuard Server per Sistema54

## Prerequisiti
- Server Ubuntu/Debian con accesso root
- Porta UDP 51820 aperta nel firewall
- IP forwarding abilitato

## Installazione WireGuard sul Server

```bash
# Aggiorna sistema
sudo apt update && sudo apt upgrade -y

# Installa WireGuard
sudo apt install wireguard wireguard-tools -y

# Abilita IP forwarding
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## Generazione Chiavi

```bash
# Entra nella directory WireGuard
cd /etc/wireguard

# Genera chiavi server
sudo wg genkey | sudo tee private.key | sudo wg pubkey | sudo tee public.key
sudo chmod 600 private.key

# Visualizza chiavi (SALVA IN POSTO SICURO)
echo "=== CHIAVI SERVER ==="
echo "Private Key: $(sudo cat private.key)"
echo "Public Key: $(sudo cat public.key)"
```

## Configurazione Server

Crea `/etc/wireguard/wg0.conf`:

```ini
[Interface]
PrivateKey = SERVER_PRIVATE_KEY_QUI
Address = 10.0.0.1/24
ListenPort = 51820

# Forward traffic (sostituisci eth0 con la tua interfaccia)
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# Client Android (genera chiavi client separate)
[Peer]
PublicKey = CLIENT_PUBLIC_KEY_QUI
AllowedIPs = 10.0.0.2/32
```

## Generazione Chiavi Client (per Android App)

```bash
# Genera chiavi client
wg genkey | tee client_private.key | wg pubkey | tee client_public.key

# Visualizza chiavi client
echo "=== CHIAVI CLIENT (ANDROID) ==="
echo "Private Key: $(cat client_private.key)"
echo "Public Key: $(cat client_public.key)"
```

**IMPORTANTE**: 
- Server Public Key → va nella config Android
- Client Private Key → va nella config Android
- Client Public Key → va nel file `wg0.conf` del server come `[Peer]`

## Avvio WireGuard

```bash
# Avvia interfaccia
sudo wg-quick up wg0

# Abilita avvio automatico
sudo systemctl enable wg-quick@wg0

# Verifica stato
sudo wg show
```

## Configurazione Firewall

```bash
# Consenti UDP 51820
sudo ufw allow 51820/udp

# Se necessario, consenti forwarding
sudo ufw route allow in on wg0 out on eth0
```

## Configurazione Docker/Backend

Se il backend è in Docker, assicurati che:
1. La rete Docker possa accedere alla VPN
2. Il backend sia raggiungibile dall'IP VPN (10.0.0.1)

## Test Configurazione

```bash
# Sul server, verifica che WireGuard sia attivo
sudo wg show

# Dovresti vedere:
# interface: wg0
# public key: SERVER_PUBLIC_KEY
# listening port: 51820
```

## Configurazione Android App

Nel file `android-app/app/src/main/java/com/sistema54/vpn/VPNConfig.kt`:

```kotlin
const val serverIP = "TUO_IP_SERVER"  // IP pubblico o LAN
const val serverPort = 51820
const val serverPublicKey = "SERVER_PUBLIC_KEY_QUI"
const val clientPrivateKey = "CLIENT_PRIVATE_KEY_QUI"
```

## Troubleshooting

### VPN non si connette
- Verifica che la porta 51820 sia aperta
- Controlla i log: `sudo journalctl -u wg-quick@wg0 -f`
- Verifica chiavi: devono corrispondere tra server e client

### Traffico non passa
- Verifica IP forwarding: `sysctl net.ipv4.ip_forward` (deve essere 1)
- Controlla iptables: `sudo iptables -L -n -v`
- Verifica routing: `ip route show`

### Android non può connettersi
- Verifica permessi VPN nell'app Android
- Controlla che il server sia raggiungibile: `ping YOUR_SERVER_IP`
- Verifica configurazione chiavi nell'app
