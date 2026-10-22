# ORBIT GPS — Personal Tracking Intelligence

A high-precision personal IoT GPS Tracker application engineered for the **ESP32-WROOM-32** development board and **u-blox NEO-6M** GNSS receiver module. Features a dark aerospace-inspired dashboard, real-time Leaflet tracking map, smart geofencing with hysteresis, journey history playback, speed analytics, and beginner-friendly hardware diagnostics.

---

## 1. Hardware Architecture & Wiring

### Bill of Materials
- **Microcontroller**: ESP32-WROOM-32 Development Board (30 or 38-pin)
- **GPS Receiver**: u-blox NEO-6M GNSS Breakout Module with Ceramic Patch Antenna
- **Prototyping**: Solderless Breadboard & 4x Male-to-Female / Male-to-Male Jumper Wires
- **Host Machine**: Windows Laptop with Wi-Fi & USB Port

### Circuit Schematic & Pin Mapping

```
  +----------------------+                 +----------------------+
  |    ESP32-WROOM-32    |                 |   u-blox NEO-6M GPS  |
  |                      |                 |                      |
  |      GPIO 16 (RX2)   |<----------------| TX (Transmit)        |
  |      GPIO 17 (TX2)   |---------------->| RX (Receive)         |
  |      GND             |-----------------| GND (Ground)         |
  |      3.3V or 5V(VIN) |-----------------| VCC (Power)          |
  +----------------------+                 +----------------------+
```

> **Important Power Note**: Most NEO-6M breakout boards have an onboard 3.3V LDO regulator and accept **5V (VIN)** or **3.3V**. Ensure good electrical contact on the breadboard.

---

## 2. Quickstart for Windows Laptop

### Step 1: Find Your Laptop's Local Wi-Fi IP Address
Because the ESP32 is an independent device on your local network, it **cannot** reach `localhost` or `127.0.0.1`. You must find your laptop's Wi-Fi IPv4 address:

1. Open **Command Prompt** (`cmd`) or **PowerShell**.
2. Run:
   ```cmd
   ipconfig
   ```
3. Locate your active **Wireless LAN adapter Wi-Fi** section.
4. Note the **IPv4 Address** (e.g., `192.168.1.150`).
5. Your backend server URL will be: `http://192.168.1.150:5000/api/telemetry`

---

### Step 2: Start the Python Flask Backend
In Command Prompt / PowerShell:

```cmd
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
The server will start listening on `http://0.0.0.0:5000`. It automatically creates and migrates the SQLite database `orbit_gps.db`.

To run backend automated tests:
```cmd
python test_app.py
```

---

### Step 3: Flash the ESP32 Firmware via Arduino IDE

1. **Install Arduino IDE** (version 2.x recommended).
2. **Install ESP32 Board Core**:
   - In Arduino IDE, go to *File -> Preferences*.
   - Add this URL to *Additional Boards Manager URLs*:  
     `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Go to *Tools -> Board -> Boards Manager*, search for `esp32` by Espressif Systems, and click **Install**.
3. **Install TinyGPSPlus Library**:
   - Go to *Sketch -> Include Library -> Manage Libraries...*
   - Search for `TinyGPSPlus` by Mikal Hart and click **Install**.
4. **Open the Sketch**:
   - Open `firmware/esp32_gps_tracker.ino`.
   - Copy `firmware/config.example.h` to `firmware/config.h` (or edit credentials directly in the sketch):
     ```cpp
     const char* WIFI_SSID            = "Your_WiFi_Name";
     const char* WIFI_PASSWORD        = "Your_WiFi_Password";
     const char* SERVER_TELEMETRY_URL = "http://192.168.1.150:5000/api/telemetry"; // your laptop LAN IP
     const char* DEVICE_TOKEN         = "orbit_secret_token_2026";
     ```
5. **Connect & Upload**:
   - Connect your ESP32 to your Windows laptop with a data-capable USB cable.
   - Select *Tools -> Board -> ESP32 Arduino -> ESP32 Dev Module*.
   - Select your USB COM port under *Tools -> Port* (e.g., `COM3` or `COM5`).
   - Click the **Upload** arrow button. *(If uploading stalls at `Connecting...`, press and hold the `BOOT` button on the ESP32 board until the flashing begins).*
6. **Open Serial Monitor**:
   - Set baud rate to **115200**.
   - You will see the Wi-Fi connection handshake and satellite diagnostics.

---

### Step 4: Run the Web Dashboard

In a new terminal window:
```cmd
npm install
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## 3. Demo Mode vs. Hardware Mode

