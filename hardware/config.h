#ifndef CONFIG_H
#define CONFIG_H

// ===============================
// Wi-Fi Configuration
// ===============================
// Replace with your local network credentials.
static const char* WIFI_SSID = "YOUR_WIFI_SSID";
static const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ===============================
// Server Configuration
// ===============================
// Example: "192.168.1.50" (without http://)
static const char* SERVER_IP = "192.168.1.50";

// Unique bin identifier sent in payloads
static const char* BIN_ID = "BIN_001";

// ===============================
// Optional Time Sync (NTP)
// ===============================
// Used to produce epoch timestamps in milliseconds.
static const char* NTP_SERVER = "pool.ntp.org";

#endif  // CONFIG_H
