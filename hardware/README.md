# ESP32 Smart Bin Firmware (HC-SR04 + HTTP)

This folder contains Arduino/C++ firmware for an ESP32 that:

- Measures distance with an HC-SR04 ultrasonic sensor
- Computes bin fill level percentage
- Connects to Wi-Fi using credentials in `config.h`
- Sends sensor data every 30 seconds to your server via HTTP POST
- Blinks onboard LED for send status
- Reconnects Wi-Fi automatically when disconnected

## Files

- `main.ino` - Main firmware logic
- `config.h` - Wi-Fi and server configuration

## Hardware Required

- ESP32 development board
- HC-SR04 ultrasonic sensor
- Jumper wires
- USB cable

## Wiring

- HC-SR04 `TRIG` -> ESP32 GPIO5
- HC-SR04 `ECHO` -> ESP32 GPIO18
- HC-SR04 `VCC` -> 5V
- HC-SR04 `GND` -> GND

### Important electrical note
HC-SR04 `ECHO` is typically a 5V signal. ESP32 GPIO is 3.3V tolerant.
Use a voltage divider or logic-level shifter on the `ECHO` line to protect the ESP32.

## Configuration Steps

1. Open `config.h`
2. Set your Wi-Fi credentials:
   - `WIFI_SSID`
   - `WIFI_PASSWORD`
3. Set your backend IP:
   - `SERVER_IP` (e.g. `192.168.1.50`)
4. (Optional) Change `BIN_ID`

## Build/Upload Steps (Arduino IDE)

1. Install Arduino IDE (or use PlatformIO in VS Code).
2. Install ESP32 board support:
   - Arduino IDE -> Boards Manager -> search `esp32` -> install.
3. Select board:
   - Tools -> Board -> choose your ESP32 model.
4. Select serial port:
   - Tools -> Port -> choose ESP32 COM/tty port.
5. Open `main.ino` and click **Upload**.
6. Open Serial Monitor at **115200 baud**.

## HTTP Payload Sent

Every 30 seconds, firmware sends:

```json
{
  "bin_id": "BIN_001",
  "fill_level": 42.5,
  "timestamp": 1713165000123
}
```

POST URL format:

`http://<SERVER_IP>/api/sensor-data`

## LED Status

- **Success**: single short blink
- **HTTP error / sensor timeout / no Wi-Fi send**: fast-blink pattern

## Fill-Level Formula

`fill% = ((MAX_DISTANCE - measured_cm) / MAX_DISTANCE) * 100`

With `MAX_DISTANCE = 30 cm`:
- 30 cm => 0% (empty)
- 0 cm => 100% (full)

## Notes

- If NTP is available, timestamp uses Unix epoch milliseconds.
- If time is not synced yet, firmware uses uptime milliseconds as fallback.
