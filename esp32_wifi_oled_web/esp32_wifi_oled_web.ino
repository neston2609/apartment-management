#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <U8g2lib.h>

const char *WIFI_SSID = "NESTON-WIFI";
const char *WIFI_PASSWORD = "4109650731";

IPAddress LOCAL_IP(192, 168, 30, 19);
IPAddress GATEWAY(192, 168, 30, 1);
IPAddress SUBNET(255, 255, 255, 0);
IPAddress DNS1(8, 8, 8, 8);
IPAddress DNS2(1, 1, 1, 1);

WebServer server(80);
U8G2_SSD1306_128X64_NONAME_F_HW_I2C oledSsd1306(U8G2_R0, U8X8_PIN_NONE);
U8G2_SH1106_128X64_NONAME_F_HW_I2C oledSh1106(U8G2_R0, U8X8_PIN_NONE);
U8G2 *activeOled = &oledSsd1306;
#define oled (*activeOled)

const int HELTEC_VEXT_PIN = 21; // Active LOW OLED/external power on many Heltec LoRa boards.

struct OledPins {
  int sda;
  int scl;
  int rst;
  const char *name;
};

const OledPins OLED_PIN_CANDIDATES[] = {
  {4, 15, 16, "Heltec WiFi LoRa 32/V2"},
  {17, 18, 21, "Heltec WiFi LoRa 32/V3"},
  {21, 22, 16, "Generic ESP32 OLED"}
};

bool oledReady = false;
String oledPinName = "";
String oledDriverName = "SSD1306";
String lastMessage = "Ready";
uint8_t oledAddress = 0x3C;
bool allPixelsDiagnostic = true;
bool diagnosticDisplayIsWhite = true;
uint8_t oledSweepIndex = 0;
unsigned long oledSweepChangedAt = 0;
unsigned long lastDriverSwapAt = 0;
bool useSh1106Driver = false;

void enableHeltecOledPower() {
  pinMode(HELTEC_VEXT_PIN, OUTPUT);
  digitalWrite(HELTEC_VEXT_PIN, LOW);
  delay(100);
}

void resetOledPin(int rstPin) {
  if (rstPin < 0) {
    return;
  }
  pinMode(rstPin, OUTPUT);
  digitalWrite(rstPin, LOW);
  delay(30);
  digitalWrite(rstPin, HIGH);
  delay(30);
}

