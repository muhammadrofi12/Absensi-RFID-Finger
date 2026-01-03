# Dokumentasi Fix: Data Absen Tidak Masuk

## Masalah yang Ditemukan

### 1. **In-Memory Storage (MemStorage)**

Sebelumnya, aplikasi menggunakan `MemStorage` yang menyimpan semua data di RAM. Data akan hilang setiap kali server di-restart.

**File yang terkena:** `server/storage.ts`

### 2. **Tidak Ada Koneksi Database**

Meskipun sudah ada setup Drizzle ORM dan PostgreSQL di dependencies, aplikasi tidak menggunakannya.

**Root cause:**

- `storage.ts` tidak mengimplementasikan integrasi database
- `server/index.ts` tidak menginisialisasi koneksi database
- Data hanya disimpan di RAM

---

## Solusi yang Diterapkan

### 1. **Membuat Database Connection Module** (`server/db.ts`)

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);
```

### 2. **Update Storage Layer** (`server/storage.ts`)

Mengganti `MemStorage` dengan `DbStorage` yang:

- Menggunakan Drizzle ORM untuk query ke PostgreSQL
- Menyimpan data attendance ke database secara persisten
- Setiap create/update/delete attendance terekam di database

**Perubahan key:**

```typescript
// Sebelum (MemStorage - RAM only)
async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
  const id = randomUUID();
  const record: Attendance = { ...insertAttendance, id };
  this.attendance.set(id, record);  // ❌ Hanya di RAM
  return record;
}

// Sesudah (DbStorage - Persistent)
async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
  const id = randomUUID();
  const record: Attendance = { ...insertAttendance, id };
  await db.insert(attendance).values(record);  // ✅ Simpan ke database
  return record;
}
```

### 3. **Update Server Initialization** (`server/index.ts`)

Menambahkan database connection check saat server start:

```typescript
(async () => {
  // Initialize database connection
  await initDb(); // ✅ Cek koneksi DB sebelum routes

  await registerRoutes(httpServer, app);
  // ...
})();
```

---

## Cara Menggunakan

### Persyaratan

1. **Environment Variable**: Set `DATABASE_URL` ke PostgreSQL connection string

   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/employee_presence
   ```

2. **Database Migration**: Jalankan schema migration
   ```bash
   npm run db:push
   ```

### Flow Attendance Sekarang

1. **Ketika RFID + Fingerprint scanned:**

   ```
   ESP32 → POST /api/esp/scan-fp
   ↓
   Validasi employee & fingerprint
   ↓
   storage.createAttendance() → DB INSERT
   ↓
   ✅ Data tersimpan di database
   ```

2. **Ketika cek data attendance:**
   ```
   Frontend → GET /api/attendance
   ↓
   storage.getAttendance() → DB SELECT
   ↓
   ✅ Return data dari database (persistent)
   ```

---

## Verifikasi Data

Setelah melakukan absensi, data harus tersimpan di PostgreSQL:

```sql
-- Cek data di database
SELECT * FROM attendance ORDER BY check_in DESC;

-- Seharusnya ada record baru dengan:
-- - employee_id: ID karyawan yang absen
-- - check_in: timestamp scan RFID+Fingerprint pertama
-- - check_out: timestamp scan kedua (jika ada)
-- - date: tanggal absen
-- - method: "rfid+fingerprint"
```

---

## File yang Berubah

| File                | Perubahan                             |
| ------------------- | ------------------------------------- |
| `server/db.ts`      | ✨ Baru - Database connection module  |
| `server/storage.ts` | 🔄 Updated - DbStorage implementation |
| `server/index.ts`   | 🔄 Updated - Tambah initDb()          |

---

## Troubleshooting

### Error: "DATABASE_URL tidak ditemukan"

**Solusi:** Set environment variable

```bash
set DATABASE_URL=postgresql://...
# atau di .env file
```

### Error: "Connection refused"

**Solusi:**

- Pastikan PostgreSQL server running
- Cek connection string yang benar
- Verify database sudah dibuat

### Data masih hilang saat restart

**Solusi:**

- Confirm DATABASE_URL di-set dengan benar
- Jalankan `npm run db:push` untuk migration
- Cek log server, pastikan "✓ Database connected" muncul

---

## Kesimpulan

Data absen sekarang disimpan secara **persisten ke PostgreSQL**. Setiap absensi (check-in/check-out) akan tercatat di database dan tidak akan hilang saat server di-restart.
