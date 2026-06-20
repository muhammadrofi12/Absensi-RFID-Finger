import type {
  Employee,
  InsertEmployee,
  Attendance,
  InsertAttendance,
  AttendanceWithEmployee,
  PendingRfidScan,
  User,
  InsertUser,
  LeaveRequest,
  InsertLeaveRequest,
  LeaveBalance,
  InsertLeaveBalance,
  Shift,
  InsertShift,
  EmployeeShift,
  InsertEmployeeShift,
} from "@shared/schema";
import { employees, attendance, users, leaveRequests, leaveBalances, shifts, employeeShifts } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "./db";

// ============================================================
// STORAGE INTERFACE
// ============================================================
export interface IStorage {
  // Employees
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployeeByRfid(rfidId: string): Promise<Employee | undefined>;
  getEmployeeByFingerprintId(fingerprintId: number): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;

  // Attendance
  getAttendance(): Promise<AttendanceWithEmployee[]>;
  getAttendanceToday(): Promise<AttendanceWithEmployee[]>;
  getRecentAttendance(limit: number): Promise<AttendanceWithEmployee[]>;
  getTodayAttendanceForEmployee(employeeId: string): Promise<Attendance | undefined>;
  createAttendance(insertAttendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, data: Partial<Attendance>): Promise<Attendance | undefined>;

  // ESP32 Pending RFID (always in-memory — temporary state)
  setPendingRfid(rfidId: string): void;
  getPendingRfid(): PendingRfidScan | null;
  clearPendingRfid(): void;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { id?: string }): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  // Leave Requests
  getLeaveRequests(): Promise<LeaveRequest[]>;
  getLeaveRequestsByEmployee(employeeId: string): Promise<LeaveRequest[]>;
  createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest>;
  updateLeaveRequestStatus(id: string, status: string, approvedBy?: string, notes?: string): Promise<LeaveRequest | undefined>;

  // Leave Balances
  getLeaveBalances(): Promise<LeaveBalance[]>;
  getLeaveBalance(employeeId: string, year: number): Promise<LeaveBalance | undefined>;
  createLeaveBalance(balance: InsertLeaveBalance): Promise<LeaveBalance>;
  updateLeaveBalance(id: string, data: Partial<LeaveBalance>): Promise<LeaveBalance | undefined>;

  // Shifts
  getShifts(): Promise<Shift[]>;
  getShift(id: string): Promise<Shift | undefined>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: string, data: Partial<Shift>): Promise<Shift | undefined>;
  deleteShift(id: string): Promise<boolean>;

  // Employee Shifts
  getEmployeeShifts(): Promise<EmployeeShift[]>;
  getEmployeeShift(id: string): Promise<EmployeeShift | undefined>;
  getEmployeeShiftByEmployee(employeeId: string): Promise<EmployeeShift | undefined>;
  assignEmployeeShift(assignment: InsertEmployeeShift): Promise<EmployeeShift>;
}

// ============================================================
// DRIZZLE STORAGE (Supabase PostgreSQL)
// ============================================================
export class DrizzleStorage implements IStorage {
  private pendingRfid: PendingRfidScan | null = null;
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  // Helper: enrich attendance with employee data
  private async enrichAttendance(record: Attendance): Promise<AttendanceWithEmployee> {
    const [employee] = await this.db
      .select()
      .from(employees)
      .where(eq(employees.id, record.employeeId));
    return { ...record, employee: employee ?? undefined };
  }

  // ============ EMPLOYEES ============

  async getEmployees(): Promise<Employee[]> {
    return await this.db.select().from(employees);
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [result] = await this.db
      .select()
      .from(employees)
      .where(eq(employees.id, id));
    return result ?? undefined;
  }

  async getEmployeeByRfid(rfidId: string): Promise<Employee | undefined> {
    const all = await this.db.select().from(employees);
    return all.find(
      (emp: Employee) => emp.rfidId?.toUpperCase() === rfidId.toUpperCase()
    );
  }

  async getEmployeeByFingerprintId(fingerprintId: number): Promise<Employee | undefined> {
    const all = await this.db.select().from(employees);
    return all.find((emp: Employee) => emp.fingerprintId === fingerprintId);
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = randomUUID();
    const [created] = await this.db
      .insert(employees)
      .values({ ...insertEmployee, id })
      .returning();
    return created;
  }

