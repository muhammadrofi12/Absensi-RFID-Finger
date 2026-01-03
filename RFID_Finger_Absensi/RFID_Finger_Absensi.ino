#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <HardwareSerial.h>
#include <Adafruit_Fingerprint.h>

// ===============================================================
// MODULE CONFIG
// ===============================================================
#define SDA_PIN 21
#define RST_PIN 22
MFRC522 rfid(SDA_PIN, RST_PIN);

LiquidCrystal_I2C lcd(0x27, 16, 2);

#define FP_RX 16
#define FP_TX 17
HardwareSerial FingerSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&FingerSerial);

// ===============================================================
// WIFI CONFIG
// ===============================================================
// SSID & password sesuai WiFi / hotspot yang sama dengan laptop
const char* ssid     = "Rofi";
const char* password = "rofi123456789";

// IP laptop (server Node.js) di jaringan yang sama
const char* API_HOST = "10.95.236.237"; // 192.168.0.102
const int   API_PORT = 5000;

// ===============================================================
// GLOBAL STATE
// ===============================================================
// TRUE → sedang nunggu fingerprint untuk ENROLL (kalau mau dipakai)
// (saat ini belum dipakai, tapi disiapkan kalau nanti perlu)
bool waitingFpEnroll = false;

// TRUE → sedang nunggu fingerprint untuk VERIFIKASI (2FA attendance)
bool waitingFpVerify = false;

// RFID terakhir yang berhasil discan (untuk pairing dengan fingerprint)
String currentRFID = "";

// ===============================================================
// HELPER: RESET STATE
// ===============================================================
void resetState() {
  waitingFpEnroll = false;
  waitingFpVerify = false;
  currentRFID = "";
  lcd.clear();
  lcd.print("Scan RFID/FP");
}

// ===============================================================
// WIFI CONNECT
// ===============================================================
void connectWiFi() {
  lcd.clear();
  lcd.print("Connecting WiFi");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");
  lcd.clear();
  lcd.print("WiFi Connected");
  delay(800);
  lcd.clear();
  lcd.print("Scan RFID/FP");
}

// ===============================================================
// HTTP POST JSON
// ===============================================================
bool httpPost(const String& path, const String& body, String& resp) {
  WiFiClient client;

  if (!client.connect(API_HOST, API_PORT)) {
    Serial.println("❌ API Connect Failed");
    return false;
  }

  String req =
    "POST " + path + " HTTP/1.1\r\n"
    "Host: " + String(API_HOST) + ":" + API_PORT + "\r\n"
    "Content-Type: application/json\r\n"
    "Connection: close\r\n"
    "Content-Length: " + String(body.length()) + "\r\n\r\n" +
    body;

  client.print(req);

  unsigned long start = millis();
  while (!client.available()) {
    if (millis() - start > 6000) {
      Serial.println("❌ Timeout");
      client.stop();
      return false;
    }
    delay(5);
  }

  String full = "";
  while (client.available()) full += client.readString();

  client.stop();

  int idx = full.indexOf("\r\n\r\n");
  resp = (idx != -1) ? full.substring(idx + 4) : full;

  Serial.println("=== API RESP ===");
  Serial.println(resp);
  Serial.println("================");

  return full.startsWith("HTTP/1.1 200") || full.startsWith("HTTP/1.1 201");
}

// ===============================================================
// SEND RFID → API (Register or Attendance)
// ===============================================================
void sendRFID(const String& uid) {
  String body = "{\"rfidId\":\"" + uid + "\"}";
  String resp;

  if (!httpPost("/api/esp/scan", body, resp)) {
    lcd.clear();
    lcd.print("API Error RFID");
    delay(1500);
    resetState();
    return;
  }

  // setiap kali scan RFID baru → reset state fingerprint
  currentRFID = uid;
  waitingFpEnroll = false;
  waitingFpVerify = false;

  // --- CASE 1: RFID siap untuk pendaftaran (enroll) ---
  // --- CASE: RFID untuk pendaftaran karyawan ---
if (resp.indexOf("REGISTER_OK") >= 0) {
  lcd.clear();
  lcd.print("RFID Ready");
  Serial.println("RFID accepted for registration.");
  delay(1200);
  resetState();
  return;
}

  if (resp.indexOf("UNKNOWN_CARD") >= 0) {
    lcd.clear();
    lcd.print("Kartu Ditolak");
    delay(1500);
    resetState();
    return;
}

  // --- CASE 2: Attendance tapi butuh fingerprint (2FA) ---
  if (resp.indexOf("NEED_FINGERPRINT") >= 0) {
    waitingFpVerify = true;
    lcd.clear();
    lcd.print("Tempel Finger");
    Serial.println("Menunggu fingerprint untuk 2FA...");
    return;
  }

  // --- CASE 3: Attendance OK tanpa fingerprint ---
  if (resp.indexOf("Attendance OK") >= 0) {
    lcd.clear();
    lcd.print("Absensi OK");
    delay(1200);
    resetState();
    return;
  }

  // --- CASE 4: User tidak ditemukan ---
  if (resp.indexOf("User not found") >= 0) {
    lcd.clear();
    lcd.print("Not Registered");
    delay(1200);
    resetState();
    return;
  }

  // --- CASE 5: Respon lain yang tidak dikenali ---
  lcd.clear();
  lcd.print("Unknown API");
  delay(1200);
  resetState();
}