bool i2cDevicePresent(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void setupActiveOled(uint8_t address, bool useSh1106) {
  oledAddress = address;
  activeOled = useSh1106 ? static_cast<U8G2 *>(&oledSh1106) : static_cast<U8G2 *>(&oledSsd1306);
  oledDriverName = useSh1106 ? "SH1106" : "SSD1306";
  oled.setI2CAddress(address * 2);
  oled.begin();
  oled.enableUTF8Print();
  oled.setPowerSave(0);
  oled.setContrast(255);
}

void sendOledCommand(uint8_t command) {
  Wire.beginTransmission(oledAddress);
  Wire.write(0x00);
  Wire.write(command);
  Wire.endTransmission();
}

void showAllPixelsOn() {
  if (!oledReady) {
    return;
  }
  sendOledCommand(0xAE); // Display off while changing the test mode.
  sendOledCommand(0xA5); // Entire display ON, independent of RAM/font data.
  sendOledCommand(0xAF); // Display on.
}

void sendRawOledCommand(uint8_t address, uint8_t command) {
  Wire.beginTransmission(address);
  Wire.write(0x00);
  Wire.write(command);
  Wire.endTransmission();
}

void activateOledSweepCandidate(uint8_t index) {
  const OledPins &pins = OLED_PIN_CANDIDATES[index];

  if (index == 0) {
    enableHeltecOledPower();
  }

  resetOledPin(pins.rst);
  Wire.end();
  Wire.begin(pins.sda, pins.scl);
  Wire.setClock(100000);

  Serial.print("OLED sweep ");
  Serial.print(index + 1);
  Serial.print(": ");
  Serial.println(pins.name);
}

void showRawAllPixelsOn() {
  for (uint8_t address : {0x3C, 0x3D}) {
    sendRawOledCommand(address, 0xAE);
    sendRawOledCommand(address, 0xA5);
    sendRawOledCommand(address, 0xAF);
  }
}

void showRawAllPixelsOff() {
  for (uint8_t address : {0x3C, 0x3D}) {
    sendRawOledCommand(address, 0xAE);
  }
}

bool initOled() {
  for (const auto &pins : OLED_PIN_CANDIDATES) {
    enableHeltecOledPower();
    resetOledPin(pins.rst);
    Wire.end();
    Wire.begin(pins.sda, pins.scl);
    Wire.setClock(400000);

    bool found3c = i2cDevicePresent(0x3C);
    bool found3d = i2cDevicePresent(0x3D);
    if (!found3c && !found3d) {
      continue;
    }

    setupActiveOled(found3d ? 0x3D : 0x3C, true);
    oledReady = true;
    oledPinName = pins.name;
    return true;
  }

  return false;
}

String htmlEscape(const String &value) {
  String escaped;
  escaped.reserve(value.length() + 16);
  for (size_t i = 0; i < value.length(); i++) {
    char c = value[i];
    switch (c) {
      case '&': escaped += F("&amp;"); break;
      case '<': escaped += F("&lt;"); break;
      case '>': escaped += F("&gt;"); break;
      case '"': escaped += F("&quot;"); break;
      case '\'': escaped += F("&#39;"); break;
      default: escaped += c; break;
    }
  }
  return escaped;
}

size_t utf8CharLen(const String &text, size_t index) {
  uint8_t c = static_cast<uint8_t>(text[index]);
  if ((c & 0x80) == 0) return 1;
  if ((c & 0xE0) == 0xC0) return 2;
  if ((c & 0xF0) == 0xE0) return 3;
  if ((c & 0xF8) == 0xF0) return 4;
  return 1;
}

void drawWrappedUtf8(const String &text, int x, int y, int maxWidth, int lineHeight, int maxLines) {
  String line;
  int linesDrawn = 0;

  for (size_t i = 0; i < text.length() && linesDrawn < maxLines;) {
    size_t len = utf8CharLen(text, i);
    String next = text.substring(i, min(i + len, text.length()));

    if (next == "\r") {
      i += len;
      continue;
    }

    if (next == "\n") {
      oled.drawUTF8(x, y + (linesDrawn * lineHeight), line.c_str());
      line = "";
      linesDrawn++;
      i += len;
      continue;
    }

    String candidate = line + next;
    if (line.length() > 0 && oled.getUTF8Width(candidate.c_str()) > maxWidth) {
      oled.drawUTF8(x, y + (linesDrawn * lineHeight), line.c_str());
      line = next;
      linesDrawn++;
    } else {
      line = candidate;
    }

    i += len;
  }

  if (line.length() > 0 && linesDrawn < maxLines) {
    oled.drawUTF8(x, y + (linesDrawn * lineHeight), line.c_str());
  }
}

void showStatus(const String &line1, const String &line2 = "", const String &line3 = "", const String &line4 = "") {
  if (!oledReady) {
    return;
  }

  oled.clearBuffer();
  oled.drawFrame(0, 0, 128, 64);
  oled.setFont(u8g2_font_6x10_tf);
  oled.drawStr(3, 11, line1.c_str());
  if (line2.length()) oled.drawStr(3, 26, line2.c_str());
  if (line3.length()) oled.drawStr(3, 41, line3.c_str());
  if (line4.length()) oled.drawStr(3, 56, line4.c_str());
  oled.sendBuffer();
}

void showMessageOnOled() {
  if (!oledReady) {
    return;
  }

  oled.clearBuffer();
  oled.drawFrame(0, 0, 128, 64);
  oled.drawBox(0, 0, 128, 14);
  oled.setDrawColor(0);
  oled.setFont(u8g2_font_6x10_tf);
  String header = "MSG " + oledDriverName;
  oled.drawStr(4, 11, header.c_str());
  oled.setDrawColor(1);

  oled.setFont(u8g2_font_etl14thai_t);
  drawWrappedUtf8(lastMessage, 4, 31, 120, 15, 3);

  oled.setFont(u8g2_font_5x8_tf);
  oled.drawStr(4, 61, WiFi.localIP().toString().c_str());
  oled.sendBuffer();
}

void swapOledDriverForDiagnostic() {
  if (!oledReady || millis() - lastDriverSwapAt < 3000) {
    return;
  }

  lastDriverSwapAt = millis();
  useSh1106Driver = !useSh1106Driver;
  setupActiveOled(0x3C, useSh1106Driver);
  Serial.print("OLED diagnostic driver: ");
  Serial.println(oledDriverName);
  showMessageOnOled();
}

String pageHtml(const String &notice = "") {
  String safeMessage = htmlEscape(lastMessage);
  String safeNotice = htmlEscape(notice);

  String html = F("<!doctype html><html><head><meta charset='utf-8'>"
                  "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                  "<title>ESP32 Screen</title>"
                  "<style>"
                  "body{font-family:Arial,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;background:#f7f7f8;color:#111}"
                  "main{background:white;border:1px solid #ddd;border-radius:8px;padding:20px;box-shadow:0 2px 8px #0001}"
                  "input{box-sizing:border-box;width:100%;font-size:18px;padding:12px;margin:8px 0 14px;border:1px solid #bbb;border-radius:6px}"
                  "button{font-size:18px;padding:10px 18px;border:0;border-radius:6px;background:#2563eb;color:white;cursor:pointer}"
                  "p{line-height:1.45}.notice{color:#166534;font-weight:700}.current{background:#f3f4f6;padding:10px;border-radius:6px;word-break:break-word}"
                  "</style></head><body><main>"
                  "<h1>ESP32 Screen Text</h1>");

  if (safeNotice.length()) {
    html += "<p class='notice'>" + safeNotice + "</p>";
  }

  html += F("<form method='POST' action='/submit'>"
            "<label for='msg'>Text to show on device screen</label>"
            "<input id='msg' name='msg' maxlength='200' autofocus>"
            "<button type='submit'>Submit</button>"
            "</form><p>Current screen text:</p><p class='current'>");
  html += safeMessage;
  html += F("</p></main></body></html>");
  return html;
}

void handleRoot() {
  server.send(200, "text/html; charset=utf-8", pageHtml());
}

void handleSubmit() {
  String msg = server.arg("msg");
  msg.trim();
  if (msg.length() == 0) {
    msg = "(empty)";
  }
  if (msg.length() > 200) {
    msg = msg.substring(0, 200);
  }

  lastMessage = msg;
  Serial.print("Submit received: ");
  Serial.println(lastMessage);
  showMessageOnOled();
  server.send(200, "text/html; charset=utf-8", pageHtml("Text sent to device screen."));
}

void handleNotFound() {
  server.sendHeader("Location", "/", true);
  server.send(302, "text/plain", "");
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  if (!WiFi.config(LOCAL_IP, GATEWAY, SUBNET, DNS1, DNS2)) {
    Serial.println("WiFi.config failed");
    showStatus("Static IP failed", "Check network");
  }

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  showStatus("Connecting WiFi", WIFI_SSID);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 30000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Connected. IP: ");
    Serial.println(WiFi.localIP());
    showStatus("WiFi connected", WiFi.localIP().toString(), "Open browser:", "192.168.30.19");
  } else {
    Serial.println("WiFi connection failed");
    showStatus("WiFi failed", "SSID/password?", "Restart to retry");
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("ESP32 WiFi OLED Web Text");

  enableHeltecOledPower();

  if (initOled()) {
    Serial.print("OLED found: ");
    Serial.println(oledPinName);
    showStatus("OLED ready", oledPinName);
    showAllPixelsOn();
  } else {
    Serial.println("OLED not found. Web server will still run.");
  }

  connectWifi();

  activateOledSweepCandidate(oledSweepIndex);
  showRawAllPixelsOn();
  oledSweepChangedAt = millis();

  server.on("/", HTTP_GET, handleRoot);
  server.on("/submit", HTTP_POST, handleSubmit);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("HTTP server started");

  if (WiFi.status() == WL_CONNECTED) {
    delay(1500);
    showMessageOnOled();
  }
}

void loop() {
  server.handleClient();

  if (allPixelsDiagnostic && diagnosticDisplayIsWhite && millis() - oledSweepChangedAt > 4000) {
    diagnosticDisplayIsWhite = false;
    oledSweepChangedAt = millis();
    showRawAllPixelsOff();
  } else if (allPixelsDiagnostic && !diagnosticDisplayIsWhite && millis() - oledSweepChangedAt > 1000) {
    diagnosticDisplayIsWhite = true;
    oledSweepIndex = (oledSweepIndex + 1) % (sizeof(OLED_PIN_CANDIDATES) / sizeof(OLED_PIN_CANDIDATES[0]));
    activateOledSweepCandidate(oledSweepIndex);
    oledSweepChangedAt = millis();
    showRawAllPixelsOn();
  }

  static unsigned long lastReconnectAttempt = 0;
  if (WiFi.status() != WL_CONNECTED && millis() - lastReconnectAttempt > 10000) {
    lastReconnectAttempt = millis();
    Serial.println("WiFi disconnected; reconnecting...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }

}
