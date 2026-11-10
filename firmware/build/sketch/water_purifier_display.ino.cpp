#line 1 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <MCUFRIEND_kbv.h>
#include <stdlib.h>
#include <string.h>

MCUFRIEND_kbv tft;

// ======================================
// TFT COLORS
// ======================================

#define BLACK   0x0000
#define WHITE   0xFFFF
#define GREEN   0x07E0
#define RED     0xF800
#define YELLOW  0xFFE0
#define CYAN    0x07FF
#define ORANGE  0xFD20
#define NAVY    0x0010
#define BACKGROUND 0x0843
#define PANEL      0x10C5
#define BORDER     0x2A8B
#define MUTED      0x9D16
#define HEADER     0x1168

// ======================================
// SERIAL SETTINGS
// ======================================

#define SERIAL_BAUD 9600

char rxBuffer[112];
uint8_t rxIndex = 0;

// ======================================
// SENSOR VALUES
// ======================================

float hotTemp = -127;
float coldTemp = -127;

int hotLevel = 0;
int coldLevel = 0;

// ======================================
// FOUR RELAY CHANNELS
// ======================================

int relay1hot = 0;
int relay2cold = 0;
int relay3 = 0;
int relay4 = 0;

int buzzer = 0;

// ======================================
// COMMUNICATION VARIABLES
// ======================================

bool dataReceived = false;
bool fourRelayData = false;
bool valuesVisible = false;

unsigned long lastPacketTime = 0;

const unsigned long DATA_TIMEOUT = 5000;

// Fixed 320 x 240 landscape layout. Only changed value areas are repainted.
const int SENSOR_X = 8;
const int STATE_X = 198;
const int SENSOR_W = 182;
const int STATE_W = 114;
const int CARD_H = 40;

#line 77 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void drawCard(int x, int y, int width, const __FlashStringHelper *label, uint16_t accent);
#line 87 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void clearValue(int x, int y, int width);
#line 93 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void drawTemperature(int y, float value, uint16_t color, bool valid);
#line 104 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void drawLevel(int y, int value, bool valid);
#line 126 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void drawState(int y, int value, bool valid);
#line 138 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void drawConnection(bool valid);
#line 155 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void updateTFT(bool valid);
#line 181 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void parsePacket(char *line);
#line 289 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void receiveSerialData();
#line 322 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void initializeTFT();
#line 376 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void setup();
#line 398 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void loop();
#line 77 "C:\\Users\\USER\\Downloads\\ks5615\\ks5615\\firmware\\water_purifier_display\\water_purifier_display.ino"
void drawCard(int x, int y, int width, const __FlashStringHelper *label, uint16_t accent) {
  tft.fillRoundRect(x, y, width, CARD_H, 5, PANEL);
  tft.drawRoundRect(x, y, width, CARD_H, 5, BORDER);
  tft.drawFastVLine(x + 1, y + 8, CARD_H - 16, accent);
  tft.setTextSize(1);
  tft.setTextColor(MUTED, PANEL);
  tft.setCursor(x + 9, y + 5);
  tft.print(label);
}

void clearValue(int x, int y, int width) {
  tft.fillRect(x + 5, y + 15, width - 10, 22, PANEL);
  tft.setTextSize(2);
  tft.setCursor(x + 9, y + 17);
}

void drawTemperature(int y, float value, uint16_t color, bool valid) {
  clearValue(SENSOR_X, y, SENSOR_W);
  tft.setTextColor(color, PANEL);
  if (!valid) tft.print(F("--"));
  else if (value < -55 || value > 125) tft.print(F("ERROR"));
  else {
    tft.print(value, 1);
    tft.print(F(" C"));
  }
}

void drawLevel(int y, int value, bool valid) {
  clearValue(SENSOR_X, y, SENSOR_W);
  uint16_t color = !valid ? MUTED : value > 3500 ? RED : value < 500 ? ORANGE : CYAN;
  tft.setTextColor(color, PANEL);
  if (!valid) tft.print(F("--"));
  else tft.print(value);

  const int barX = SENSOR_X + 91;
  tft.drawRoundRect(barX, y + 17, 80, 8, 2, BORDER);
  if (valid) {
    int fill = (int)(constrain((long)value, 0L, 3000L) * 76L / 3000L);
    if (fill > 0) tft.fillRect(barX + 2, y + 19, fill, 4, color);
  }
  tft.setTextSize(1);
  tft.setCursor(barX, y + 28);
  if (!valid) tft.print(F("NO DATA"));
  else if (value > 3500) tft.print(F("OVERFLOW"));
  else if (value < 500) tft.print(F("LOW WATER"));
  else if (value >= 3000) tft.print(F("FULL"));
  else tft.print(F("NORMAL"));
}

