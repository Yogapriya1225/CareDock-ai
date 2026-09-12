/*
  CareDock AI - Smart Medicine Box Firmware
  Board: ESP32 WROOM

  Sensors / Actuators:
    - HX711 + 1kg Load Cell -> detects weight drop when medicine is removed
    - DS3231 RTC            -> accurate timestamps, works offline too
    - OLED Display (SSD1306, I2C) -> shows reminders / status messages
    - Buzzer                -> audible reminders / SOS alert
    - Green / Yellow / Red LEDs -> visual status (ok / reminder / alert)
    - Push Button ("Medicine Taken") -> patient confirms dose taken
    - SOS Button             -> emergency alert
    - PIR Motion Sensor      -> detects patient activity in the room

  Behaviour:
    1. Every LOOP_INTERVAL_MS, read all sensors and POST a JSON payload to
       the FastAPI backend's /api/esp32/ingest endpoint.
    2. Immediately POST on button press / SOS / significant weight change,
       instead of waiting for the next scheduled interval.
    3. Apply the backend's response (buzzer / LED / OLED message) so the
       hardware reflects the server's decision (which factors in ML models).

  Wiring (adjust pins to your build):
    HX711:      DT -> GPIO 4,  SCK -> GPIO 5
    DS3231:     SDA -> GPIO 21, SCL -> GPIO 22 (shared I2C bus with OLED)
    OLED:       SDA -> GPIO 21, SCL -> GPIO 22
    Buzzer:     GPIO 25
    Green LED:  GPIO 26
    Yellow LED: GPIO 27
    Red LED:    GPIO 14
    Taken Btn:  GPIO 32 (INPUT_PULLUP, active LOW)
    SOS Btn:    GPIO 33 (INPUT_PULLUP, active LOW)
    PIR:        GPIO 13
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <HX711.h>
#include <RTClib.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>

// ---------------- USER CONFIG ----------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BACKEND_URL   = "http://192.168.1.100:8000/api/esp32/ingest"; // FastAPI server IP
const char* DEVICE_ID     = "caredock-box-001";       // must match Patient.device_id in DB
const char* DEVICE_SECRET = "change_this_device_secret"; // must match ESP32_SHARED_SECRET in .env

const unsigned long LOOP_INTERVAL_MS = 8000; // routine polling interval

// ---------------- PIN CONFIG ----------------
#define HX711_DT   4
#define HX711_SCK  5
#define BUZZER_PIN 25
#define LED_GREEN  26
#define LED_YELLOW 27
#define LED_RED    14
#define BTN_TAKEN  32
#define BTN_SOS    33
#define PIR_PIN    13

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

HX711 scale;
RTC_DS3231 rtc;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

float lastWeight = 0.0;
unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BTN_TAKEN, INPUT_PULLUP);
  pinMode(BTN_SOS, INPUT_PULLUP);
  pinMode(PIR_PIN, INPUT);

  Wire.begin();
  scale.begin(HX711_DT, HX711_SCK);
  scale.set_scale(2280.f); // calibrate for your specific load cell
  scale.tare();

  if (!rtc.begin()) {
    Serial.println("RTC not found!");
  }

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found!");
  }
  showMessage("CareDock AI", "Starting up...");

  connectWiFi();
  setLED("green");
}

void loop() {
  bool takenPressed = (digitalRead(BTN_TAKEN) == LOW);
  bool sosPressed = (digitalRead(BTN_SOS) == LOW);
  bool motionDetected = (digitalRead(PIR_PIN) == HIGH);

  float currentWeight = scale.get_units(5);
  bool significantWeightChange = fabs(currentWeight - lastWeight) > 5.0; // grams threshold

  unsigned long now = millis();
  bool intervalElapsed = (now - lastSendTime) >= LOOP_INTERVAL_MS;

  if (takenPressed || sosPressed || significantWeightChange || intervalElapsed) {
    sendReading(currentWeight, takenPressed, motionDetected, sosPressed);
    lastWeight = currentWeight;
    lastSendTime = now;
    delay(300); // simple debounce after an event-triggered send
  }

  delay(200);
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  showMessage("CareDock AI", "Connecting WiFi...");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    showMessage("CareDock AI", "WiFi Connected");
  } else {
    showMessage("CareDock AI", "WiFi FAILED");
  }
}

void sendReading(float weight, bool takenBtn, bool motion, bool sos) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["device_secret"] = DEVICE_SECRET;
  doc["weight_grams"] = weight;
  doc["medicine_taken_button"] = takenBtn;
  doc["pir_motion"] = motion;
  doc["sos_pressed"] = sos;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode == 200) {
    String responseBody = http.getString();
    applyServerResponse(responseBody);
  } else {
    Serial.printf("POST failed, code: %d\n", httpResponseCode);
    showMessage("Connection Error", "Retrying soon...");
  }

  http.end();
}

void applyServerResponse(const String& body) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.println("Failed to parse server response");
    return;
  }

  bool buzzerOn = doc["buzzer"] | false;
  const char* ledColor = doc["led_color"] | "green";
  const char* oledMessage = doc["oled_message"] | "All good";

  setLED(ledColor);
  showMessage("CareDock AI", oledMessage);

  if (buzzerOn) {
    tone(BUZZER_PIN, 2000, 700);
  }
}

void setLED(const String& color) {
  digitalWrite(LED_GREEN, color == "green" ? HIGH : LOW);
  digitalWrite(LED_YELLOW, color == "yellow" ? HIGH : LOW);
  digitalWrite(LED_RED, color == "red" ? HIGH : LOW);
}

void showMessage(const String& title, const String& message) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(title);
  display.println("--------------------");
  display.setCursor(0, 20);
  display.println(message);
  display.display();
}
