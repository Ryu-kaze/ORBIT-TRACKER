/**
 * ORBIT GPS — Smart IoT Tracker Firmware
 * Hardware: ESP32-WROOM-32 + u-blox NEO-6M GPS Module
 * 
 * Hardware Wiring:
 * -------------------------------------------------------------
 * ESP32 GPIO 16 (RX2) <---> NEO-6M TX
 * ESP32 GPIO 17 (TX2) <---> NEO-6M RX
 * ESP32 GND           <---> NEO-6M GND
 * ESP32 3.3V or 5V    <---> NEO-6M VCC (Check your breakout: 3.3V-5V compatible)
 * -------------------------------------------------------------
 * 
 * Required Arduino IDE Libraries:
 * - TinyGPSPlus by Mikal Hart (install via Arduino Library Manager)
 * - WiFi (built-in ESP32 core)
 * - HTTPClient (built-in ESP32 core)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <HardwareSerial.h>
#include <TinyGPSPlus.h>

// If config.h exists, use it; otherwise fallback to default credentials
#if __has_include("config.h")
  #include "config.h"
#else
  const char* WIFI_SSID            = "YOUR_WIFI_SSID";
  const char* WIFI_PASSWORD        = "YOUR_WIFI_PASSWORD";
  const char* SERVER_TELEMETRY_URL = "http://192.168.1.100:5000/api/telemetry";
  const char* DEVICE_ID            = "ESP32-ORBIT-01";
  const char* DEVICE_TOKEN         = "orbit_secret_token_2026";
  #define GPS_RX_PIN 16
  #define GPS_TX_PIN 17
  #define GPS_BAUD_RATE 9600
  #define STATUS_LED_PIN 2
  const unsigned long TELEMETRY_INTERVAL_MS = 3000;
#endif

// GPS parser and HardwareSerial instance on UART2
TinyGPSPlus gps;
HardwareSerial SerialGPS(2);

// Timing and state tracking
unsigned long lastTelemetryTime = 0;
unsigned long lastWifiAttempt = 0;
int wifiRetryBackoffMs = 5000;
unsigned long totalSentPackets = 0;
unsigned long totalDroppedPackets = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n===========================================");
  Serial.println("   ORBIT GPS // Smart IoT Tracker v1.0    ");
  Serial.println("===========================================");
  Serial.printf("Device ID: %s\n", DEVICE_ID);
  Serial.printf("GPS UART: RX=%d, TX=%d @ %d baud\n", GPS_RX_PIN, GPS_TX_PIN, GPS_BAUD_RATE);

  // Initialize status LED
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  // Initialize HardwareSerial for NEO-6M GPS on UART2
  SerialGPS.begin(GPS_BAUD_RATE, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // Connect to Wi-Fi
  connectToWiFi();
}

void loop() {
  // Feed incoming GPS NMEA bytes continuously to TinyGPSPlus
  while (SerialGPS.available() > 0) {
    char c = SerialGPS.read();
    gps.encode(c);
  }

  // Handle Wi-Fi reconnection if dropped
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiAttempt > (unsigned long)wifiRetryBackoffMs) {
      Serial.println("[WIFI] Connection lost. Attempting reconnect...");
      lastWifiAttempt = millis();
      WiFi.reconnect();
      // Exponential backoff up to 30 seconds
      wifiRetryBackoffMs = min(wifiRetryBackoffMs * 2, 30000);
    }
    digitalWrite(STATUS_LED_PIN, LOW);
  } else {
    wifiRetryBackoffMs = 5000; // Reset backoff on healthy connection
  }

  // Periodic Telemetry Transmission
  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = millis();
    transmitTelemetry();
  }
}

void connectToWiFi() {
  Serial.printf("[WIFI] Connecting to SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN)); // Blink while connecting
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.printf("[WIFI] IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] Signal Strength (RSSI): %d dBm\n", WiFi.RSSI());
  } else {
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.println("\n[WIFI] Initial connection timed out. Will retry in background loop.");
  }
}

void transmitTelemetry() {
  // Check if GPS location fix is available and valid
  bool fixValid = gps.location.isValid() && gps.location.age() < 5000;
  double latitude = fixValid ? gps.location.lat() : 0.0;
  double longitude = fixValid ? gps.location.lng() : 0.0;
  double speedKmh = gps.speed.isValid() ? gps.speed.kmph() : 0.0;
  double altitudeMeters = gps.altitude.isValid() ? gps.altitude.meters() : 0.0;
  int satellites = gps.satellites.isValid() ? gps.satellites.value() : 0;
  double heading = gps.course.isValid() ? gps.course.deg() : 0.0;

  // Diagnostics to USB Serial
  Serial.printf("[GPS] Fix: %s | Sats: %d | Lat: %.6f, Lng: %.6f | Speed: %.1f km/h | Alt: %.1fm\n",
    fixValid ? "LOCK" : "SEARCHING",
    satellites, latitude, longitude, speedKmh, altitudeMeters
  );

  // Do not transmit empty/invalid (0,0) locations unless reporting fix status
  if (!fixValid) {
    Serial.println("[GPS] Waiting for 3D satellite lock (NEO-6M LED should pulse when locked)...");
    return;
  }

  // Reject Null Island
  if (abs(latitude) < 0.0001 && abs(longitude) < 0.0001) {
    Serial.println("[GPS] Rejecting invalid (0,0) coordinate.");
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[NET] Cannot transmit: Wi-Fi offline.");
    totalDroppedPackets++;
    return;
  }

  // Construct JSON payload
  // Estimate epoch or transmit device timestamp
  unsigned long timestampMs = millis(); 

  char payload[512];
  snprintf(payload, sizeof(payload),
    "{\"device_id\":\"%s\",\"token\":\"%s\",\"lat\":%.6f,\"lng\":%.6f,\"speed\":%.2f,\"altitude\":%.2f,\"satellites\":%d,\"fix\":true,\"heading\":%.1f,\"timestamp\":%lu}",
    DEVICE_ID, DEVICE_TOKEN, latitude, longitude, speedKmh, altitudeMeters, satellites, heading, timestampMs
  );

  HTTPClient http;
  http.begin(SERVER_TELEMETRY_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.setTimeout(4000);

  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0) {
    Serial.printf("[HTTP] POST code: %d | Response: %s\n", httpResponseCode, http.getString().c_str());
    totalSentPackets++;
    // Flash LED quickly to confirm packet dispatch
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(50);
    digitalWrite(STATUS_LED_PIN, HIGH);
  } else {
    Serial.printf("[HTTP] POST failed. Error code: %d (%s)\n", httpResponseCode, http.errorToString(httpResponseCode).c_str());
    totalDroppedPackets++;
  }

  http.end();
}
