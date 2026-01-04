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
// TRUE → sedang nunggu fingerprint untuk SEARCH (link existing fingerprint)
bool waitingFpEnroll = false;

// TRUE → sedang nunggu fingerprint untuk ENROLL BARU (2x scan, simpan ke sensor)
bool waitingFpEnrollNew = false;

// TRUE → sedang nunggu fingerprint untuk VERIFIKASI (2FA attendance)
bool waitingFpVerify = false;

// RFID terakhir yang berhasil discan (untuk pairing dengan fingerprint)
String currentRFID = "";

// ===============================================================
// HELPER: RESET STATE
// ===============================================================
void resetState() {
  waitingFpEnroll = false;
  waitingFpEnrollNew = false;
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
// HTTP GET (for polling server status)
// ===============================================================
bool httpGet(const String& path, String& resp) {
  WiFiClient client;

  if (!client.connect(API_HOST, API_PORT)) {
    return false;
  }

  String req =
    "GET " + path + " HTTP/1.1\r\n"
    "Host: " + String(API_HOST) + ":" + API_PORT + "\r\n"
    "Connection: close\r\n\r\n";

  client.print(req);

  unsigned long start = millis();
  while (!client.available()) {
    if (millis() - start > 3000) {
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

  return full.startsWith("HTTP/1.1 200");
}

// ===============================================================
// CHECK ENROLLMENT MODE FROM SERVER
// ===============================================================
unsigned long lastEnrollCheck = 0;
const unsigned long ENROLL_CHECK_INTERVAL = 2000; // Check every 2 seconds

void checkEnrollModeFromServer() {
  // Only check periodically and when not in any active mode
  if (waitingFpEnroll || waitingFpVerify || waitingFpEnrollNew) return;
  
  unsigned long now = millis();
  if (now - lastEnrollCheck < ENROLL_CHECK_INTERVAL) return;
  lastEnrollCheck = now;
  
  String resp;
  if (httpGet("/api/esp/pending-rfid", resp)) {
    // Check if enrollMode is true
    if (resp.indexOf("\"enrollMode\":true") >= 0) {
      Serial.println("=== ENROLL MODE DETECTED FROM SERVER ===");
      
      // Extract rfidId if available
      int rfidStart = resp.indexOf("\"rfidId\":\"");
      if (rfidStart >= 0) {
        rfidStart += 10;
        int rfidEnd = resp.indexOf("\"", rfidStart);
        if (rfidEnd > rfidStart) {
          currentRFID = resp.substring(rfidStart, rfidEnd);
          Serial.print("RFID for enrollment: ");
          Serial.println(currentRFID);
        }
      }
      
      // Trigger new fingerprint enrollment
      waitingFpEnrollNew = true;
      enrollNewFingerprint();
    }
  }
}

// ===============================================================
// FINGERPRINT MANAGEMENT: Check commands from server
// ===============================================================
unsigned long lastCmdCheck = 0;
const unsigned long CMD_CHECK_INTERVAL = 3000; // Check every 3 seconds

void checkFingerprintCommand() {
  // Don't check if busy with other operations
  if (waitingFpEnroll || waitingFpVerify || waitingFpEnrollNew) return;
  
  unsigned long now = millis();
  if (now - lastCmdCheck < CMD_CHECK_INTERVAL) return;
  lastCmdCheck = now;
  
  String resp;
  if (!httpGet("/api/esp/fingerprints/command", resp)) return;
  
  // Check if there's a command
  if (resp.indexOf("\"hasCommand\":true") < 0) return;
  
  Serial.println("=== FINGERPRINT COMMAND DETECTED ===");
  Serial.println(resp);
  
  if (resp.indexOf("\"type\":\"scan_all\"") >= 0) {
    scanAllFingerprints();
  } else if (resp.indexOf("\"type\":\"delete\"") >= 0) {
    // Extract slotId
    int slotStart = resp.indexOf("\"slotId\":");
    if (slotStart >= 0) {
      slotStart += 9;
      int slotEnd = resp.indexOf(",", slotStart);
      if (slotEnd < 0) slotEnd = resp.indexOf("}", slotStart);
      int slotId = resp.substring(slotStart, slotEnd).toInt();
      deleteFingerprintSlot(slotId);
    }
  } else if (resp.indexOf("\"type\":\"enroll\"") >= 0) {
    // Extract slotId
    int slotStart = resp.indexOf("\"slotId\":");
    if (slotStart >= 0) {
      slotStart += 9;
      int slotEnd = resp.indexOf(",", slotStart);
      if (slotEnd < 0) slotEnd = resp.indexOf("}", slotStart);
      int slotId = resp.substring(slotStart, slotEnd).toInt();
      enrollToSlot(slotId);
    }
  }
}

// ===============================================================
// FINGERPRINT MANAGEMENT: Scan all slots
// ===============================================================
void scanAllFingerprints() {
  lcd.clear();
  lcd.print("Scanning FP...");
  Serial.println("Scanning all fingerprint slots...");
  
  String jsonData = "[";
  bool first = true;
  int count = 0;
  
  for (int i = 1; i <= 127; i++) {
    uint8_t p = finger.loadModel(i);
    if (p == FINGERPRINT_OK) {
      if (!first) jsonData += ",";
      jsonData += "{\"slotId\":" + String(i) + ",\"hasFingerprint\":true}";
      first = false;
      count++;
    }
  }
  jsonData += "]";
  
  Serial.print("Found ");
  Serial.print(count);
  Serial.println(" fingerprints");
  
  // Send result to server
  String body = "{\"success\":true,\"command\":\"scan_all\",\"data\":" + jsonData + "}";
  String resp;
  httpPost("/api/esp/fingerprints/result", body, resp);
  
  lcd.clear();
  lcd.print("Found: " + String(count) + " FP");
  delay(2000);
  lcd.clear();
  lcd.print("Scan RFID/FP");
}

// ===============================================================
// FINGERPRINT MANAGEMENT: Delete fingerprint at slot
// ===============================================================
void deleteFingerprintSlot(int slotId) {
  lcd.clear();
  lcd.print("Deleting #" + String(slotId));
  Serial.print("Deleting fingerprint at slot ");
  Serial.println(slotId);
  
  uint8_t p = finger.deleteModel(slotId);
  
  String body;
  if (p == FINGERPRINT_OK) {
    body = "{\"success\":true,\"command\":\"delete\",\"message\":\"Slot " + String(slotId) + " deleted\"}";
    lcd.setCursor(0, 1);
    lcd.print("Berhasil!");
    Serial.println("Delete success");
  } else {
    body = "{\"success\":false,\"command\":\"delete\",\"message\":\"Delete failed\"}";
    lcd.setCursor(0, 1);
    lcd.print("Gagal!");
    Serial.println("Delete failed");
  }
  
  String resp;
  httpPost("/api/esp/fingerprints/result", body, resp);
  
  delay(2000);
  lcd.clear();
  lcd.print("Scan RFID/FP");
}

// ===============================================================
// FINGERPRINT MANAGEMENT: Enroll to specific slot
// ===============================================================
void enrollToSlot(int slotId) {
  Serial.print("=== ENROLLING TO SLOT ");
  Serial.print(slotId);
  Serial.println(" ===");
  
  // ===== SCAN PERTAMA =====
  lcd.clear();
  lcd.print("Tempel Jari");
  lcd.setCursor(0, 1);
  lcd.print("[1/2] Slot:" + String(slotId));
  
  uint8_t p = -1;
  unsigned long timeout = millis() + 30000; // 30s timeout
  while (p != FINGERPRINT_OK) {
    if (millis() > timeout) {
      String body = "{\"success\":false,\"command\":\"enroll\",\"message\":\"Timeout - no finger detected\"}";
      String resp;
      httpPost("/api/esp/fingerprints/result", body, resp);
      lcd.clear();
      lcd.print("Timeout!");
      delay(2000);
      resetState();
      return;
    }
    p = finger.getImage();
    delay(100);
  }
  
  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    String body = "{\"success\":false,\"command\":\"enroll\",\"message\":\"Image convert error\"}";
    String resp;
    httpPost("/api/esp/fingerprints/result", body, resp);
    lcd.clear();
    lcd.print("Error!");
    delay(2000);
    resetState();
    return;
  }
  
  // ===== ANGKAT JARI =====
  lcd.clear();
  lcd.print("Angkat Jari...");
  delay(1500);
  while (finger.getImage() != FINGERPRINT_NOFINGER) delay(100);
  
  // ===== SCAN KEDUA =====
  lcd.clear();
  lcd.print("Tempel Lagi");
  lcd.setCursor(0, 1);
  lcd.print("[2/2] Slot:" + String(slotId));
  
  p = -1;
  timeout = millis() + 30000;
  while (p != FINGERPRINT_OK) {
    if (millis() > timeout) {
      String body = "{\"success\":false,\"command\":\"enroll\",\"message\":\"Timeout - second scan\"}";
      String resp;
      httpPost("/api/esp/fingerprints/result", body, resp);
      lcd.clear();
      lcd.print("Timeout!");
      delay(2000);
      resetState();
      return;
    }
    p = finger.getImage();
    delay(100);
  }
  
  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    String body = "{\"success\":false,\"command\":\"enroll\",\"message\":\"Second image convert error\"}";
    String resp;
    httpPost("/api/esp/fingerprints/result", body, resp);
    resetState();
    return;
  }
  
  // ===== BUAT MODEL =====
  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
    String body = "{\"success\":false,\"command\":\"enroll\",\"message\":\"Fingerprints did not match\"}";
    String resp;
    httpPost("/api/esp/fingerprints/result", body, resp);
    lcd.clear();
    lcd.print("Jari Beda!");
    delay(2000);
    resetState();
    return;
  }
  
  // ===== SIMPAN =====
  p = finger.storeModel(slotId);
  if (p == FINGERPRINT_OK) {
    String body = "{\"success\":true,\"command\":\"enroll\",\"message\":\"Enrolled to slot " + String(slotId) + "\"}";
    String resp;
    httpPost("/api/esp/fingerprints/result", body, resp);
    lcd.clear();
    lcd.print("Enrolled!");
    lcd.setCursor(0, 1);
    lcd.print("Slot: " + String(slotId));
    Serial.println("Enroll to slot success!");
  } else {
    String body = "{\"success\":false,\"command\":\"enroll\",\"message\":\"Store failed\"}";
    String resp;
    httpPost("/api/esp/fingerprints/result", body, resp);
    lcd.clear();
    lcd.print("Gagal Simpan!");
  }
  
  delay(2500);
  resetState();
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
  lcd.print("RFID OK!");
  lcd.setCursor(0, 1);
  lcd.print("Klik Enroll Web");
  
  // JANGAN set waitingFpEnroll disini!
  // Tunggu trigger dari web UI via checkEnrollModeFromServer()
  // yang akan memanggil enrollNewFingerprint() untuk enroll fingerprint BARU
  
  Serial.println("RFID accepted. Click 'Enroll' button in web to start fingerprint enrollment.");
  delay(2000);
  
  lcd.clear();
  lcd.print("Menunggu...");
  lcd.setCursor(0, 1);
  lcd.print("Enroll dari Web");
  
  return;  // Jangan reset, tunggu trigger dari web
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
// FIND NEXT FREE SLOT IN FINGERPRINT SENSOR
// ===============================================================
int findNextFreeSlot() {
  for (int i = 1; i <= 127; i++) {
    uint8_t p = finger.loadModel(i);
    if (p != FINGERPRINT_OK) {
      // Slot is empty
      return i;
    }
  }
  return -1; // No free slot
}

// ===============================================================
// ENROLL NEW FINGERPRINT (2-step scan + store to sensor)
// ===============================================================
void enrollNewFingerprint() {
  Serial.println("=== ENROLLING NEW FINGERPRINT ===");
  
  // Find next available slot
  int slotId = findNextFreeSlot();
  if (slotId == -1) {
    lcd.clear();
    lcd.print("Sensor Penuh!");
    Serial.println("No free slot in fingerprint sensor");
    delay(2000);
    resetState();
    return;
  }
  
  Serial.print("Using slot: ");
  Serial.println(slotId);
  
  // ===== SCAN PERTAMA =====
  lcd.clear();
  lcd.print("Tempel Jari");
  lcd.setCursor(0, 1);
  lcd.print("[1/2]");
  
  Serial.println("[1/2] Waiting for finger...");
  
  uint8_t p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (p == FINGERPRINT_NOFINGER) {
      delay(100);
    } else if (p == FINGERPRINT_OK) {
      Serial.println("Finger detected!");
    } else {
      Serial.print("Image error: ");
      Serial.println(p);
    }
  }
  
  // Convert ke template 1
  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    lcd.clear();
    lcd.print("Error image");
    Serial.println("Failed to convert image 1");
    delay(2000);
    resetState();
    return;
  }
  Serial.println("Image 1 converted.");
  
  // ===== ANGKAT JARI =====
  lcd.clear();
  lcd.print("Angkat Jari...");
  Serial.println("Remove finger...");
  delay(1500);
  
  while (finger.getImage() != FINGERPRINT_NOFINGER) {
    delay(100);
  }
  
  // ===== SCAN KEDUA =====
  lcd.clear();
  lcd.print("Tempel Lagi");
  lcd.setCursor(0, 1);
  lcd.print("[2/2]");
  
  Serial.println("[2/2] Place same finger again...");
  
  p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (p == FINGERPRINT_NOFINGER) {
      delay(100);
    } else if (p == FINGERPRINT_OK) {
      Serial.println("Finger detected!");
    } else {
      Serial.print("Image error: ");
      Serial.println(p);
    }
  }
  
  // Convert ke template 2
  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    lcd.clear();
    lcd.print("Error image 2");
    Serial.println("Failed to convert image 2");
    delay(2000);
    resetState();
    return;
  }
  Serial.println("Image 2 converted.");
  
  // ===== BUAT MODEL =====
  lcd.clear();
  lcd.print("Memproses...");
  
  Serial.println("Creating model...");
  p = finger.createModel();
  if (p == FINGERPRINT_OK) {
    Serial.println("Model created!");
  } else if (p == FINGERPRINT_ENROLLMISMATCH) {
    lcd.clear();
    lcd.print("Jari Beda!");
    lcd.setCursor(0, 1);
    lcd.print("Coba lagi");
    Serial.println("Fingerprints did not match!");
    delay(2000);
    resetState();
    return;
  } else {
    lcd.clear();
    lcd.print("Error model");
    Serial.print("Model error: ");
    Serial.println(p);
    delay(2000);
    resetState();
    return;
  }
  
  // ===== SIMPAN KE SLOT =====
  Serial.print("Storing to slot ");
  Serial.println(slotId);
  
  p = finger.storeModel(slotId);
  if (p == FINGERPRINT_OK) {
    Serial.println("Stored successfully!");
    
    // Kirim ke server
    lcd.clear();
    lcd.print("Mengirim...");
    sendFingerprintEnroll(slotId);
    
  } else {
    lcd.clear();
    lcd.print("Gagal simpan");
    Serial.print("Store error: ");
    Serial.println(p);
    delay(2000);
    resetState();
  }
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
  // POLL SERVER FOR ENROLLMENT MODE (from web UI)
  // ===========================================================
  checkEnrollModeFromServer();

  // ===========================================================
  // POLL SERVER FOR FINGERPRINT MANAGEMENT COMMANDS
  // ===========================================================
  checkFingerprintCommand();

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
