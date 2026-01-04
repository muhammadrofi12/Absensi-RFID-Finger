import type { Employee, InsertEmployee, Attendance, InsertAttendance, AttendanceWithEmployee, PendingRfidScan } from "@shared/schema";
import { randomUUID } from "crypto";

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
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, data: Partial<Attendance>): Promise<Attendance | undefined>;

  // ESP32 Pending RFID
  setPendingRfid(rfidId: string): void;
  setPendingFingerId(fingerId: number): boolean;
  getPendingRfid(): PendingRfidScan | null;
  clearPendingRfid(): void;
}

export class MemStorage implements IStorage {
  private employees: Map<string, Employee>;
  private attendance: Map<string, Attendance>;
  private pendingRfid: PendingRfidScan | null;

  constructor() {
    this.employees = new Map();
    this.attendance = new Map();
    this.pendingRfid = null;
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
    const employee: Employee = { ...insertEmployee, id };
    this.employees.set(id, employee);
    return employee;
  }

  async updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const employee = this.employees.get(id);
    if (!employee) return undefined;
    const updated = { ...employee, ...data };
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
        const timeA = a.checkOut ? new Date(a.checkOut).getTime() : a.checkIn ? new Date(a.checkIn).getTime() : 0;
        const timeB = b.checkOut ? new Date(b.checkOut).getTime() : b.checkIn ? new Date(b.checkIn).getTime() : 0;
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
    const record: Attendance = { ...insertAttendance, id };
    this.attendance.set(id, record);
    console.log(`✓ Attendance created: ${record.employeeId} - ${record.date}`);
    console.log(`  Attendance Map size: ${this.attendance.size}`);
    return record;
  }

  async updateAttendance(id: string, data: Partial<Attendance>): Promise<Attendance | undefined> {
    const record = this.attendance.get(id);
    if (!record) return undefined;
    const updated = { ...record, ...data };
    this.attendance.set(id, updated);
    console.log(`✓ Attendance updated: ${id}`);
    return updated;
  }

  // ============ PENDING RFID ============
  setPendingRfid(rfidId: string): void {
    this.pendingRfid = { rfidId, scannedAt: new Date() };
  }

  setPendingFingerId(fingerId: number): boolean {
    if (!this.pendingRfid) return false;
    this.pendingRfid.fingerId = fingerId;
    this.pendingRfid.scannedAt = new Date(); // refresh timestamp
    return true;
  }

  getPendingRfid(): PendingRfidScan | null {
    if (!this.pendingRfid) return null;
    const elapsed = Date.now() - this.pendingRfid.scannedAt.getTime();
    if (elapsed > 60000) { // extended to 60 seconds for fingerprint enrollment
      this.pendingRfid = null;
      return null;
    }
    return this.pendingRfid;
  }

  clearPendingRfid(): void {
    this.pendingRfid = null;
  }
}

export const storage = new MemStorage();