  async updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [updated] = await this.db
      .update(employees)
      .set(data)
      .where(eq(employees.id, id))
      .returning();
    return updated ?? undefined;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const result = await this.db
      .delete(employees)
      .where(eq(employees.id, id))
      .returning();
    return result.length > 0;
  }

  // ============ ATTENDANCE ============

  async getAttendance(): Promise<AttendanceWithEmployee[]> {
    const records = await this.db
      .select()
      .from(attendance)
      .orderBy(desc(attendance.checkIn));

    return Promise.all(records.map((r: Attendance) => this.enrichAttendance(r)));
  }

  async getAttendanceToday(): Promise<AttendanceWithEmployee[]> {
    const today = new Date().toISOString().split("T")[0];
    const records = await this.db
      .select()
      .from(attendance)
      .where(eq(attendance.date, today));

    return Promise.all(records.map((r: Attendance) => this.enrichAttendance(r)));
  }

  async getRecentAttendance(limit: number): Promise<AttendanceWithEmployee[]> {
    const records = await this.db
      .select()
      .from(attendance)
      .orderBy(desc(attendance.checkIn))
      .limit(limit);

    return Promise.all(records.map((r: Attendance) => this.enrichAttendance(r)));
  }

  async getTodayAttendanceForEmployee(employeeId: string): Promise<Attendance | undefined> {
    const today = new Date().toISOString().split("T")[0];
    const all = await this.db
      .select()
      .from(attendance)
      .where(eq(attendance.date, today));

    return all.find((a: Attendance) => a.employeeId === employeeId);
  }

  async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const id = randomUUID();
    const [created] = await this.db
      .insert(attendance)
      .values({ ...insertAttendance, id })
      .returning();

    console.log(`✓ [Supabase] Attendance created: ${created.employeeId} - ${created.date}`);
    return created;
  }

  async updateAttendance(id: string, data: Partial<Attendance>): Promise<Attendance | undefined> {
    const [updated] = await this.db
      .update(attendance)
      .set(data)
      .where(eq(attendance.id, id))
      .returning();

    console.log(`✓ [Supabase] Attendance updated: ${id}`);
    return updated ?? undefined;
  }

  // ============ PENDING RFID (always in-memory) ============

  setPendingRfid(rfidId: string): void {
    this.pendingRfid = { rfidId, scannedAt: new Date() };
  }

  getPendingRfid(): PendingRfidScan | null {
    if (!this.pendingRfid) return null;
    const elapsed = Date.now() - this.pendingRfid.scannedAt.getTime();
    if (elapsed > 30000) {
      this.pendingRfid = null;
      return null;
    }
    return this.pendingRfid;
  }

  clearPendingRfid(): void {
    this.pendingRfid = null;
  }

  // ============ USERS ============
  async getUser(id: string): Promise<User | undefined> {
    const [result] = await this.db.select().from(users).where(eq(users.id, id));
    return result ?? undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [result] = await this.db.select().from(users).where(eq(users.username, username));
    return result ?? undefined;
  }

  async createUser(insertUser: InsertUser & { id?: string }): Promise<User> {
    const id = insertUser.id || randomUUID();
    const [created] = await this.db
      .insert(users)
      .values({ ...insertUser, id })
      .returning();
    return created;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await this.db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updated ?? undefined;
  }

  // ============ LEAVE REQUESTS ============
  async getLeaveRequests(): Promise<LeaveRequest[]> {
    return await this.db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
  }

  async getLeaveRequestsByEmployee(employeeId: string): Promise<LeaveRequest[]> {
    return await this.db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.employeeId, employeeId))
      .orderBy(desc(leaveRequests.createdAt));
  }

  async createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest> {
    const id = randomUUID();
    const [created] = await this.db
      .insert(leaveRequests)
      .values({ ...request, id })
      .returning();
    return created;
  }

  async updateLeaveRequestStatus(id: string, status: string, approvedBy?: string, notes?: string): Promise<LeaveRequest | undefined> {
    const [updated] = await this.db
      .update(leaveRequests)
      .set({ status, approvedBy, notes })
      .where(eq(leaveRequests.id, id))
      .returning();
    return updated ?? undefined;
  }

  // ============ LEAVE BALANCES ============
  async getLeaveBalances(): Promise<LeaveBalance[]> {
    return await this.db.select().from(leaveBalances);
  }

  async getLeaveBalance(employeeId: string, year: number): Promise<LeaveBalance | undefined> {
    const [result] = await this.db
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, year)));
    return result ?? undefined;
  }

  async createLeaveBalance(balance: InsertLeaveBalance): Promise<LeaveBalance> {
    const id = randomUUID();
    const [created] = await this.db
      .insert(leaveBalances)
      .values({ ...balance, id })
      .returning();
    return created;
  }

  async updateLeaveBalance(id: string, data: Partial<LeaveBalance>): Promise<LeaveBalance | undefined> {
    const [updated] = await this.db
      .update(leaveBalances)
      .set(data)
      .where(eq(leaveBalances.id, id))
      .returning();
    return updated ?? undefined;
  }

  // ============ SHIFTS ============
  async getShifts(): Promise<Shift[]> {
    return await this.db.select().from(shifts);
  }

  async getShift(id: string): Promise<Shift | undefined> {
    const [result] = await this.db.select().from(shifts).where(eq(shifts.id, id));
    return result ?? undefined;
  }

  async createShift(shift: InsertShift): Promise<Shift> {
    const id = randomUUID();
    const [created] = await this.db
      .insert(shifts)
      .values({ ...shift, id })
      .returning();
    return created;
  }

  async updateShift(id: string, data: Partial<Shift>): Promise<Shift | undefined> {
    const [updated] = await this.db
      .update(shifts)
      .set(data)
      .where(eq(shifts.id, id))
      .returning();
    return updated ?? undefined;
  }

  async deleteShift(id: string): Promise<boolean> {
    const result = await this.db.delete(shifts).where(eq(shifts.id, id)).returning();
    return result.length > 0;
  }

  // ============ EMPLOYEE SHIFTS ============
  async getEmployeeShifts(): Promise<EmployeeShift[]> {
    return await this.db.select().from(employeeShifts);
  }

  async getEmployeeShift(id: string): Promise<EmployeeShift | undefined> {
    const [result] = await this.db.select().from(employeeShifts).where(eq(employeeShifts.id, id));
    return result ?? undefined;
  }

  async getEmployeeShiftByEmployee(employeeId: string): Promise<EmployeeShift | undefined> {
    const [result] = await this.db
      .select()
      .from(employeeShifts)
      .where(eq(employeeShifts.employeeId, employeeId))
      .orderBy(desc(employeeShifts.effectiveDate))
      .limit(1);
    return result ?? undefined;
  }

  async assignEmployeeShift(assignment: InsertEmployeeShift): Promise<EmployeeShift> {
    const id = randomUUID();
    const [created] = await this.db
      .insert(employeeShifts)
      .values({ ...assignment, id })
      .returning();
    return created;
  }
}

