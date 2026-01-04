/*
 * CEK & KELOLA DATABASE FINGERPRINT
 * ==================================
 * Sketch ini untuk mengecek dan mengelola fingerprint di sensor.
 * 
 * Cara pakai:
 * 1. Upload sketch ini ke ESP32
 * 2. Buka Serial Monitor (baud rate: 115200)
 * 3. Ketik perintah:
 *    - "scan"     : Cek semua slot 1-127 yang ada fingerprint
 *    - "test"     : Test scan jari untuk lihat ID-nya
 *    - "enroll X" : Tambah fingerprint baru di slot X (contoh: enroll 1)
 *    - "delete X" : Hapus fingerprint di slot X (contoh: delete 1)
 *    - "empty"    : Hapus SEMUA fingerprint dari sensor
 */

#include <HardwareSerial.h>
#include <Adafruit_Fingerprint.h>

// Sesuaikan dengan wiring ESP32 kamu
#define FP_RX 16
#define FP_TX 17

HardwareSerial FingerSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&FingerSerial);

void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println("\n========================================");
  Serial.println("  CEK & KELOLA DATABASE FINGERPRINT");
  Serial.println("========================================");
  
  // Inisialisasi sensor fingerprint
  FingerSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  finger.begin(57600);
  
  if (finger.verifyPassword()) {
    Serial.println("✓ Sensor fingerprint terdeteksi!");
  } else {
    Serial.println("✗ Sensor tidak ditemukan! Cek wiring.");
    while (1) delay(1);
  }
  
  // Tampilkan info sensor
  finger.getParameters();
  Serial.print("Kapasitas: ");
  Serial.print(finger.capacity);
  Serial.println(" fingerprint");
  
  finger.getTemplateCount();
  Serial.print("Tersimpan: ");
  Serial.print(finger.templateCount);
  Serial.println(" fingerprint");
  
  printMenu();
}

void printMenu() {
  Serial.println("\n--- PERINTAH ---");
  Serial.println("Ketik 'scan'      : Lihat semua slot yang terisi");
  Serial.println("Ketik 'test'      : Test scan jari");
  Serial.println("Ketik 'enroll X'  : Tambah fingerprint di slot X");
  Serial.println("Ketik 'delete X'  : Hapus fingerprint di slot X");
  Serial.println("Ketik 'empty'     : Hapus SEMUA fingerprint");
  Serial.println("Ketik 'help'      : Tampilkan menu ini");
  Serial.println("----------------\n");
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    String cmdLower = cmd;
    cmdLower.toLowerCase();
    
    if (cmdLower == "scan") {
      scanDatabase();
    } 
    else if (cmdLower == "test") {
      testScanFinger();
    }
    else if (cmdLower.startsWith("enroll ")) {
      int id = cmdLower.substring(7).toInt();
      enrollFingerprint(id);
    }
    else if (cmdLower.startsWith("delete ")) {
      int id = cmdLower.substring(7).toInt();
      deleteFingerprint(id);
    }
    else if (cmdLower == "empty") {
      emptyDatabase();
    }
    else if (cmdLower == "help") {
      printMenu();
    }
    else {
      Serial.println("Perintah tidak dikenal. Ketik 'help' untuk melihat daftar perintah.");
    }
  }
}

// Scan semua slot dan tampilkan yang ada fingerprint
void scanDatabase() {
  Serial.println("\n=== CEK DATABASE ===");
  Serial.println("Memeriksa slot fingerprint...\n");
  
  int count = 0;
  
  for (int i = 1; i <= 127; i++) {
    uint8_t p = finger.loadModel(i);
    
    if (p == FINGERPRINT_OK) {
      Serial.print("➡ Slot ");
      Serial.print(i);
      Serial.println(" : ADA fingerprint");
      count++;
    }
  }
  
  Serial.println("");
  if (count == 0) {
    Serial.println("Database KOSONG. Tidak ada fingerprint tersimpan.");
  } else {
    Serial.print("Total: ");
    Serial.print(count);
    Serial.println(" fingerprint tersimpan.");
  }
  Serial.println("====================\n");
}

// Test scan jari untuk lihat ID-nya
void testScanFinger() {
  Serial.println("\n=== TEST SCAN JARI ===");
  Serial.println("Tempelkan jari pada sensor...");
  
  // Tunggu jari
  while (finger.getImage() != FINGERPRINT_OK) {
    delay(100);
  }
  
  Serial.println("Jari terdeteksi, memproses...");
  
  // Convert ke template
  uint8_t p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.println("✗ Gagal konversi image!");
    return;
  }
  
  // Cari di database
  p = finger.fingerFastSearch();
  
  if (p == FINGERPRINT_OK) {
    Serial.println("\n✓ FINGERPRINT DITEMUKAN!");
    Serial.print("  ID        : ");
    Serial.println(finger.fingerID);
    Serial.print("  Confidence: ");
    Serial.println(finger.confidence);
  } else {
    Serial.println("\n✗ FINGERPRINT TIDAK DITEMUKAN di database sensor.");
    Serial.println("  Jari ini belum terdaftar.");
  }
  
  Serial.println("======================\n");
}

