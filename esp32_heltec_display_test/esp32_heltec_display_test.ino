#include <heltec.h>

void setup() {
  // Parameters: DisplayEnable, LoRaEnable, SerialEnable, PABOOST, BAND.
  Heltec.begin(true, false, true, true, 433E6);

  Heltec.display->init();
  Heltec.display->flipScreenVertically();
  Heltec.display->setFont(ArialMT_Plain_10);

  pinMode(25, OUTPUT);
}

void loop() {
  Heltec.display->clear();
  Heltec.display->drawString(0, 0, "Heltec LoRa 32 V2");
  Heltec.display->drawString(0, 20, "Screen Test: OK");
  Heltec.display->display();

  digitalWrite(25, HIGH);
  delay(1000);
  digitalWrite(25, LOW);
  delay(1000);
}
