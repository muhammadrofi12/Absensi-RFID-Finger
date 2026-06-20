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

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("employee"), // "admin" | "employee"
  employeeId: varchar("employee_id").references(() => employees.id),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Leave Requests table
export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey(),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  type: text("type").notNull(), // "annual", "sick", "permit", "maternity"
  startDate: text("start_date").notNull(), // "YYYY-MM-DD"
  endDate: text("end_date").notNull(), // "YYYY-MM-DD"
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // "pending", "approved", "rejected"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  notes: text("notes"),
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, createdAt: true });
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;

// Leave Balances table
export const leaveBalances = pgTable("leave_balances", {
  id: varchar("id").primaryKey(),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  year: integer("year").notNull(),
  annualTotal: integer("annual_total").notNull().default(12),
  annualUsed: integer("annual_used").notNull().default(0),
  sickTotal: integer("sick_total").notNull().default(30),
  sickUsed: integer("sick_used").notNull().default(0),
});

export const insertLeaveBalanceSchema = createInsertSchema(leaveBalances).omit({ id: true });
export type InsertLeaveBalance = z.infer<typeof insertLeaveBalanceSchema>;
export type LeaveBalance = typeof leaveBalances.$inferSelect;

// Shifts table
export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(), // "HH:MM"
  endTime: text("end_time").notNull(), // "HH:MM"
  workDays: text("work_days").notNull(), // JSON string: '["Monday","Tuesday","Wednesday","Thursday","Friday"]'
});

export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;

// Employee Shifts table
export const employeeShifts = pgTable("employee_shifts", {
  id: varchar("id").primaryKey(),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  shiftId: varchar("shift_id").references(() => shifts.id).notNull(),
  effectiveDate: text("effective_date").notNull(), // "YYYY-MM-DD"
});

export const insertEmployeeShiftSchema = createInsertSchema(employeeShifts).omit({ id: true });
export type InsertEmployeeShift = z.infer<typeof insertEmployeeShiftSchema>;
export type EmployeeShift = typeof employeeShifts.$inferSelect;