- **Demo Mode**: Emulates realistic movement across a research campus circuit with variable velocity, satellite constellation counts, and geofence breaches. Useful for classroom presentations and frontend validation without needing immediate outdoor GPS lock.
- **Hardware Mode**: Connects directly to your Flask REST API (`http://localhost:5000` or custom LAN IP configured in Device Settings). If the ESP32 is powered off or waiting for satellite lock, the UI displays genuine diagnostics and will **never** invent fake coordinates.

---

## 4. GPS Receiver Troubleshooting & Satellite Lock

- **Solid Red LED on NEO-6M**: The GPS board has power and is searching for satellite orbits.
- **Blinking 1Hz Red LED on NEO-6M**: 3D Satellite Lock is **acquired**! The receiver has tracked $\ge 4$ satellites and is outputting valid coordinates.
- **Cold Start Outdoors**: GPS satellite signals (1.5 GHz) cannot penetrate reinforced concrete walls or metal roofs. For your initial test, place the antenna near an open window or outdoors with a clear line of sight to the sky. Initial acquisition takes 45–90 seconds.

---

## 5. Remote Tracking Outside Local Wi-Fi

The initial hardware firmware uses local Wi-Fi to communicate with your laptop on the same router. To track the device remotely when walking outdoors away from home/college:

1. **Smartphone Wi-Fi Hotspot**: Configure `WIFI_SSID` and `WIFI_PASSWORD` to your phone's personal hotspot. Connect both the laptop and ESP32 to the hotspot.
2. **Cloudflare Tunnel / ngrok (Free & Secure)**: Expose your local Flask port `5000` through a secure tunnel:
   ```cmd
   ngrok http 5000
   ```
   Set `SERVER_TELEMETRY_URL` in the firmware to your `https://your-tunnel.ngrok-free.app/api/telemetry`.
3. **Cloud Run / VPS Deployment**: Deploy `backend/app.py` to Google Cloud Run or any VPS and point the ESP32 to the public HTTPS URL.
4. **GSM / Cellular Upgrade**: In future iterations, replace or augment Wi-Fi with an A9G or SIM7600 4G LTE cellular breakout.

---

## 6. REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Healthcheck and timestamp |
| `POST` | `/api/telemetry` | Ingests GPS point (requires token authentication) |
| `GET` | `/api/telemetry/latest` | Returns most recent valid GPS point |
| `GET` | `/api/history` | Historical points filtered by session/timestamp |
| `GET` | `/api/analytics` | Distance, avg/max speed, duration totals |
| `GET` | `/api/geofences` | Lists all active circular geofences |
| `POST` | `/api/geofences` | Creates a new circular geofence boundary |
| `DELETE` | `/api/geofences/<id>` | Deletes a geofence |
| `GET` | `/api/events` | Retrieves system alerts & boundary crossings |
| `POST` | `/api/events/<id>/acknowledge` | Acknowledges an alert |
| `GET` | `/api/device/status` | Current connection, last seen, and fix status |
| `POST` | `/api/tracking/start` | Initializes a new recording session |
| `POST` | `/api/tracking/stop` | Concludes active recording session |

---

## 7. Automated Test Suites

- **Geospatial & Telemetry Math Tests** (TypeScript with `node:test`):
  ```bash
  npx tsx --test src/utils/geo.test.ts
  ```
- **Flask REST API & Database Tests** (Python `unittest`):
  ```bash
  python3 backend/test_app.py
  ```

---

## License
MIT License. Built for IoT engineering education, hardware prototyping, and navigation intelligence.
