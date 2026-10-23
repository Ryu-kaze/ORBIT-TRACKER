#!/usr/bin/env python3
"""
ORBIT GPS — USB Serial Cable Bridge
Reads live GPS coordinates from the ESP32 plugged via USB cable (e.g. COM3)
and automatically sends them to the local Flask backend on port 5000.
"""

import sys
import time
import re
import json
import urllib.request
import urllib.error

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("[!] pyserial is not installed. Install with: pip install pyserial")
    sys.exit(1)

BACKEND_URL = "http://localhost:5000/api/telemetry"
DEVICE_TOKEN = "orbit_secret_token_2026"
DEFAULT_BAUD = 115200

def find_esp32_port():
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        desc = p.description.lower()
        if "cp210" in desc or "ch340" in desc or "usb-serial" in desc or "uart" in desc:
            return p.device
    if ports:
        return ports[0].device
    return "COM3"

def main():
    port = sys.argv[1] if len(sys.argv) > 1 else find_esp32_port()
    baud = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_BAUD

    print("==================================================")
    print("   ORBIT GPS // USB Serial Cable Bridge           ")
    print("==================================================")
    print(f"[*] Connecting to ESP32 on: {port} @ {baud} baud")
    print(f"[*] Forwarding to: {BACKEND_URL}")
    print("==================================================")

    try:
        ser = serial.Serial(port, baud, timeout=2)
        print(f"[+] Serial port {port} opened successfully!")
        print("[+] Listening for live GPS data from USB cable...\n")
    except Exception as e:
        print(f"[-] Failed to open {port}: {e}")
        print("    Tip: Close Arduino Serial Monitor so COM3 is not busy, then retry.")
        return

    # Resilient regexes matching any serial monitor string containing Lat and Lng
    lat_regex = re.compile(r"(?:Lat|Latitude)[:=\s]+([-\d.]+)", re.I)
    lng_regex = re.compile(r"(?:Lng|Lon|Longitude)[:=\s]+([-\d.]+)", re.I)
    speed_regex = re.compile(r"Speed[:=\s]+([-\d.]+)", re.I)
    alt_regex = re.compile(r"Alt(?:itude)?[:=\s]+([-\d.]+)", re.I)
    sats_regex = re.compile(r"Sat(?:ellites|s)?[:=\s]+(\d+)", re.I)
    fix_regex = re.compile(r"Fix[:=\s]+([a-zA-Z0-9]+)", re.I)

    last_sent = 0

    while True:
        try:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            if not line:
                continue

            # Check for coordinates
            lat_m = lat_regex.search(line)
            lng_m = lng_regex.search(line)

            if lat_m and lng_m:
                lat = float(lat_m.group(1))
                lng = float(lng_m.group(1))

                if lat == 0.0 and lng == 0.0:
                    continue

                speed_m = speed_regex.search(line)
                alt_m = alt_regex.search(line)
                sats_m = sats_regex.search(line)
                fix_m = fix_regex.search(line)

                speed = float(speed_m.group(1)) if speed_m else 0.0
                alt = float(alt_m.group(1)) if alt_m else 0.0
                satellites = int(sats_m.group(1)) if sats_m else 4
                fix_val = fix_m.group(1).upper() if fix_m else "LOCK"
                is_fix = fix_val in ("LOCK", "TRUE", "1")

                # Throttle to max 1 packet per second if needed
                now = time.time()
                if now - last_sent < 0.5:
                    continue
                last_sent = now

                payload = {
                    "device_id": "ESP32-ORBIT-01",
                    "token": DEVICE_TOKEN,
                    "lat": lat,
                    "lng": lng,
                    "speed": speed,
                    "altitude": alt,
                    "satellites": satellites,
                    "fix": is_fix,
                    "heading": 0.0,
                    "timestamp": int(now * 1000)
                }

                req = urllib.request.Request(
                    BACKEND_URL,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "X-Device-Token": DEVICE_TOKEN
                    }
                )

                try:
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        print(f"[OK] Forwarded from USB -> Lat: {lat:.6f}, Lng: {lng:.6f} | Speed: {speed} km/h | Sats: {satellites}")
                except Exception as post_err:
                    print(f"[!] Sent from USB, backend returned: {post_err}")

        except KeyboardInterrupt:
            print("\n[*] Exiting serial bridge.")
            break
        except Exception as e:
            print(f"[!] Read error: {e}")
            time.sleep(1)

    ser.close()

if __name__ == "__main__":
    main()
