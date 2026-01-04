import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Employee table
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  employeeId: text("employee_id").notNull().unique(),
  department: text("department").notNull(),
  rfidId: text("rfid_id").unique(),
  fingerprintId: integer("fingerprint_id"),
  photoUrl: text("photo_url"),
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// Attendance table
export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey(),
  employeeId: varchar("employee_id").notNull(),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  date: text("date").notNull(),
  method: text("method").notNull(), // "rfid+fingerprint"
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

// Pending RFID scan for registration
export interface PendingRfidScan {
  rfidId: string;
  fingerId?: number;
  scannedAt: Date;
}

// ESP32 API response types
export interface EspScanResponse {
  status: string;
  message: string;
  requireFingerprint?: boolean;
}

export interface EspFingerprintResponse {
  status: string;
  message: string;
}

// Attendance with employee details for display
export interface AttendanceWithEmployee extends Attendance {
  employee?: Employee;
}