// ============================================================
// IN-MEMORY STORAGE (Fallback jika tidak ada DATABASE_URL)
// ============================================================
export class MemStorage implements IStorage {
  private employees: Map<string, Employee>;
  private attendance: Map<string, Attendance>;
  private pendingRfid: PendingRfidScan | null;
  private usersMap: Map<string, User>;
  private leaveRequestsMap: Map<string, LeaveRequest>;
  private leaveBalancesMap: Map<string, LeaveBalance>;
  private shiftsMap: Map<string, Shift>;
  private employeeShiftsMap: Map<string, EmployeeShift>;

  constructor() {
    this.employees = new Map();
    this.attendance = new Map();
    this.pendingRfid = null;
    this.usersMap = new Map();
    this.leaveRequestsMap = new Map();
    this.leaveBalancesMap = new Map();
    this.shiftsMap = new Map();
    this.employeeShiftsMap = new Map();
  }

  // ============ EMPLOYEES ============
  async getEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values());
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async getEmployeeByRfid(rfidId: string): Promise<Employee | undefined> {
    return Array.from(this.employees.values()).find(
      (emp) => emp.rfidId?.toUpperCase() === rfidId.toUpperCase()
    );
  }

  async getEmployeeByFingerprintId(fingerprintId: number): Promise<Employee | undefined> {
    return Array.from(this.employees.values()).find(
      (emp) => emp.fingerprintId === fingerprintId
    );
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = randomUUID();
    const employee: Employee = { ...insertEmployee, id } as any;
    this.employees.set(id, employee);
    return employee;
  }

  async updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const employee = this.employees.get(id);
    if (!employee) return undefined;
    const updated = { ...employee, ...data } as any;
    this.employees.set(id, updated);
    return updated;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    return this.employees.delete(id);
  }

  // ============ ATTENDANCE ============
  private enrichAttendance(record: Attendance): AttendanceWithEmployee {
    const employee = this.employees.get(record.employeeId);
    return { ...record, employee };
  }

  async getAttendance(): Promise<AttendanceWithEmployee[]> {
    return Array.from(this.attendance.values())
      .map((a) => this.enrichAttendance(a))
      .sort((a, b) => {
        const dateA = a.checkIn ? new Date(a.checkIn).getTime() : 0;
        const dateB = b.checkIn ? new Date(b.checkIn).getTime() : 0;
        return dateB - dateA;
      });
  }

  async getAttendanceToday(): Promise<AttendanceWithEmployee[]> {
    const today = new Date().toISOString().split("T")[0];
    return Array.from(this.attendance.values())
      .filter((a) => a.date === today)
      .map((a) => this.enrichAttendance(a));
  }

  async getRecentAttendance(limit: number): Promise<AttendanceWithEmployee[]> {
    return Array.from(this.attendance.values())
      .map((a) => this.enrichAttendance(a))
      .sort((a, b) => {
        const timeA = a.checkOut
          ? new Date(a.checkOut).getTime()
          : a.checkIn
            ? new Date(a.checkIn).getTime()
            : 0;
        const timeB = b.checkOut
          ? new Date(b.checkOut).getTime()
          : b.checkIn
            ? new Date(b.checkIn).getTime()
            : 0;
        return timeB - timeA;
      })
      .slice(0, limit);
  }

  async getTodayAttendanceForEmployee(employeeId: string): Promise<Attendance | undefined> {
    const today = new Date().toISOString().split("T")[0];
    return Array.from(this.attendance.values()).find(
      (a) => a.employeeId === employeeId && a.date === today
    );
  }

  async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const id = randomUUID();
    const record: Attendance = { ...insertAttendance, id } as any;
    this.attendance.set(id, record);
    console.log(`✓ [Memory] Attendance created: ${record.employeeId} - ${record.date}`);
    return record;
  }

  async updateAttendance(id: string, data: Partial<Attendance>): Promise<Attendance | undefined> {
    const record = this.attendance.get(id);
    if (!record) return undefined;
    const updated = { ...record, ...data } as any;
    this.attendance.set(id, updated);
    console.log(`✓ [Memory] Attendance updated: ${id}`);
    return updated;
  }

  // ============ PENDING RFID ============
  setPendingRfid(rfidId: string): void {
    this.pendingRfid = { rfidId, scannedAt: new Date() };
  }

  getPendingRfid(): PendingRfidScan | null {
    if (!this.pendingRfid) return null;
    const elapsed = Date.now() - this.pendingRfid.scannedAt.getTime();
    if (elapsed > 30000) {
      this.pendingRfid = null;
      return null;
    }
    return this.pendingRfid;
  }

  clearPendingRfid(): void {
    this.pendingRfid = null;
  }

  // ============ USERS ============
  async getUser(id: string): Promise<User | undefined> {
    return this.usersMap.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find((u) => u.username === username);
  }

  async createUser(insertUser: InsertUser & { id?: string }): Promise<User> {
    const id = insertUser.id || randomUUID();
    const user: User = { ...insertUser, id } as any;
    this.usersMap.set(id, user);
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const user = this.usersMap.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data } as any;
    this.usersMap.set(id, updated);
    return updated;
  }

  // ============ LEAVE REQUESTS ============
  async getLeaveRequests(): Promise<LeaveRequest[]> {
    return Array.from(this.leaveRequestsMap.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getLeaveRequestsByEmployee(employeeId: string): Promise<LeaveRequest[]> {
    return Array.from(this.leaveRequestsMap.values())
      .filter((r) => r.employeeId === employeeId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest> {
    const id = randomUUID();
    const record: LeaveRequest = { ...request, id, createdAt: new Date() } as any;
    this.leaveRequestsMap.set(id, record);
    return record;
  }

  async updateLeaveRequestStatus(id: string, status: string, approvedBy?: string, notes?: string): Promise<LeaveRequest | undefined> {
    const record = this.leaveRequestsMap.get(id);
    if (!record) return undefined;
    const updated = { ...record, status, approvedBy: approvedBy || null, notes: notes || null } as any;
    this.leaveRequestsMap.set(id, updated);
    return updated;
  }

  // ============ LEAVE BALANCES ============
  async getLeaveBalances(): Promise<LeaveBalance[]> {
    return Array.from(this.leaveBalancesMap.values());
  }

  async getLeaveBalance(employeeId: string, year: number): Promise<LeaveBalance | undefined> {
    return Array.from(this.leaveBalancesMap.values()).find((b) => b.employeeId === employeeId && b.year === year);
  }

  async createLeaveBalance(balance: InsertLeaveBalance): Promise<LeaveBalance> {
    const id = randomUUID();
    const record: LeaveBalance = { ...balance, id } as any;
    this.leaveBalancesMap.set(id, record);
    return record;
  }

  async updateLeaveBalance(id: string, data: Partial<LeaveBalance>): Promise<LeaveBalance | undefined> {
    const record = this.leaveBalancesMap.get(id);
    if (!record) return undefined;
    const updated = { ...record, ...data } as any;
    this.leaveBalancesMap.set(id, updated);
    return updated;
  }

  // ============ SHIFTS ============
  async getShifts(): Promise<Shift[]> {
    return Array.from(this.shiftsMap.values());
  }

  async getShift(id: string): Promise<Shift | undefined> {
    return this.shiftsMap.get(id);
  }

  async createShift(shift: InsertShift): Promise<Shift> {
    const id = randomUUID();
    const record: Shift = { ...shift, id } as any;
    this.shiftsMap.set(id, record);
    return record;
  }

  async updateShift(id: string, data: Partial<Shift>): Promise<Shift | undefined> {
    const record = this.shiftsMap.get(id);
    if (!record) return undefined;
    const updated = { ...record, ...data } as any;
    this.shiftsMap.set(id, updated);
    return updated;
  }

  async deleteShift(id: string): Promise<boolean> {
    return this.shiftsMap.delete(id);
  }

  // ============ EMPLOYEE SHIFTS ============
  async getEmployeeShifts(): Promise<EmployeeShift[]> {
    return Array.from(this.employeeShiftsMap.values());
  }

  async getEmployeeShift(id: string): Promise<EmployeeShift | undefined> {
    return this.employeeShiftsMap.get(id);
  }

  async getEmployeeShiftByEmployee(employeeId: string): Promise<EmployeeShift | undefined> {
    const records = Array.from(this.employeeShiftsMap.values()).filter((es) => es.employeeId === employeeId);
    if (records.length === 0) return undefined;
    return records.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  }

  async assignEmployeeShift(assignment: InsertEmployeeShift): Promise<EmployeeShift> {
    const id = randomUUID();
    const record: EmployeeShift = { ...assignment, id } as any;
    this.employeeShiftsMap.set(id, record);
    return record;
  }
}

// ============================================================
// EXPORT: Otomatis pilih storage berdasarkan DATABASE_URL
// ============================================================
function createStorage(): IStorage {
  if (process.env.DATABASE_URL && db) {
    console.log("✅ [Storage] Menggunakan Supabase PostgreSQL");
    return new DrizzleStorage(db);
  } else {
    console.warn("⚠️  [Storage] DATABASE_URL tidak ditemukan, menggunakan In-Memory Storage");
    console.warn("⚠️  Data akan hilang saat server restart!");
    return new MemStorage();
  }
}

export const storage = createStorage();
