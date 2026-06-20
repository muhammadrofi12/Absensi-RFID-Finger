/**
 * Seed Script - Data Dummy 10 Karyawan (3 Departemen)
 * Menambahkan: Employees, Attendance (7 hari terakhir), Leave Requests, Leave Balances, Shifts, Employee Shifts
 * 
 * Departemen:
 * - IT & Engineering     (4 karyawan)
 * - Finance & Accounting (3 karyawan)
 * - Human Resources      (3 karyawan)
 * 
 * Jalankan: npx tsx script/seed-dummy.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomUUID } from "crypto";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { readFileSync } from "fs";
import { resolve } from "path";

// Baca .env secara manual karena dotenv tidak tersedia
try {
  const envPath = resolve(process.cwd(), ".env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env tidak ditemukan, lanjutkan
}

import {
  employees,
  attendance,
  users,
  leaveRequests,
  leaveBalances,
  shifts,
  employeeShifts,
} from "../shared/schema";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL tidak ditemukan di .env");
  process.exit(1);
}

const client = postgres(DATABASE_URL, { ssl: "require" });
const db = drizzle(client);

// ─── Data Karyawan ─────────────────────────────────────────────────────────────
const employeeData = [
  // IT & Engineering (4 orang)
  { name: "Ahmad Fauzi",       employeeId: "IT-001", department: "IT & Engineering",     rfidId: "RFID-IT001", fingerprintId: 1  },
  { name: "Budi Santoso",      employeeId: "IT-002", department: "IT & Engineering",     rfidId: "RFID-IT002", fingerprintId: 2  },
  { name: "Citra Dewi",        employeeId: "IT-003", department: "IT & Engineering",     rfidId: "RFID-IT003", fingerprintId: 3  },
  { name: "Dian Pratama",      employeeId: "IT-004", department: "IT & Engineering",     rfidId: "RFID-IT004", fingerprintId: 4  },
  // Finance & Accounting (3 orang)
  { name: "Eka Rahayu",        employeeId: "FIN-001", department: "Finance & Accounting", rfidId: "RFID-FIN01", fingerprintId: 5  },
  { name: "Fajar Nugroho",     employeeId: "FIN-002", department: "Finance & Accounting", rfidId: "RFID-FIN02", fingerprintId: 6  },
  { name: "Gita Permata",      employeeId: "FIN-003", department: "Finance & Accounting", rfidId: "RFID-FIN03", fingerprintId: 7  },
  // Human Resources (3 orang)
  { name: "Hendra Wijaya",     employeeId: "HR-001",  department: "Human Resources",      rfidId: "RFID-HR001", fingerprintId: 8  },
  { name: "Indah Sari",        employeeId: "HR-002",  department: "Human Resources",      rfidId: "RFID-HR002", fingerprintId: 9  },
  { name: "Joko Sulistyo",     employeeId: "HR-003",  department: "Human Resources",      rfidId: "RFID-HR003", fingerprintId: 10 },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function toTimestamp(dateString: string, hour: number, minute: number): Date {
  const d = new Date(dateString);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ─── Main Seeder ───────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Memulai seeding data dummy...\n");

  // ── 1. Buat Shifts ──────────────────────────────────────────────────────────
  console.log("📋 Membuat shift kerja...");
  const shiftPagi = await db.insert(shifts).values({
    id: randomUUID(),
    name: "Shift Pagi",
    startTime: "08:00",
    endTime: "17:00",
    workDays: JSON.stringify(["Monday","Tuesday","Wednesday","Thursday","Friday"]),
  }).returning().then(r => r[0]);

  const shiftSore = await db.insert(shifts).values({
    id: randomUUID(),
    name: "Shift Sore",
    startTime: "14:00",
    endTime: "22:00",
    workDays: JSON.stringify(["Monday","Tuesday","Wednesday","Thursday","Friday"]),
  }).returning().then(r => r[0]);

  const shiftMalam = await db.insert(shifts).values({
    id: randomUUID(),
    name: "Shift Malam",
    startTime: "22:00",
    endTime: "06:00",
    workDays: JSON.stringify(["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]),
  }).returning().then(r => r[0]);

  console.log(`   ✅ Dibuat: ${shiftPagi.name}, ${shiftSore.name}, ${shiftMalam.name}`);

  // ── 2. Buat Employees ───────────────────────────────────────────────────────
  console.log("\n👷 Membuat data karyawan...");
  const createdEmployees: any[] = [];

  for (const emp of employeeData) {
    const created = await db.insert(employees).values({
      id: randomUUID(),
      ...emp,
      photoUrl: null,
    }).returning().then(r => r[0]);
    createdEmployees.push(created);
    console.log(`   ✅ ${created.name} (${created.department})`);
  }

  // ── 3. Assign Shifts ke Karyawan ────────────────────────────────────────────
  console.log("\n🕐 Assign shift ke karyawan...");
  for (let i = 0; i < createdEmployees.length; i++) {
    const emp = createdEmployees[i];
    // IT = pagi, Finance = pagi, HR = sore (variasi)
    let targetShift = shiftPagi;
    if (emp.department === "Human Resources") targetShift = shiftSore;
    if (emp.department === "Finance & Accounting" && i % 3 === 2) targetShift = shiftMalam;

    await db.insert(employeeShifts).values({
      id: randomUUID(),
      employeeId: emp.id,
      shiftId: targetShift.id,
      effectiveDate: dateStr(30), // berlaku dari 30 hari lalu
    });
    console.log(`   ✅ ${emp.name} → ${targetShift.name}`);
  }

  // ── 4. Buat Data Attendance (7 hari terakhir, hari kerja) ───────────────────
  console.log("\n📅 Membuat data absensi 7 hari terakhir...");
  const attendanceStatuses: Record<number, string> = {
    0: "hadir", 1: "hadir", 2: "hadir", 3: "hadir", 4: "hadir",
    5: "hadir", 6: "hadir",
  };

  for (let day = 1; day <= 7; day++) {
    const dateString = dateStr(day);
    const dayOfWeek = new Date(dateString).getDay(); // 0=Sun, 6=Sat

    // Skip weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    for (let i = 0; i < createdEmployees.length; i++) {
      const emp = createdEmployees[i];

      // Simulasi: 1 karyawan per hari tidak hadir (cuti/izin) secara rotasi
      const isAbsent = (i + day) % 7 === 0;
      // Simulasi: 2 karyawan terlambat per hari
      const isLate = (i + day) % 5 === 0;

      if (isAbsent) {
        // Skip — tidak membuat record absensi (izin/alpha)
        continue;
      }

      // Check-in time
      const checkInHour = isLate ? 9 : 8;
      const checkInMinute = isLate ? Math.floor(Math.random() * 30) + 5 : Math.floor(Math.random() * 20);

      // Check-out time (beberapa masih belum check-out jika hari ini)
      const checkIn = toTimestamp(dateString, checkInHour, checkInMinute);
      const checkOut = day === 1
        ? null // hari ini (kemarin), mungkin belum checkout
        : toTimestamp(dateString, 17, Math.floor(Math.random() * 30));

      await db.insert(attendance).values({
        id: randomUUID(),
        employeeId: emp.id,
        checkIn,
        checkOut,
        date: dateString,
        method: "rfid+fingerprint",
      });
    }
    console.log(`   ✅ Absensi tanggal ${dateString} selesai`);
  }

  // ── 5. Buat Leave Balances (Saldo Cuti 2026) ───────────────────────────────
  console.log("\n📊 Membuat saldo cuti 2026...");
  for (const emp of createdEmployees) {
    const annualUsed = Math.floor(Math.random() * 4); // 0-3 hari terpakai
    const sickUsed = Math.floor(Math.random() * 3);   // 0-2 hari sakit

    await db.insert(leaveBalances).values({
      id: randomUUID(),
      employeeId: emp.id,
      year: 2026,
      annualTotal: 12,
      annualUsed,
      sickTotal: 30,
      sickUsed,
    });
    console.log(`   ✅ ${emp.name}: cuti=${annualUsed}/12, sakit=${sickUsed}/30`);
  }

  // ── 6. Buat Leave Requests (beberapa pengajuan cuti) ───────────────────────
  console.log("\n📝 Membuat pengajuan cuti...");
  const leaveTypes = ["annual", "sick", "permit"];
  const leaveStatuses = ["approved", "approved", "pending", "rejected", "approved"];

  const leaveData = [
    {
      empIdx: 0,  // Ahmad Fauzi
      type: "annual",
      startDate: dateStr(10),
      endDate: dateStr(8),
      reason: "Liburan keluarga ke Bali",
      status: "approved",
    },
    {
      empIdx: 1,  // Budi Santoso
      type: "sick",
      startDate: dateStr(5),
      endDate: dateStr(4),
      reason: "Demam dan flu berat",
      status: "approved",
    },
    {
      empIdx: 4,  // Eka Rahayu
      type: "permit",
      startDate: dateStr(3),
      endDate: dateStr(3),
      reason: "Keperluan keluarga mendesak",
      status: "pending",
    },
    {
      empIdx: 7,  // Hendra Wijaya
      type: "annual",
      startDate: dateStr(2),
      endDate: dateStr(1),
      reason: "Acara pernikahan saudara",
      status: "approved",
    },
    {
      empIdx: 2,  // Citra Dewi
      type: "sick",
      startDate: dateStr(1),
      endDate: dateStr(0),
      reason: "Sakit perut, perlu istirahat",
      status: "pending",
    },
    {
      empIdx: 6,  // Gita Permata
      type: "annual",
      startDate: dateStr(15),
      endDate: dateStr(13),
      reason: "Mudik lebaran",
      status: "rejected",
    },
    {
      empIdx: 9,  // Joko Sulistyo
      type: "permit",
      startDate: dateStr(7),
      endDate: dateStr(7),
      reason: "Mengurus administrasi kependudukan",
      status: "approved",
    },
  ];

  for (const leave of leaveData) {
    const emp = createdEmployees[leave.empIdx];
    await db.insert(leaveRequests).values({
      id: randomUUID(),
      employeeId: emp.id,
      type: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason,
      status: leave.status,
      notes: leave.status === "rejected" ? "Kuota cuti bulan ini sudah penuh" : null,
      approvedBy: null,
    });
    console.log(`   ✅ ${emp.name}: ${leave.type} (${leave.status})`);
  }

  // ── 7. Buat User Login untuk setiap karyawan ───────────────────────────────
  console.log("\n🔑 Membuat akun login karyawan...");
  for (const emp of createdEmployees) {
    // username = lowercase nama depan + employeeId
    const firstName = emp.name.split(" ")[0].toLowerCase();
    const username = `${firstName}.${emp.employeeId.toLowerCase().replace("-", "")}`;
    const hashedPwd = await hashPassword("karyawan123");

    await db.insert(users).values({
      id: randomUUID(),
      username,
      password: hashedPwd,
      role: "employee",
      employeeId: emp.id,
    });
    console.log(`   ✅ Login: ${username} / karyawan123`);
  }

  console.log("\n✨ Seeding selesai! Ringkasan:");
  console.log(`   👷 Karyawan    : ${createdEmployees.length} orang`);
  console.log(`   🏢 Departemen  : IT & Engineering, Finance & Accounting, Human Resources`);
  console.log(`   📋 Shift       : 3 shift (Pagi, Sore, Malam)`);
  console.log(`   📅 Absensi     : 7 hari terakhir (hari kerja)`);
  console.log(`   📊 Leave Balance: ${createdEmployees.length} karyawan (tahun 2026)`);
  console.log(`   📝 Pengajuan Cuti: 7 data (approved/pending/rejected)`);
  console.log(`   🔑 User Login  : ${createdEmployees.length} akun (password: karyawan123)`);

  await client.end();
}

main().catch((err) => {
  console.error("❌ Error saat seeding:", err);
  process.exit(1);
});
