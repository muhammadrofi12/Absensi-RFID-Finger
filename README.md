# 🏢 Sistem Absensi RFID + Fingerprint (IoT)

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6.svg)
![ESP32](https://img.shields.io/badge/Hardware-ESP32-red.svg)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791.svg)

**Sistem absensi karyawan berbasis IoT menggunakan ESP32, RFID, dan Fingerprint dengan dashboard admin web modern.**

[Demo](#-cara-menjalankan) · [API Docs](#-api-endpoints) · [Hardware Setup](#-wiring-esp32) · [Kontribusi](#-kontribusi)

</div>

---

## 📋 Deskripsi

**Absensi RFID + Fingerprint** adalah sistem manajemen kehadiran karyawan terintegrasi yang menggabungkan perangkat keras IoT dengan dashboard web modern. Sistem ini mengimplementasikan **Two-Factor Authentication (2FA)** untuk memastikan keakuratan data absensi — karyawan wajib melakukan scan kartu RFID **dan** verifikasi sidik jari setiap kali check-in atau check-out.

### ✨ Fitur Utama

| Fitur | Keterangan |
|-------|-----------|
| 🔐 **2FA Attendance** | Kombinasi RFID card + fingerprint untuk autentikasi ganda |
| 📊 **Dashboard Real-time** | Monitoring kehadiran harian secara langsung |
| 👥 **Manajemen Karyawan** | CRUD lengkap: tambah, edit, hapus, dan lihat data karyawan |
| 📅 **Riwayat Absensi** | Log absensi lengkap dengan filter tanggal |
| 🌙 **Dark/Light Mode** | Dukungan tema terang dan gelap |
| 📺 **LCD Status** | Tampilan status real-time di perangkat keras |
| 🔌 **IoT Integration** | Komunikasi ESP32 ↔ Server via REST API over WiFi |

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                         PERANGKAT KERAS                         │
│  ┌──────────┐   ┌──────────────┐   ┌───────────────────────┐   │
│  │ RFID Card│-->│ MFRC522 Reader│-->│     ESP32 DevKit      │   │
│  └──────────┘   └──────────────┘   │                       │   │
│  ┌──────────┐   ┌──────────────┐   │  (Firmware Arduino)   │   │
│  │   Jari   │-->│   Fingerprint│-->│                       │   │
│  └──────────┘   │    Sensor    │   └──────────┬────────────┘   │
│                 └──────────────┘              │ LCD I2C 16x2   │
└──────────────────────────────────────────────┼─────────────────┘
                                               │ WiFi (HTTP)
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Node.js + Express)                  │
│  ┌─────────────────┐   ┌─────────────────┐   ┌──────────────┐  │
│  │  REST API       │   │  Storage Layer  │   │  Vite Dev    │  │
│  │  /api/esp/*     │-->│  (MemStorage /  │   │  Server      │  │
│  │  /api/employees │   │   PostgreSQL)   │   │  (Frontend)  │  │
│  │  /api/attendance│   └─────────────────┘   └──────────────┘  │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WEB DASHBOARD (React + TypeScript)            │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │Dashboard │   │  Manajemen   │   │   Log Absensi          │  │
│  │(Statistik│   │  Karyawan    │   │   (Filter & Tabel)     │  │
│  │ & Status)│   │  (CRUD Form) │   │                        │  │
│  └──────────┘   └──────────────┘   └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 🛠️ Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, shadcn/ui, Wouter, TanStack Query |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | PostgreSQL + Drizzle ORM (in-memory untuk development) |
| **Build Tools** | Vite, esbuild, tsx |
| **Validasi** | Zod, drizzle-zod |
| **Hardware** | ESP32 DevKit, RFID MFRC522, Fingerprint Sensor, LCD I2C 16x2 |
| **Komunikasi** | REST API (HTTP/WiFi) |

---

## 🔄 Alur Sistem Absensi

```
Karyawan
   │
   ▼
[1] Tap Kartu RFID
   │
   ▼
ESP32 --> POST /api/esp/scan
   │
   ├── Kartu TIDAK terdaftar --> LCD: "Kartu Ditolak" ❌
   │
   ├── Fingerprint BELUM terdaftar --> LCD: "FP Belum Terdaftar" ⚠️
   │
   └── Kartu VALID + FP ada --> LCD: "Tempel Finger" ⏳
           │
           ▼
       [2] Tempel Jari
           │
           ▼
       ESP32 --> POST /api/esp/scan-fp
           │
           ├── Fingerprint TIDAK cocok --> LCD: "FP Salah" ❌ (coba lagi)
           │
           └── Fingerprint COCOK ✅
                   │
                   ├── Belum Check-In hari ini --> Catat CHECK-IN 🟢
                   ├── Sudah Check-In, belum Check-Out --> Catat CHECK-OUT 🔵
                   └── Sudah Check-Out --> LCD: "Sudah Absen Hari Ini" ⚠️
```

---

## 📁 Struktur Project

```
Absensi-RFID-Finger/
├── client/                         # Frontend React
│   ├── index.html
│   └── src/
│       ├── App.tsx                 # Root component + routing
│       ├── main.tsx                # Entry point
│       ├── index.css               # Global styles & design tokens
│       ├── components/             # Komponen UI
│       │   ├── app-sidebar.tsx     # Sidebar navigasi
│       │   ├── theme-toggle.tsx    # Toggle dark/light mode
│       │   └── ui/                 # shadcn/ui components
│       ├── pages/                  # Halaman aplikasi
│       │   ├── dashboard.tsx       # Dashboard utama & statistik
│       │   ├── employees.tsx       # Manajemen karyawan (CRUD)
│       │   ├── attendance.tsx      # Log & monitoring absensi
│       │   └── not-found.tsx       # Halaman 404
│       ├── hooks/                  # Custom React hooks
│       └── lib/                    # Utilities & query client
│
├── server/                         # Backend Express
│   ├── index.ts                    # Entry point server
│   ├── routes.ts                   # Definisi semua API route
│   ├── storage.ts                  # Data access layer (IStorage)
│   ├── static.ts                   # Static file serving
│   └── vite.ts                     # Integrasi Vite dev server
│
├── shared/                         # Shared antara client & server
│   └── schema.ts                   # Drizzle schema + Zod types
│
├── RFID_Finger_Absensi/            # Firmware ESP32
│   └── RFID_Finger_Absensi.ino    # Kode Arduino ESP32
│
├── drizzle.config.ts               # Konfigurasi Drizzle ORM
├── vite.config.ts                  # Konfigurasi Vite
├── tailwind.config.ts              # Konfigurasi Tailwind CSS
├── tsconfig.json                   # Konfigurasi TypeScript
└── package.json                    # Dependencies & scripts
```

---

## 🔌 API Endpoints

### 👥 Employee Routes

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/employees` | Ambil semua data karyawan |
| `GET` | `/api/employees/:id` | Ambil data karyawan by ID |
| `POST` | `/api/employees` | Tambah karyawan baru |
| `PATCH` | `/api/employees/:id` | Update data karyawan |
| `DELETE` | `/api/employees/:id` | Hapus karyawan |

### 📋 Attendance Routes

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/attendance` | Ambil semua rekaman absensi |
| `GET` | `/api/attendance/today` | Ambil absensi hari ini |
| `GET` | `/api/attendance/recent` | Ambil 10 absensi terakhir |

### ⚡ ESP32 IoT Routes

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/esp/scan` | RFID scan (cek kartu & mulai absensi) |
| `POST` | `/api/esp/scan-fp` | Verifikasi fingerprint 2FA |
| `POST` | `/api/esp/fp-enrolled` | Notifikasi fingerprint sudah di-enroll |
| `POST` | `/api/esp/start-register` | Aktifkan mode pendaftaran RFID baru |
| `GET` | `/api/esp/pending-rfid` | Ambil data RFID yang sedang menunggu |
| `DELETE` | `/api/esp/pending-rfid` | Hapus data RFID pending |

### 🧪 Test/Debug Routes

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/test/attendance` | Buat data absensi secara manual |
| `POST` | `/api/test/attendance-checkout` | Buat checkout manual |
| `GET` | `/api/test/all-attendance` | Lihat semua data absensi |

---

## 🗄️ Model Data

### Employee

```typescript
{
  id: string,              // UUID (auto-generated)
  name: string,            // Nama lengkap karyawan
  employeeId: string,      // NIP / NIK karyawan (unique)
  department: string,      // Nama departemen
  rfidId: string | null,   // UID kartu RFID (unique)
  fingerprintId: number | null, // ID fingerprint di sensor
  photoUrl: string | null  // URL foto (opsional)
}
```

### Attendance

```typescript
{
  id: string,           // UUID (auto-generated)
  employeeId: string,   // Referensi ke Employee.id
  checkIn: Date | null, // Timestamp check-in
  checkOut: Date | null,// Timestamp check-out
  date: string,         // Tanggal format YYYY-MM-DD
  method: string        // Metode absensi: "rfid+fingerprint"
}
```

---

## 🔧 Wiring ESP32

### Pin Configuration

| Modul | Pin ESP32 | Keterangan |
|-------|-----------|------------|
| **RFID MFRC522** | SDA → GPIO 21 | SPI Chip Select |
| **RFID MFRC522** | RST → GPIO 22 | Reset |
| **RFID MFRC522** | SCK, MOSI, MISO | SPI default |
| **Fingerprint Sensor** | RX → GPIO 16 | HardwareSerial2 |
| **Fingerprint Sensor** | TX → GPIO 17 | HardwareSerial2 |
| **LCD I2C 16x2** | SDA → GPIO 4 | I2C Data |
| **LCD I2C 16x2** | SCL → GPIO 5 | I2C Clock |
| **LCD I2C** | Alamat I2C | `0x27` |

### Library yang Dibutuhkan (Arduino IDE)

```
- MFRC522 by GithubCommunity
- LiquidCrystal_I2C by Frank de Brabander
- Adafruit Fingerprint Sensor Library by Adafruit
- WiFi (built-in ESP32)
```

---

## 🚀 Cara Menjalankan

### Prasyarat

- **Node.js** v18 atau lebih baru
- **npm** v9+
- **PostgreSQL** (opsional, bisa pakai in-memory)
- **Arduino IDE** (untuk upload firmware ESP32)

---

### 1️⃣ Clone & Install Dependencies

```bash
git clone https://github.com/muhammadrofi12/Absensi-RFID-Finger.git
cd Absensi-RFID-Finger
npm install
```

---

### 2️⃣ Konfigurasi Environment

Buat file `.env` di root project:

```env
# Jika menggunakan PostgreSQL:
DATABASE_URL=postgresql://username:password@localhost:5432/absensi_db

# Jika tidak ada, sistem akan menggunakan in-memory storage
```

---

### 3️⃣ Setup Database (Opsional - PostgreSQL)

```bash
npm run db:push
```

> **Catatan:** Jika tidak ada `DATABASE_URL`, sistem secara otomatis menggunakan **in-memory storage**. Data akan hilang saat server di-restart.

---

### 4️⃣ Jalankan Development Server

```bash
npm run dev
```

Server berjalan di: **http://localhost:5000**

---

### 5️⃣ Build untuk Production

```bash
npm run build
npm run start
```

---

### 6️⃣ Upload Firmware ESP32

1. Buka **Arduino IDE**
2. Buka file `RFID_Finger_Absensi/RFID_Finger_Absensi.ino`
3. Sesuaikan konfigurasi WiFi di bagian atas file:

```cpp
// Sesuaikan dengan WiFi kamu:
const char* ssid     = "NAMA_WIFI_KAMU";
const char* password = "PASSWORD_WIFI_KAMU";

// IP Address laptop yang menjalankan server:
const char* API_HOST = "192.168.x.x";  // Ganti dengan IP laptop kamu
const int   API_PORT = 5000;
```

4. Pilih board: **ESP32 Dev Module**
5. Upload ke ESP32

> **Penting:** ESP32 dan laptop **harus terhubung ke jaringan WiFi yang sama!**

---

## 📱 Halaman Dashboard

### 🏠 Dashboard
- Statistik total karyawan terdaftar
- Jumlah yang hadir hari ini
- Status check-in dan check-out terkini
- Grafik kehadiran

### 👥 Manajemen Karyawan
- Tabel list semua karyawan dengan pencarian
- Form tambah karyawan baru (nama, NIP, departemen, RFID ID, foto)
- Edit data karyawan
- Pendaftaran RFID via scan hardware (tekan tombol "Scan RFID")
- Hapus karyawan

### 📅 Log Absensi
- Tabel rekaman absensi dengan informasi nama, departemen, check-in, check-out
- Filter berdasarkan tanggal
- Monitoring real-time

---

## ⚙️ Alur Pendaftaran Karyawan Baru

```
Admin di Web Dashboard
   │
   ▼
[1] Buka halaman "Karyawan" → Klik "Tambah Karyawan"
   │
   ▼
[2] Isi data: Nama, NIP, Departemen
   │
   ▼
[3] Klik tombol "Scan RFID"
   │  Server aktifkan mode register (POST /api/esp/start-register)
   ▼
[4] Tempelkan kartu RFID ke reader ESP32
   │  ESP32 mengirim UID → Server simpan sebagai pending RFID
   ▼
[5] Web form otomatis mengisi RFID ID (polling /api/esp/pending-rfid)
   │
   ▼
[6] Simpan data karyawan
```

---

## 🔒 Keamanan

- **2FA Hardware**: Tidak bisa absen hanya dengan kartu RFID saja
- **Fingerprint Matching**: ID fingerprint diverifikasi server-side
- **Single Attendance Per Day**: Sistem mencegah duplikasi check-in
- **RFID Timeout**: Pending RFID scan expired dalam 30 detik

---

## 🧑‍💻 Scripts

| Script | Perintah | Keterangan |
|--------|----------|-----------|
| Development | `npm run dev` | Jalankan server dev dengan HMR |
| Build | `npm run build` | Build frontend + bundle server |
| Production | `npm run start` | Jalankan server production |
| Type Check | `npm run check` | Periksa TypeScript |
| DB Push | `npm run db:push` | Push schema ke database |

---

## 🤝 Kontribusi

1. Fork repository ini
2. Buat branch fitur: `git checkout -b feature/nama-fitur`
3. Commit perubahan: `git commit -m 'feat: tambah fitur X'`
4. Push ke branch: `git push origin feature/nama-fitur`
5. Buat Pull Request

---

## 📄 Lisensi

Project ini dilisensikan di bawah [MIT License](LICENSE).

---

## 👨‍💻 Author

**Muhammad Rofi'ul Arham**

- GitHub: [@muhammadrofi12](https://github.com/muhammadrofi12)

---

<div align="center">

**⭐ Jika project ini membantu, jangan lupa beri bintang! ⭐**

</div>
