#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>
#include <sys/time.h>
#include "config.h"

// ===============================
// Pin Mapping
// ===============================
static const uint8_t TRIG_PIN = 5;   // HC-SR04 TRIG
static const uint8_t ECHO_PIN = 18;  // HC-SR04 ECHO

// Use board-defined LED pin when available, else fallback to GPIO2.
#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif
static const uint8_t LED_PIN = LED_BUILTIN;

// ===============================
// Measurement / App Constants
// ===============================
static const float MAX_DISTANCE_CM = 30.0f;          // Empty-bin reference distance
static const uint32_t POST_INTERVAL_MS = 30000UL;    // Send every 30 seconds
static const uint32_t WIFI_RETRY_INTERVAL_MS = 5000; // Reconnect attempt interval

// ===============================
// Runtime State
// ===============================
uint32_t lastPostMs = 0;
uint32_t lastWifiAttemptMs = 0;

// -------------------------------
// LED helpers
// -------------------------------
void ledOff() {
  digitalWrite(LED_PIN, LOW);
}

void blinkSuccess() {
  // Single short blink for successful POST
  digitalWrite(LED_PIN, HIGH);
  delay(120);
  digitalWrite(LED_PIN, LOW);
}

void blinkHttpError() {
  // Fast blink pattern for HTTP error
  for (int i = 0; i < 6; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(70);
    digitalWrite(LED_PIN, LOW);
    delay(70);
  }
}

// -------------------------------
// Wi-Fi management
// -------------------------------
void connectWiFi() {
  Serial.printf("[WiFi] Connecting to SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  const uint32_t now = millis();
  if (now - lastWifiAttemptMs >= WIFI_RETRY_INTERVAL_MS) {
    lastWifiAttemptMs = now;

    Serial.println("[WiFi] Disconnected. Attempting reconnect...");
    WiFi.disconnect();
    WiFi.reconnect();

    // If reconnect is not enough on some APs, begin again.
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }
}

// -------------------------------
// Time helper
// -------------------------------
void setupTimeSync() {
  // Configure SNTP for epoch time retrieval
  configTime(0, 0, NTP_SERVER);
}

unsigned long long getEpochMs() {
  // Returns Unix epoch in milliseconds when SNTP time is available.
  // If time is not synced yet, falls back to millis() to avoid empty timestamp.
  struct timeval tv;
  if (gettimeofday(&tv, nullptr) == 0 && tv.tv_sec > 1700000000) {
    return (static_cast<unsigned long long>(tv.tv_sec) * 1000ULL) +
           (static_cast<unsigned long long>(tv.tv_usec) / 1000ULL);
  }

  return static_cast<unsigned long long>(millis());
}

// -------------------------------
// HC-SR04 measurement
// -------------------------------
float readDistanceCm() {
  // Ensure clean pulse
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  // Send 10us trigger pulse
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Read echo pulse width (timeout ~30ms => ~5m max)
  unsigned long durationUs = pulseIn(ECHO_PIN, HIGH, 30000UL);

  if (durationUs == 0) {
    // Timeout/no echo
    return NAN;
  }

  // HC-SR04 distance formula: distance(cm) = duration(us) * 0.0343 / 2
  return (durationUs * 0.0343f) / 2.0f;
}

float computeFillPercentage(float measuredCm) {
  // fill% = ((MAX_DISTANCE - measured_cm) / MAX_DISTANCE) * 100
  float fill = ((MAX_DISTANCE_CM - measuredCm) / MAX_DISTANCE_CM) * 100.0f;

  // Clamp to [0, 100]
  if (fill < 0.0f) fill = 0.0f;
  if (fill > 100.0f) fill = 100.0f;

  return fill;
}

// -------------------------------
// HTTP POST sender
// -------------------------------
bool postSensorData(float fillLevel) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Skipped POST: Wi-Fi not connected.");
    return false;
  }

  HTTPClient http;
  String url = String("http://") + SERVER_IP + "/api/sensor-data";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  const unsigned long long ts = getEpochMs();

  char payload[192];
  snprintf(
      payload,
      sizeof(payload),
      "{\"bin_id\":\"%s\",\"fill_level\":%.2f,\"timestamp\":%llu}",
      BIN_ID,
      fillLevel,
      ts);

  Serial.println("[HTTP] POST " + url);
  Serial.println(String("[HTTP] Payload: ") + payload);

  int httpCode = http.POST(payload);

  if (httpCode > 0 && httpCode >= 200 && httpCode < 300) {
    Serial.printf("[HTTP] Success. Code: %d\n", httpCode);
    http.end();
    return true;
  }

  Serial.printf("[HTTP] Error. Code: %d\n", httpCode);
  if (httpCode > 0) {
    Serial.println("[HTTP] Response: " + http.getString());
  }

  http.end();
  return false;
}

void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(LED_PIN, OUTPUT);
  ledOff();

  connectWiFi();
  setupTimeSync();

  Serial.println("[System] ESP32 bin monitor started.");
}

void loop() {
  ensureWiFiConnected();

  const uint32_t now = millis();
  if (now - lastPostMs >= POST_INTERVAL_MS) {
    lastPostMs = now;

    float distanceCm = readDistanceCm();
    if (isnan(distanceCm)) {
      Serial.println("[Sensor] No echo received. Skipping this cycle.");
      blinkHttpError();
      return;
    }

    float fillLevel = computeFillPercentage(distanceCm);

    Serial.printf("[Sensor] Distance: %.2f cm | Fill: %.2f%%\n", distanceCm, fillLevel);

    bool ok = postSensorData(fillLevel);
    if (ok) {
      blinkSuccess();
    } else {
      blinkHttpError();
    }
  }
}