// ===============================================================
// SEND FINGERPRINT → API (ENROLL)
// ===============================================================
void sendFingerprintEnroll(int fpId) {
  String resp;
  String body = "{\"fingerId\":" + String(fpId) + "}";
  // kalau backend butuh RFID juga:
  // String body = "{\"rfidId\":\"" + currentRFID + "\",\"fingerId\":" + String(fpId) + "}";

  if (!httpPost("/api/esp/fp-enrolled", body, resp)) {
    lcd.clear();
    lcd.print("Enroll Err");
    delay(1200);
    resetState();
    return;
  }

  lcd.clear();
  lcd.print("FP Enrolled");
  delay(1500);
  resetState();
}

// ===============================================================
// SEND FINGERPRINT → API (VERIFIKASI 2FA ABSENSI)
// ===============================================================
void sendFingerprintVerify(int fpId) {
  if (currentRFID == "") {
    // safety: fingerprint kebaca tapi belum ada RFID
    lcd.clear();
    lcd.print("Scan RFID dulu");
    delay(1200);
    resetState();
    return;
  }

  String resp;
  String body = "{\"rfidId\":\"" + currentRFID + "\",\"fingerId\":" + String(fpId) + "}";

  if (!httpPost("/api/esp/scan-fp", body, resp)) {
    lcd.clear();
    lcd.print("FP Err API");
    delay(1200);
    // tetap nunggu fingerprint lagi
    waitingFpVerify = true;
    lcd.clear();
    lcd.print("Coba lagi FP");
    return;
  }

  if (resp.indexOf("MATCH") >= 0) {
    lcd.clear();
    lcd.print("Absensi OK");
    Serial.println("Fingerprint MATCH, absensi berhasil.");
    delay(1500);
    resetState();
  } else if (resp.indexOf("MISMATCH") >= 0) {
    lcd.clear();
    lcd.print("FP Salah");
    Serial.println("Fingerprint MISMATCH.");
    delay(1500);
    // tetap nunggu fingerprint untuk coba lagi
    waitingFpVerify = true;
    lcd.clear();
    lcd.print("Tempel Finger");
  } else {
    lcd.clear();
    lcd.print("Resp Unknown");
    Serial.println("Response fingerprint tidak dikenali.");
    delay(1500);
    resetState();
  }
}

// ===============================================================
// SETUP
// ===============================================================
void setup() {
  Serial.begin(115200);

  Wire.begin(4, 5);      // SDA, SCL untuk LCD I2C (sesuai wiring kamu)
  lcd.init();
  lcd.backlight();

  SPI.begin();
  rfid.PCD_Init();

  FingerSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  finger.begin(57600);

  lcd.print("Init Modules");
  delay(800);

  connectWiFi();
  resetState();
}

// ===============================================================
// MAIN LOOP
// ===============================================================
void loop() {
  // pastikan WiFi tetap nyambung
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // ===========================================================
  // FINGERPRINT HANDLING (ENROLL atau VERIFIKASI)
  // ===========================================================
  if (waitingFpEnroll || waitingFpVerify) {
    uint8_t fp = finger.getImage();

    if (fp == FINGERPRINT_OK) {
      finger.image2Tz();
      int searchResult = finger.fingerFastSearch();

      if (searchResult >= 0) {
        int foundId = finger.fingerID;
        Serial.print("Fingerprint ID: ");
        Serial.println(foundId);

        if (waitingFpEnroll) {
          sendFingerprintEnroll(foundId);
        } else if (waitingFpVerify) {
          // 2FA attendance
          waitingFpVerify = false;  // status lanjut di-handle di sendFingerprintVerify
          sendFingerprintVerify(foundId);
        }

      } else {
        lcd.clear();
        lcd.print("FP Not Found");
        Serial.println("Fingerprint tidak ditemukan di sensor.");
        delay(1000);
        lcd.clear();
        lcd.print("Tempel Finger");
      }
    }
  }

  // ===========================================================
  // RFID SCAN
  // ===========================================================
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {

    // Jangan terima RFID baru kalau sedang nunggu fingerprint
    if (waitingFpEnroll || waitingFpVerify) return;

    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      uid += String(rfid.uid.uidByte[i], HEX);
    }

    uid.toUpperCase();

    Serial.print("RFID: ");
    Serial.println(uid);

    sendRFID(uid);

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }
}
