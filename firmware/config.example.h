/**
 * ORBIT GPS — Hardware Configuration Template
 * Rename or copy this file to 'config.h' in your firmware directory.
 * 
 * IMPORTANT: 
 * 1. Put your actual Wi-Fi credentials here.
 * 2. Use your laptop's Local Area Network (LAN) IP (e.g., http://192.168.1.150:5000/api/telemetry),
 *    NEVER 'localhost' or '127.0.0.1', because the ESP32 is a separate device on the network.
 * 3. Never commit 'config.h' with real credentials to public git repositories.
 */

#ifndef ORBIT_CONFIG_H
#define ORBIT_CONFIG_H

// --- Wi-Fi Settings ---
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// --- ORBIT Backend Server Endpoint ---
// Replace with your laptop's IPv4 address from 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux)
const char* SERVER_TELEMETRY_URL = "http://192.168.1.100:5000/api/telemetry";

// --- Device Authentication ---
const char* DEVICE_ID   = "ESP32-ORBIT-01";
const char* DEVICE_TOKEN = "orbit_secret_token_2026"; // Must match DEVICE_AUTH_TOKEN in backend

// --- Hardware Pin Definitions for ESP32 ---
// GPS NEO-6M UART Pins:
#define GPS_RX_PIN 16 // ESP32 GPIO 16 (RX2) connects to NEO-6M TX
#define GPS_TX_PIN 17 // ESP32 GPIO 17 (TX2) connects to NEO-6M RX
#define GPS_BAUD_RATE 9600 // Standard factory baud rate for u-blox NEO-6M

// Optional onboard status LED (GPIO 2 on most ESP32 Dev Boards)
#define STATUS_LED_PIN 2

// Telemetry transmit interval (in milliseconds)
const unsigned long TELEMETRY_INTERVAL_MS = 3000; // 3 seconds

#endif // ORBIT_CONFIG_H