void drawState(int y, int value, bool valid) {
  clearValue(STATE_X, y, STATE_W);
  uint16_t color = !valid ? MUTED : value == 1 ? GREEN : ORANGE;
  tft.drawRoundRect(STATE_X + 8, y + 15, STATE_W - 16, 22, 4, color);
  tft.setTextSize(2);
  tft.setTextColor(color, PANEL);
  tft.setCursor(STATE_X + (valid && value != 1 ? 39 : 45), y + 18);
  if (!valid) tft.print(F("--"));
  else if (value == 1) tft.print(F("ON"));
  else tft.print(F("OFF"));
}

void drawConnection(bool valid) {
  tft.fillRect(254, 9, 54, 25, HEADER);
  tft.fillCircle(261, 20, 3, valid ? GREEN : YELLOW);
  tft.setTextSize(1);
  tft.setTextColor(valid ? GREEN : YELLOW, HEADER);
  tft.setCursor(270, 17);
  if (valid) tft.print(F("LIVE"));
  else tft.print(F("WAIT"));
  tft.fillRect(9, 221, 302, 12, BACKGROUND);
  tft.setTextColor(MUTED, BACKGROUND);
  tft.setCursor(12, 223);
  if (valid) tft.print(F("LIVE SENSOR DATA"));
  else tft.print(F("WAITING FOR DATA"));
  tft.setCursor(235, 223);
  tft.print(F("USB | 9600"));
}

void updateTFT(bool valid) {
  static bool drawn = false, previousValid = false, previousFour = false;
  static float previousHot = 0, previousCold = 0;
  static int previousHotLevel = 0, previousColdLevel = 0;
  static int previousRelay1 = 0, previousRelay3 = 0, previousRelay4 = 0, previousBuzzer = 0;
  bool refresh = !drawn || previousValid != valid;
  if (refresh) drawConnection(valid);
  if (refresh || hotTemp != previousHot) drawTemperature(48, hotTemp, ORANGE, valid);
  if (refresh || coldTemp != previousCold) drawTemperature(90, coldTemp, CYAN, valid);
  if (refresh || hotLevel != previousHotLevel) drawLevel(132, hotLevel, valid);
  if (refresh || coldLevel != previousColdLevel) drawLevel(174, coldLevel, valid);
  if (refresh || relay1hot != previousRelay1) drawState(48, relay1hot, valid);
  if (refresh || previousFour != fourRelayData || relay3 != previousRelay3) drawState(90, relay3, valid && fourRelayData);
  if (refresh || previousFour != fourRelayData || relay4 != previousRelay4) drawState(132, relay4, valid && fourRelayData);
  if (refresh || buzzer != previousBuzzer) drawState(174, buzzer, valid);
  previousHot = hotTemp; previousCold = coldTemp;
  previousHotLevel = hotLevel; previousColdLevel = coldLevel;
  previousRelay1 = relay1hot; previousRelay3 = relay3; previousRelay4 = relay4;
  previousBuzzer = buzzer; previousValid = valid; previousFour = fourRelayData;
  drawn = true;
}

// ======================================
// RECEIVE AND PARSE SERIAL PACKET
// ======================================

void parsePacket(char *line) {

  float values[10];
  int count = 0;

  char *token = strtok(line, ",");

  while (token != NULL && count < 10) {

    char *endPtr;
    values[count] = strtod(token, &endPtr);

    if (endPtr == token || *endPtr != '\0') {
      Serial.println(F("Invalid serial value"));
      return;
    }

    count++;
    token = strtok(NULL, ",");
  }

  if (token != NULL ||
      (count != 8 &&
       count != 9 &&
       count != 10)) {

    Serial.println(F("Invalid packet length"));
    return;
  }

  // Shared sensor fields

  hotTemp = values[0];
  coldTemp = values[1];

  hotLevel = (int)values[2];
  coldLevel = (int)values[3];

  relay1hot = (int)values[4];
  relay2cold = (int)values[5];

  if (count == 8) {

    // Old packet format:
    // hot,cold,hotLevel,coldLevel,
    // relay1,relay2,buzzer,status

    fourRelayData = false;
    buzzer = (int)values[6];
  }
  else {

    // New packet format:
    // hot,cold,hotLevel,coldLevel,
    // relay1,relay2,relay3,relay4,buzzer
    //
    // Optional 10th field: status

    fourRelayData = true;

    relay3 = (int)values[6];
    relay4 = (int)values[7];
    buzzer = (int)values[8];
  }

  dataReceived = true;
  valuesVisible = true;
  lastPacketTime = millis();

  updateTFT(true);

  // Serial Monitor debugging

  Serial.println(F("=== DATA RECEIVED ==="));

  Serial.print(F("Hot Temp: "));
  Serial.println(hotTemp, 1);

  Serial.print(F("Cold Temp: "));
  Serial.println(coldTemp, 1);

  Serial.print(F("Hot Level: "));
  Serial.println(hotLevel);

  Serial.print(F("Cold Level: "));
  Serial.println(coldLevel);

  Serial.print(F("Relay 1: "));
  Serial.println(relay1hot);

  if (fourRelayData) {
    Serial.print(F("Relay 2 (relay3): "));
    Serial.println(relay3);

    Serial.print(F("Relay 3 (relay4): "));
    Serial.println(relay4);
  }

  Serial.print(F("Buzzer: "));
  Serial.println(buzzer);

  Serial.println(F("====================="));
}

