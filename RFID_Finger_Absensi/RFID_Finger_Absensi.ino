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
  lcd.setCursor(0, 1);
  lcd.print("Tempel Finger");
  
  // Set mode enroll fingerprint - JANGAN reset state!
  waitingFpEnroll = true;
  
  Serial.println("RFID accepted for registration. Waiting for fingerprint...");
  return;  // Jangan reset, tunggu fingerprint
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
  Serial.print("Sending fingerprint enroll, ID: ");
  Serial.println(fpId);
  
  String resp;
  String body = "{\"fingerId\":" + String(fpId) + "}";

  if (!httpPost("/api/esp/fp-enrolled", body, resp)) {
    lcd.clear();
    lcd.print("Enroll Err");
    lcd.setCursor(0, 1);
    lcd.print("Coba lagi");
    Serial.println("Failed to enroll fingerprint to server");
    delay(2000);
    resetState();
    return;
  }

  // Cek response status
  if (resp.indexOf("FP_SAVED") >= 0 || resp.indexOf("OK") >= 0) {
    lcd.clear();
    lcd.print("FP Enrolled!");
    lcd.setCursor(0, 1);
    lcd.print("ID: " + String(fpId));
    Serial.println("Fingerprint enrolled successfully: " + String(fpId));
    delay(2500);
  } else if (resp.indexOf("NO_PENDING") >= 0) {
    lcd.clear();
    lcd.print("Scan RFID dulu");
    Serial.println("No pending RFID registration");
    delay(2000);
  } else {
    lcd.clear();
    lcd.print("Enroll OK");
    lcd.setCursor(0, 1);
    lcd.print("ID: " + String(fpId));
    delay(2000);
  }
  
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

  // PENTING: Cek MISMATCH dulu sebelum MATCH karena "MISMATCH" mengandung "MATCH"!
  if (resp.indexOf("MISMATCH") >= 0) {
    lcd.clear();
    lcd.print("FP Tidak Cocok!");
    lcd.setCursor(0, 1);
    lcd.print("Coba lagi");
    Serial.println("Fingerprint MISMATCH - tidak cocok dengan employee!");
    delay(2000);
    // tetap nunggu fingerprint untuk coba lagi
    waitingFpVerify = true;
    lcd.clear();
    lcd.print("Tempel Finger");
  } else if (resp.indexOf("ALREADY") >= 0) {
    lcd.clear();
    lcd.print("Sudah Absen");
    lcd.setCursor(0, 1);
    lcd.print("Hari Ini");
    Serial.println("Sudah check-in dan check-out hari ini.");
    delay(2000);
    resetState();
  } else if (resp.indexOf("MATCH") >= 0) {
    // Cek apakah check-in atau check-out
    if (resp.indexOf("checkin") >= 0) {
      lcd.clear();
      lcd.print("Check-In OK");
      lcd.setCursor(0, 1);
      lcd.print("Selamat Datang!");
      Serial.println("Fingerprint MATCH - Check-in berhasil!");
    } else if (resp.indexOf("checkout") >= 0) {
      lcd.clear();
      lcd.print("Check-Out OK");
      lcd.setCursor(0, 1);
      lcd.print("Sampai Jumpa!");
      Serial.println("Fingerprint MATCH - Check-out berhasil!");
    } else {
      lcd.clear();
      lcd.print("Absensi OK");
      Serial.println("Fingerprint MATCH, absensi berhasil.");
    }
    delay(2000);
    resetState();
  } else {
    lcd.clear();
    lcd.print("Resp Unknown");
    lcd.setCursor(0, 1);
    lcd.print("Coba lagi");
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
      // Konversi image ke template
      uint8_t tz = finger.image2Tz();
      if (tz != FINGERPRINT_OK) {
        Serial.println("Error converting image to template");
        return;
      }
      
      // Cari fingerprint di database sensor
      uint8_t searchResult = finger.fingerFastSearch();
      
      Serial.print("Search result: ");
      Serial.println(searchResult);

      // PENTING: Harus cek dengan FINGERPRINT_OK, bukan >= 0
      if (searchResult == FINGERPRINT_OK) {
        int foundId = finger.fingerID;
        int confidence = finger.confidence;
        
        Serial.print("Fingerprint ID: ");
        Serial.print(foundId);
        Serial.print(" | Confidence: ");
        Serial.println(confidence);

        // Tampilkan info di LCD
        lcd.clear();
        lcd.print("FP ID: " + String(foundId));
        lcd.setCursor(0, 1);
        lcd.print("Conf: " + String(confidence));
        delay(800);

        if (waitingFpEnroll) {
          waitingFpEnroll = false;
          sendFingerprintEnroll(foundId);
        } else if (waitingFpVerify) {
          waitingFpVerify = false;
          sendFingerprintVerify(foundId);
        }

      } else {
        lcd.clear();
        lcd.print("FP Not Found");
        lcd.setCursor(0, 1);
        lcd.print("Code: " + String(searchResult));
        Serial.print("Fingerprint tidak ditemukan. Error code: ");
        Serial.println(searchResult);
        delay(1500);
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
