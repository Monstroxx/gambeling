# Risk Discord Bot

Ein Discord Bot mit einem `/risk` Command, der zufällige Timeouts oder eine Jackpot-Rolle vergibt.

## Setup

1. **Dependencies installieren:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   - Kopiere `.env.example` zu `.env`
   - Füge deine Bot-Daten ein:
     - `DISCORD_TOKEN`: Dein Bot Token
     - `CLIENT_ID`: Deine Bot Client ID
     - `GUILD_ID`: Die Server ID
     - `JACKPOT_ROLE_ID`: Die ID der Jackpot-Rolle (z.B. "Executioner")

3. **Bot starten:**
   ```bash
   npm start
   ```

## Wahrscheinlichkeiten

- **Sicher (25%)**: Nichts passiert
- **1-5 Min Timeout (30%)**: Kurze Timeouts mit hoher Wahrscheinlichkeit
- **20 Min Timeout (15%)**: Mittlere Strafe
- **1 Std Timeout (12%)**: Längere Strafe
- **3 Std Timeout (8%)**: Harte Strafe
- **6 Std Timeout (5%)**: Sehr harte Strafe
- **12 Std Timeout (3%)**: Extreme Strafe
- **24 Std Timeout (2%)**: Maximum Strafe
- **Jackpot Role (0.1%)**: Seltene Belohnung

## Bot Berechtigungen

Der Bot braucht folgende Berechtigungen:
- `Moderate Members` (für Timeouts)
- `Manage Roles` (für Jackpot-Rolle)
- `Send Messages`
- `Use Slash Commands`