// ======================================
// RECEIVE USB SERIAL DATA
// ======================================

void receiveSerialData() {

  while (Serial.available()) {

    char ch = (char)Serial.read();

    if (ch == '\n') {

      rxBuffer[rxIndex] = '\0';

      if (rxIndex > 0) {
        parsePacket(rxBuffer);
      }

      rxIndex = 0;
    }
    else if (ch != '\r') {

      if (rxIndex < sizeof(rxBuffer) - 1) {
        rxBuffer[rxIndex++] = ch;
      }
      else {
        rxIndex = 0;
        Serial.println(F("Serial buffer overflow"));
      }
    }
  }
}

// ======================================
// INITIALIZE TFT
// ======================================

void initializeTFT() {

  uint16_t controllerID = tft.readID();

  Serial.print(F("TFT Controller ID: 0x"));
  Serial.println(controllerID, HEX);

  if (controllerID == 0x0000 ||
      controllerID == 0xFFFF ||
      controllerID == 0xD3D3) {

    controllerID = 0x9341;
  }

  tft.begin(controllerID);
  tft.setRotation(1);

  tft.setTextWrap(false);
  tft.fillScreen(BACKGROUND);
  tft.drawRoundRect(2, 2, 316, 236, 8, CYAN);
  tft.drawRoundRect(4, 4, 312, 232, 7, BORDER);
  tft.fillRoundRect(8, 8, 304, 34, 5, HEADER);

  // Small water-drop emblem and title.
  tft.fillTriangle(17, 23, 23, 12, 29, 23, CYAN);
  tft.fillCircle(23, 24, 6, CYAN);
  tft.fillCircle(21, 23, 2, WHITE);
  tft.setTextSize(2);
  tft.setTextColor(WHITE, HEADER);
  tft.setCursor(38, 12);
  tft.print(F("WATER PURIFIER"));
  tft.setTextSize(1);
  tft.setTextColor(MUTED, HEADER);
  tft.setCursor(39, 30);
  tft.print(F("SMART WATER MONITOR"));

  drawCard(SENSOR_X, 48, SENSOR_W, F("HOT TEMPERATURE"), ORANGE);
  drawCard(SENSOR_X, 90, SENSOR_W, F("COLD TEMPERATURE"), CYAN);
  drawCard(SENSOR_X, 132, SENSOR_W, F("HOT WATER LEVEL"), ORANGE);
  drawCard(SENSOR_X, 174, SENSOR_W, F("COLD WATER LEVEL"), CYAN);
  // Physical relays 1, 3 and 4 keep the dashboard's display labels.
  drawCard(STATE_X, 48, STATE_W, F("RELAY 1"), CYAN);
  drawCard(STATE_X, 90, STATE_W, F("RELAY 2"), CYAN);
  drawCard(STATE_X, 132, STATE_W, F("RELAY 3"), CYAN);
  drawCard(STATE_X, 174, STATE_W, F("BUZZER"), YELLOW);
  tft.drawFastHLine(10, 218, 300, BORDER);

  updateTFT(false);
}

// ======================================
// SETUP
// ======================================

void setup() {

  Serial.begin(SERIAL_BAUD);
  delay(500);

  Serial.println();
  Serial.println(F("=========================="));
  Serial.println(F("KS5558 WATER PURIFIER"));
  Serial.println(F("ARDUINO UNO TFT DISPLAY"));
  Serial.println(F("USB SERIAL: 9600 BAUD"));
  Serial.println(F("=========================="));

  initializeTFT();

  Serial.println(F("TFT initialized"));
  Serial.println(F("Ready to receive data"));
}

// ======================================
// LOOP
// ======================================

void loop() {

  receiveSerialData();

  if (valuesVisible &&
      millis() - lastPacketTime >= DATA_TIMEOUT) {

    valuesVisible = false;
    updateTFT(false);
  }
}