// Tambah fingerprint baru di slot tertentu
void enrollFingerprint(int id) {
  if (id < 1 || id > 127) {
    Serial.println("✗ ID harus antara 1-127!");
    return;
  }
  
  Serial.println("\n=== ENROLL FINGERPRINT ===");
  Serial.print("Mendaftarkan fingerprint ke slot ");
  Serial.println(id);
  
  // ===== SCAN PERTAMA =====
  Serial.println("\n[1/2] Tempelkan jari pada sensor...");
  
  uint8_t p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (p == FINGERPRINT_NOFINGER) {
      // Tunggu jari
      delay(100);
    } else if (p == FINGERPRINT_OK) {
      Serial.println("      Jari terdeteksi!");
    } else {
      Serial.print("      Error: ");
      Serial.println(p);
    }
  }
  
  // Convert ke template 1
  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    Serial.println("✗ Gagal konversi image!");
    return;
  }
  Serial.println("      Image dikonversi.");
  
  // ===== ANGKAT JARI =====
  Serial.println("\n      Angkat jari...");
  delay(1000);
  while (finger.getImage() != FINGERPRINT_NOFINGER) {
    delay(100);
  }
  
  // ===== SCAN KEDUA =====
  Serial.println("\n[2/2] Tempelkan jari YANG SAMA lagi...");
  
  p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (p == FINGERPRINT_NOFINGER) {
      delay(100);
    } else if (p == FINGERPRINT_OK) {
      Serial.println("      Jari terdeteksi!");
    } else {
      Serial.print("      Error: ");
      Serial.println(p);
    }
  }
  
  // Convert ke template 2
  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    Serial.println("✗ Gagal konversi image kedua!");
    return;
  }
  Serial.println("      Image dikonversi.");
  
  // ===== BUAT MODEL =====
  Serial.println("\n      Membuat model fingerprint...");
  p = finger.createModel();
  if (p == FINGERPRINT_OK) {
    Serial.println("      Model berhasil dibuat!");
  } else if (p == FINGERPRINT_ENROLLMISMATCH) {
    Serial.println("✗ Fingerprint tidak cocok! Pastikan jari yang sama.");
    return;
  } else {
    Serial.print("✗ Error membuat model: ");
    Serial.println(p);
    return;
  }
  
  // ===== SIMPAN KE SLOT =====
  Serial.print("      Menyimpan ke slot ");
  Serial.print(id);
  Serial.println("...");
  
  p = finger.storeModel(id);
  if (p == FINGERPRINT_OK) {
    Serial.println("\n✓ BERHASIL! Fingerprint tersimpan di slot " + String(id));
  } else {
    Serial.print("✗ Gagal menyimpan! Error: ");
    Serial.println(p);
    return;
  }
  
  Serial.println("==========================\n");
}

// Hapus fingerprint di slot tertentu
void deleteFingerprint(int id) {
  Serial.print("\nMenghapus fingerprint di slot ");
  Serial.print(id);
  Serial.println("...");
  
  uint8_t p = finger.deleteModel(id);
  
  if (p == FINGERPRINT_OK) {
    Serial.println("✓ Berhasil dihapus!");
  } else {
    Serial.println("✗ Gagal menghapus atau slot kosong.");
  }
  Serial.println("");
}

// Hapus semua fingerprint
void emptyDatabase() {
  Serial.println("\n⚠ PERINGATAN: Ini akan menghapus SEMUA fingerprint!");
  Serial.println("Ketik 'YES' untuk konfirmasi dalam 10 detik...");
  
  unsigned long start = millis();
  while (millis() - start < 10000) {
    if (Serial.available()) {
      String confirm = Serial.readStringUntil('\n');
      confirm.trim();
      
      if (confirm == "YES") {
        Serial.println("Menghapus semua fingerprint...");
        uint8_t p = finger.emptyDatabase();
        
        if (p == FINGERPRINT_OK) {
          Serial.println("✓ Database berhasil dikosongkan!");
        } else {
          Serial.println("✗ Gagal mengosongkan database.");
        }
        return;
      } else {
        Serial.println("Dibatalkan.");
        return;
      }
    }
    delay(100);
  }
  
  Serial.println("Timeout. Dibatalkan.");
}
