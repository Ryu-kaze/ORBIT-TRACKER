/**
 * ORBIT GPS — Web Serial API Service
 * Enables direct USB cable streaming from ESP32 to the browser
 * without requiring Wi-Fi, local IP configuration, or router access.
 */

import { TelemetryPoint } from '../types';

export type SerialDataCallback = (point: TelemetryPoint, rawLine: string) => void;
export type SerialRawLogCallback = (rawLine: string) => void;

class WebSerialService {
  private port: any = null;
  private reader: any = null;
  private keepReading = false;
  private onDataCallback: SerialDataCallback | null = null;
  private onRawLogCallback: SerialRawLogCallback | null = null;
  private connected = false;
  private portInfo = '';

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getPortInfo(): string {
    return this.portInfo || (this.connected ? 'USB Serial Port' : 'Disconnected');
  }

  public setOnDataCallback(callback: SerialDataCallback | null) {
    this.onDataCallback = callback;
  }

  public setOnRawLogCallback(callback: SerialRawLogCallback | null) {
    this.onRawLogCallback = callback;
  }

  public async connect(baudRate: number = 115200): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.',
      };
    }

    try {
      // Prompt user to select ESP32 COM port
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate });
      this.connected = true;
      this.keepReading = true;

      try {
        const info = this.port.getInfo?.();
        if (info && (info.usbVendorId || info.usbProductId)) {
          this.portInfo = `USB VID:${info.usbVendorId?.toString(16)} PID:${info.usbProductId?.toString(16)}`;
        } else {
          this.portInfo = 'USB Serial (COM)';
        }
      } catch {
        this.portInfo = 'USB Serial (COM)';
      }

      // Start background reading loop
      this.readLoop();
      return { success: true };
    } catch (err: unknown) {
      this.connected = false;
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  public async disconnect(): Promise<void> {
    this.keepReading = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch {
      // Ignore cleanup error
    } finally {
      this.connected = false;
      this.portInfo = '';
    }
  }

  private async readLoop() {
    if (!this.port || !this.port.readable) return;

    try {
      const textDecoder = new TextDecoderStream();
      this.port.readable.pipeTo(textDecoder.writable).catch(() => {});
      this.reader = textDecoder.readable.getReader();

      let buffer = '';

      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split(/\r?\n/);
          // Keep incomplete trailing fragment in buffer
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (line) {
              if (this.onRawLogCallback) {
                this.onRawLogCallback(line);
              }
              this.parseLine(line);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[WebSerial] Read error or port closed:', err);
    } finally {
      this.connected = false;
      try {
        this.reader?.releaseLock();
      } catch {}
    }
  }

  private parseLine(line: string) {
    if (!line) return;

    // Format 1: Direct JSON payload
    // Example: {"lat":13.014323,"lng":80.224434,"speed":0.4,"altitude":27.0,"satellites":4,"fix":true}
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const data = JSON.parse(line);
        if (typeof data.lat === 'number' && typeof data.lng === 'number' && data.lat !== 0) {
          const point: TelemetryPoint = {
            lat: data.lat,
            lng: data.lng,
            speed: Number(data.speed) || 0,
            altitude: Number(data.altitude) || 0,
            satellites: Number(data.satellites) || 4,
            fix: Boolean(data.fix),
            heading: Number(data.heading) || 0,
            accuracy: Number(data.accuracy) || 2.5,
            timestamp: Date.now(),
          };
          if (this.onDataCallback) this.onDataCallback(point, line);
          return;
        }
      } catch {}
    }

    // Format 2: Resilient coordinate extraction from serial monitor output
    // Handles formats like:
    // [GPS] Fix: LOCK | Sats: 4 | Lat: 13.014323, Lng: 80.224434 | Speed: 0.4 km/h | Alt: 27.0m
    // Lat: 13.014323, Lng: 80.224434
    // Latitude: 13.014323, Longitude: 80.224434
    const latMatch = line.match(/(?:Lat|Latitude)[:=\s]+([-\d.]+)/i);
    const lngMatch = line.match(/(?:Lng|Lon|Longitude)[:=\s]+([-\d.]+)/i);

    if (latMatch && lngMatch) {
      const lat = parseFloat(latMatch[1]);
      const lng = parseFloat(lngMatch[1]);

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const speedMatch = line.match(/Speed[:=\s]+([-\d.]+)/i);
        const altMatch = line.match(/Alt(?:itude)?[:=\s]+([-\d.]+)/i);
        const satsMatch = line.match(/Sat(?:ellites|s)?[:=\s]+(\d+)/i);
        const fixMatch = line.match(/Fix[:=\s]+([a-zA-Z0-9]+)/i);

        const speed = speedMatch ? parseFloat(speedMatch[1]) : 0;
        const alt = altMatch ? parseFloat(altMatch[1]) : 0;
        const sats = satsMatch ? parseInt(satsMatch[1], 10) : 4;
        const fixVal = fixMatch ? fixMatch[1].toUpperCase() : 'LOCK';
        const isFix = fixVal === 'LOCK' || fixVal === 'TRUE' || fixVal === '1';

        const point: TelemetryPoint = {
          lat,
          lng,
          speed,
          altitude: alt,
          satellites: sats,
          fix: isFix,
          accuracy: 2.5,
          timestamp: Date.now(),
        };

        if (this.onDataCallback) {
          this.onDataCallback(point, line);
        }
      }
    }
  }
}

export const serialService = new WebSerialService();
