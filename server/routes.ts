import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertEmployeeSchema, users } from "@shared/schema";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "./db";

let registerMode = false;

// Validate request body helper
function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============================================================
  // WEBSOCKET SERVER SETUP
  // ============================================================
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    console.log("[WebSocket] Client connected");
    ws.send(JSON.stringify({ type: "INFO", message: "Connected to WebSocket Server" }));
  });

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // ============================================================
  // USER MANAGEMENT ROUTES
  // ============================================================

  // Enable/Create Web Login for Employee (Admin only)
  app.post("/api/users", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    const { employeeId, username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username dan password wajib diisi" });
    }
    try {
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username sudah digunakan" });
      }
      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role: role || "employee",
        employeeId: employeeId || null,
      });
      res.status(201).json({ id: user.id, username: user.username, role: user.role, employeeId: user.employeeId });
    } catch (error) {
      res.status(500).json({ message: "Gagal membuat user", error });
    }
  });

  // Get list of all users (Admin only)
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    try {
      let allUsers;
      if (process.env.DATABASE_URL && db) {
        allUsers = await db.select().from(users);
      } else {
        allUsers = Array.from((storage as any).usersMap.values());
      }
      
      const sanitized = allUsers.map((u: any) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        employeeId: u.employeeId
      }));
      res.json(sanitized);
    } catch (error) {
      res.status(500).json({ message: "Gagal mengambil data user", error });
    }
  });

  // ============================================================
  // LEAVE MANAGEMENT ROUTES
  // ============================================================

  // Submit leave request (Employee/Admin)
  app.post("/api/leave", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Belum login" });
    }
    
    const user = req.user as any;
    const { employeeId, type, startDate, endDate, reason } = req.body;
    
    let targetEmployeeId = employeeId;
    if (user.role === "employee") {
      if (!user.employeeId) {
        return res.status(400).json({ message: "Akun Anda tidak terhubung ke data karyawan" });
      }
      targetEmployeeId = user.employeeId;
    }
    
    if (!targetEmployeeId || !type || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }
    
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      const year = start.getFullYear();
      let balance = await storage.getLeaveBalance(targetEmployeeId, year);
      
      if (!balance) {
        balance = await storage.createLeaveBalance({
          employeeId: targetEmployeeId,
          year,
          annualTotal: 12,
          annualUsed: 0,
          sickTotal: 30,
          sickUsed: 0
        });
      }
      
      if (type === "annual" && (balance.annualTotal - balance.annualUsed) < diffDays) {
        return res.status(400).json({ message: `Saldo cuti tahunan tidak mencukupi (Tersisa: ${balance.annualTotal - balance.annualUsed} hari, mengajukan: ${diffDays} hari)` });
      }
      
      const request = await storage.createLeaveRequest({
        employeeId: targetEmployeeId,
        type,
        startDate,
        endDate,
        reason,
        status: "pending",
        approvedBy: null,
        notes: null
      });
      
      res.status(201).json(request);
    } catch (error) {
      res.status(500).json({ message: "Gagal membuat pengajuan cuti", error });
    }
  });

  // Get leave requests
  app.get("/api/leave", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Belum login" });
    }
    
    const user = req.user as any;
    try {
      let list;
      if (user.role === "admin") {
        list = await storage.getLeaveRequests();
      } else {
        if (!user.employeeId) {
          return res.json([]);
        }
        list = await storage.getLeaveRequestsByEmployee(user.employeeId);
      }
      
      const enriched = await Promise.all(list.map(async (item) => {
        const emp = await storage.getEmployee(item.employeeId);
        return {
          ...item,
          employeeName: emp?.name || "-",
          employeeIdCode: emp?.employeeId || "-",
          department: emp?.department || "-"
        };
      }));
      
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: "Gagal mengambil data cuti", error });
    }
  });

  // Approve leave request (Admin only)
  app.post("/api/leave/:id/approve", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    
    const { notes } = req.body;
    const adminUser = req.user as any;
    
    try {
      const requests = await storage.getLeaveRequests();
      const targetRequest = requests.find(r => r.id === req.params.id);
      
      if (!targetRequest) {
        return res.status(404).json({ message: "Pengajuan cuti tidak ditemukan" });
      }
      
      if (targetRequest.status !== "pending") {
        return res.status(400).json({ message: "Pengajuan sudah diproses sebelumnya" });
      }
      
      const start = new Date(targetRequest.startDate);
      const end = new Date(targetRequest.endDate);
      const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      const year = start.getFullYear();
      let balance = await storage.getLeaveBalance(targetRequest.employeeId, year);
      if (!balance) {
        balance = await storage.createLeaveBalance({
          employeeId: targetRequest.employeeId,
          year,
          annualTotal: 12,
          annualUsed: 0,
          sickTotal: 30,
          sickUsed: 0
        });
      }
      
      if (balance) {
        if (targetRequest.type === "annual") {
          await storage.updateLeaveBalance(balance.id, {
            annualUsed: balance.annualUsed + diffDays
          });
        } else if (targetRequest.type === "sick") {
          await storage.updateLeaveBalance(balance.id, {
            sickUsed: balance.sickUsed + diffDays
          });
        }
      }
      
      const updated = await storage.updateLeaveRequestStatus(
        req.params.id,
        "approved",
        adminUser.id,
        notes || null
      );
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Gagal menyetujui cuti", error });
    }
  });

  // Reject leave request (Admin only)
  app.post("/api/leave/:id/reject", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    
    const { notes } = req.body;
    const adminUser = req.user as any;
    
    try {
      const updated = await storage.updateLeaveRequestStatus(
        req.params.id,
        "rejected",
        adminUser.id,
        notes || null
      );
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Gagal menolak cuti", error });
    }
  });

  // Get leave balances
  app.get("/api/leave/balances", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Belum login" });
    }
    
    const user = req.user as any;
    try {
      let list;
      if (user.role === "admin") {
        list = await storage.getLeaveBalances();
      } else {
        if (!user.employeeId) return res.json([]);
        const currentYear = new Date().getFullYear();
        let balance = await storage.getLeaveBalance(user.employeeId, currentYear);
        if (!balance) {
          balance = await storage.createLeaveBalance({
            employeeId: user.employeeId,
            year: currentYear,
            annualTotal: 12,
            annualUsed: 0,
            sickTotal: 30,
            sickUsed: 0
          });
        }
        list = [balance];
      }
      
      const enriched = await Promise.all(list.map(async (item) => {
        const emp = await storage.getEmployee(item.employeeId);
        return {
          ...item,
          employeeName: emp?.name || "-",
          employeeIdCode: emp?.employeeId || "-",
          department: emp?.department || "-"
        };
      }));
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: "Gagal mengambil data saldo cuti", error });
    }
  });

  // ============================================================
  // WORK SHIFT ROUTES
  // ============================================================

  // Get all shift templates
  app.get("/api/shifts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Belum login" });
    }
    try {
      const allShifts = await storage.getShifts();
      res.json(allShifts);
    } catch (error) {
      res.status(500).json({ message: "Gagal mengambil data shift", error });
    }
  });

  // Create shift template (Admin only)
  app.post("/api/shifts", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    const { name, startTime, endTime, workDays } = req.body;
    if (!name || !startTime || !endTime || !workDays) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }
    try {
      const shift = await storage.createShift({
        name,
        startTime,
        endTime,
        workDays: typeof workDays === "string" ? workDays : JSON.stringify(workDays)
      });
      res.status(201).json(shift);
    } catch (error) {
      res.status(500).json({ message: "Gagal membuat shift", error });
    }
  });

  // Assign shift to employee (Admin only)
  app.post("/api/shifts/assign", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    const { employeeId, shiftId, effectiveDate } = req.body;
    if (!employeeId || !shiftId || !effectiveDate) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }
    try {
      const assignment = await storage.assignEmployeeShift({
        employeeId,
        shiftId,
        effectiveDate
      });
      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ message: "Gagal menugaskan shift", error });
    }
  });

  // Get active shift assignment for employee
  app.get("/api/shifts/active/:employeeId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Belum login" });
    }
    try {
      const empShift = await storage.getEmployeeShiftByEmployee(req.params.employeeId);
      if (!empShift) {
        return res.json(null);
      }
      const shiftDetail = await storage.getShift(empShift.shiftId);
      res.json({
        ...empShift,
        shift: shiftDetail
      });
    } catch (error) {
      res.status(500).json({ message: "Gagal mengambil shift aktif", error });
    }
  });

  // Get all employee shift assignments (Admin only)
  app.get("/api/shifts/assignments", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    try {
      const list = await storage.getEmployeeShifts();
      const enriched = await Promise.all(list.map(async (item) => {
        const emp = await storage.getEmployee(item.employeeId);
        const shiftDetail = await storage.getShift(item.shiftId);
        return {
          ...item,
          employeeName: emp?.name || "-",
          employeeIdCode: emp?.employeeId || "-",
          department: emp?.department || "-",
          shift: shiftDetail
        };
      }));
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: "Gagal mengambil data jadwal shift", error });
    }
  });

  // ============================================================
  // REPORT EXPORT ROUTES
  // ============================================================

  // Export reports to Excel-compatible CSV format
  app.get("/api/attendance/export", async (req, res) => {
    try {
      const records = await storage.getAttendance();
      
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=laporan_kehadiran.csv");
      
      res.write("\ufeff");
      
      res.write("ID,Nama,NIP/Employee ID,Departemen,Check In,Check Out,Tanggal,Metode\n");
      
      for (const record of records) {
        const name = record.employee?.name || "-";
        const empId = record.employee?.employeeId || "-";
        const dept = record.employee?.department || "-";
        const checkIn = record.checkIn ? new Date(record.checkIn).toLocaleString("id-ID") : "-";
        const checkOut = record.checkOut ? new Date(record.checkOut).toLocaleString("id-ID") : "-";
        const date = record.date;
        const method = record.method;
        
        const escape = (str: string) => `"${str.replace(/"/g, '""')}"`;
        
        res.write(`${escape(record.id)},${escape(name)},${escape(empId)},${escape(dept)},${escape(checkIn)},${escape(checkOut)},${escape(date)},${escape(method)}\n`);
      }
      
      res.end();
    } catch (error) {
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // ============================================================
  // ADVANCED ANALYTICS ROUTES
  // ============================================================

  // Get admin-level dashboard analytics
  app.get("/api/analytics/dashboard", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    try {
      const allAttendance = await storage.getAttendance();
      const allEmployees = await storage.getEmployees();
      
      let lateCount = 0;
      let totalOnTime = 0;
      const departmentStats: Record<string, { total: number; present: number }> = {};
      
      allEmployees.forEach(emp => {
        if (emp.department) {
          if (!departmentStats[emp.department]) {
            departmentStats[emp.department] = { total: 0, present: 0 };
          }
          departmentStats[emp.department].total += 1;
        }
      });
      
      const today = new Date().toISOString().split("T")[0];
      const todayAttendance = allAttendance.filter(a => a.date === today);
      
      todayAttendance.forEach(att => {
        if (att.checkIn) {
          const checkInTime = new Date(att.checkIn);
          const hours = checkInTime.getHours();
          const minutes = checkInTime.getMinutes();
          // Assume standard check-in time is 08:00
          if (hours > 8 || (hours === 8 && minutes > 0)) {
            lateCount++;
          } else {
            totalOnTime++;
          }
        }
        
        if (att.employee?.department) {
          const dept = att.employee.department;
          if (!departmentStats[dept]) {
            departmentStats[dept] = { total: 1, present: 0 };
          }
          departmentStats[dept].present += 1;
        }
      });
      
      const dailyTrendMap: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        dailyTrendMap[dateStr] = 0;
      }
      
      allAttendance.forEach(a => {
        if (dailyTrendMap[a.date] !== undefined) {
          dailyTrendMap[a.date]++;
        }
      });
      
      const dailyTrend = Object.keys(dailyTrendMap).map(date => ({
        date,
        count: dailyTrendMap[date]
      })).sort((a, b) => a.date.localeCompare(b.date));
      
      const hourlyDistribution: Record<number, number> = {};
      for (let i = 6; i <= 18; i++) {
        hourlyDistribution[i] = 0;
      }
      
      allAttendance.forEach(a => {
        if (a.checkIn) {
          const hour = new Date(a.checkIn).getHours();
          if (hour >= 6 && hour <= 18) {
            hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
          }
        }
      });
      
      const hourlyStats = Object.keys(hourlyDistribution).map(hour => ({
        hour: `${hour}:00`,
        count: hourlyDistribution[Number(hour)]
      }));

      const allLeaves = await storage.getLeaveRequests();
      const pendingLeavesCount = allLeaves.filter(l => l.status === "pending").length;

      res.json({
        totalEmployees: allEmployees.length,
        todayPresent: todayAttendance.length,
        todayLate: lateCount,
        todayOnTime: totalOnTime,
        pendingLeaves: pendingLeavesCount,
        dailyTrend,
        departmentStats: Object.keys(departmentStats).map(dept => ({
          department: dept,
          total: departmentStats[dept].total,
          present: departmentStats[dept].present,
        })),
        hourlyStats
      });
    } catch (error) {
      res.status(500).json({ message: "Gagal mengambil analytics", error });
    }
  });

  // Get employee-level stats
  app.get("/api/analytics/employee/:employeeId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Belum login" });
    }
    
    const user = req.user as any;
    // Security check: employee can only view their own stats
    if (user.role === "employee" && user.employeeId !== req.params.employeeId) {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    try {
      const records = await storage.getAttendance();
      const employeeRecords = records.filter(r => r.employeeId === req.params.employeeId);
      
      let lateCount = 0;
      let onTimeCount = 0;
      
      employeeRecords.forEach(att => {
        if (att.checkIn) {
          const checkInTime = new Date(att.checkIn);
          const hours = checkInTime.getHours();
          const minutes = checkInTime.getMinutes();
          if (hours > 8 || (hours === 8 && minutes > 0)) {
            lateCount++;
          } else {
            onTimeCount++;
          }
        }
      });
      
      res.json({
        totalPresent: employeeRecords.length,
        late: lateCount,
        onTime: onTimeCount
      });
    } catch (error) {
      res.status(500).json({ message: "Gagal mengambil statistik karyawan", error });
    }
  });

  // ============================================================
  // TEST/DEBUG ROUTES (ORIGINAL - KEEPING INTACT)
  // ============================================================

  // Debug endpoint to test attendance manually
  app.post("/api/test/attendance", async (req, res) => {
    const { employeeId } = req.body;
    
    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }

    const employee = await storage.getEmployee(employeeId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const today = new Date().toISOString().split("T")[0];
    
    try {
      const result = await storage.createAttendance({
        employeeId: employee.id,
        checkIn: new Date(),
        checkOut: null,
        date: today,
        method: "test"
      });
      
      broadcast({
        type: "ATTENDANCE_UPDATE",
        action: "checkin",
        employeeName: employee.name,
        time: new Date().toLocaleTimeString("id-ID"),
        method: "test"
      });

      res.json({ 
        status: "OK", 
        message: "Test attendance created",
        data: result 
      });
    } catch (error) {
      res.status(500).json({ error: error });
    }
  });

  // Debug endpoint to perform checkout for today's attendance of an employee
  app.post("/api/test/attendance-checkout", async (req, res) => {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId required" });
    }

    const employee = await storage.getEmployee(employeeId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const today = new Date().toISOString().split("T")[0];
    const existing = await storage.getTodayAttendanceForEmployee(employee.id);
    if (!existing) {
      return res.status(404).json({ error: "No check-in found for today" });
    }

    if (existing.checkOut) {
      return res.status(400).json({ error: "Already checked out today" });
    }

    const updated = await storage.updateAttendance(existing.id, { checkOut: new Date() });

    broadcast({
      type: "ATTENDANCE_UPDATE",
      action: "checkout",
      employeeName: employee.name,
      time: new Date().toLocaleTimeString("id-ID"),
      method: "test"
    });

    return res.json({ status: "OK", message: "Checkout recorded", data: updated });
  });

  // Debug endpoint to get all attendance
  app.get("/api/test/all-attendance", async (_req, res) => {
    const records = await storage.getAttendance();
    res.json({
      count: records.length,
      records
    });
  });

  // ============================================================
  // EMPLOYEE ROUTES
  // ============================================================

  // Get all employees
  app.get("/api/employees", async (_req, res) => {
    const employees = await storage.getEmployees();
    res.json(employees);
  });

  // Get single employee
  app.get("/api/employees/:id", async (req, res) => {
    const employee = await storage.getEmployee(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json(employee);
  });

  // Create employee
  app.post("/api/employees", async (req, res) => {
    try {
      const data = parseBody(insertEmployeeSchema, req.body);
      const employee = await storage.createEmployee(data);
      res.status(201).json(employee);
    } catch (error) {
      res.status(400).json({ message: "Invalid employee data", error });
    }
  });

  // Update employee
  app.patch("/api/employees/:id", async (req, res) => {
    try {
      const updateSchema = insertEmployeeSchema.partial();
      const data = parseBody(updateSchema, req.body);
      const employee = await storage.updateEmployee(req.params.id, data);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data", error });
    }
  });

  // Delete employee
  app.delete("/api/employees/:id", async (req, res) => {
    const deleted = await storage.deleteEmployee(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json({ message: "Employee deleted" });
  });

  // ============================================================
  // ATTENDANCE ROUTES
  // ============================================================

  // Get all attendance records
  app.get("/api/attendance", async (_req, res) => {
    const records = await storage.getAttendance();
    res.json(records);
  });

  // Get today's attendance
  app.get("/api/attendance/today", async (_req, res) => {
    const records = await storage.getAttendanceToday();
    res.json(records);
  });

  // Get recent attendance
  app.get("/api/attendance/recent", async (_req, res) => {
    const records = await storage.getRecentAttendance(10);
    res.json(records);
  });

  // ============================================================
  // ESP32 IOT ROUTES
  // ============================================================

  // Get pending RFID scan (for web form polling)
  app.get("/api/esp/pending-rfid", async (_req, res) => {
    const pending = storage.getPendingRfid();
    if (pending) {
      res.json({ rfidId: pending.rfidId });
    } else {
      res.json(null);
    }
  });

  // Clear pending RFID
  app.delete("/api/esp/pending-rfid", async (_req, res) => {
    storage.clearPendingRfid();
    res.json({ message: "Cleared" });
  });

  // FE meminta ESP masuk mode pendaftaran RFID
app.post("/api/esp/start-register", async (_req, res) => {
  registerMode = true;
  storage.clearPendingRfid();
  return res.json({ status: "OK", message: "Register mode ON" });
});


  // ESP32: RFID Scan endpoint
  // Called when RFID card is scanned on ESP32
  app.post("/api/esp/scan", async (req, res) => {
  const { rfidId } = req.body;

  if (!rfidId) {
    return res.status(400).json({ status: "ERROR", message: "RFID ID required" });
  }

  // ===============================
  // 1️⃣ PRIORITAS: MODE REGISTER
  // ===============================
  if (registerMode) {
    registerMode = false; // hanya sekali
    storage.setPendingRfid(rfidId);
    return res.json({
      status: "REGISTER_OK",
      rfidId,
      message: "RFID siap untuk pendaftaran"
    });
  }

  // ===============================
  // 2️⃣ NORMAL MODE: Absensi
  // ===============================
  const employee = await storage.getEmployeeByRfid(rfidId);

  if (!employee) {
    return res.json({
      status: "UNKNOWN_CARD",
      message: "Kartu tidak terdaftar"
    });
  }

  // Fingerprint belum ada
  if (!employee.fingerprintId) {
    return res.json({
      status: "NO_FINGERPRINT",
      message: "Fingerprint belum terdaftar."
    });
  }

  // Fingerprint wajib
  return res.json({
    status: "NEED_FINGERPRINT",
    message: "Tempel jari untuk verifikasi",
    employeeId: employee.id
  });
});


  // ESP32: Fingerprint enrolled during registration
  app.post("/api/esp/fp-enrolled", async (req, res) => {
    const { fingerId } = req.body;

    if (fingerId === undefined) {
      return res.status(400).json({ status: "ERROR", message: "Finger ID required" });
    }

    // Find pending RFID registration
    const pending = storage.getPendingRfid();
    if (!pending) {
      return res.json({
        status: "NO_PENDING",
        message: "No pending registration"
      });
    }

    // Find employee with this RFID and update fingerprint
    const employee = await storage.getEmployeeByRfid(pending.rfidId);
    if (employee) {
      await storage.updateEmployee(employee.id, { fingerprintId: fingerId });
      storage.clearPendingRfid();
      return res.json({
        status: "OK",
        message: "Fingerprint enrolled successfully"
      });
    }

    return res.json({
      status: "OK",
      message: "Fingerprint ready for registration"
    });
  });

  // ESP32: Fingerprint scan for attendance verification
  app.post("/api/esp/scan-fp", async (req, res) => {
    const { rfidId, fingerId } = req.body;

    console.log(`[SCAN-FP] Received: rfidId=${rfidId}, fingerId=${fingerId}`);

    if (!rfidId || fingerId === undefined) {
      console.log(`[SCAN-FP] Error: Missing RFID or Finger ID`);
      return res.status(400).json({ status: "ERROR", message: "RFID and Finger ID required" });
    }

    // Find employee by RFID
    const employee = await storage.getEmployeeByRfid(rfidId);
    console.log(`[SCAN-FP] Employee found:`, employee ? `${employee.name} (ID: ${employee.id})` : "NOT FOUND");
    
    if (!employee) {
      console.log(`[SCAN-FP] Error: User not found with RFID ${rfidId}`);
      return res.json({ status: "ERROR", message: "User not found" });
    }

    // Verify fingerprint matches
    console.log(`[SCAN-FP] Fingerprint check: expected=${employee.fingerprintId}, received=${fingerId}`);
    if (employee.fingerprintId !== fingerId) {
      console.log(`[SCAN-FP] Error: Fingerprint mismatch`);
      return res.json({ status: "MISMATCH", message: "Fingerprint does not match" });
    }

    // Fingerprint matched - record attendance
    const today = new Date().toISOString().split("T")[0];
    const existingAttendance = await storage.getTodayAttendanceForEmployee(employee.id);
    console.log(`[SCAN-FP] Existing attendance today:`, existingAttendance ? "YES" : "NO");

    if (!existingAttendance) {
      // Check-in
      console.log(`[SCAN-FP] Creating check-in for ${employee.name}`);
      await storage.createAttendance({
        employeeId: employee.id,
        checkIn: new Date(),
        checkOut: null,
        date: today,
        method: "rfid+fingerprint"
      });
      
      broadcast({
        type: "ATTENDANCE_UPDATE",
        action: "checkin",
        employeeName: employee.name,
        time: new Date().toLocaleTimeString("id-ID"),
        method: "rfid+fingerprint"
      });

      console.log(`[SCAN-FP] ✓ Check-in recorded successfully`);
      return res.json({
        status: "MATCH",
        message: "Attendance OK - Check-in",
        action: "checkin"
      });
    } else if (!existingAttendance.checkOut) {
      // Check-out
      console.log(`[SCAN-FP] Creating check-out for ${employee.name}`);
      await storage.updateAttendance(existingAttendance.id, {
        checkOut: new Date()
      });

      broadcast({
        type: "ATTENDANCE_UPDATE",
        action: "checkout",
        employeeName: employee.name,
        time: new Date().toLocaleTimeString("id-ID"),
        method: "rfid+fingerprint"
      });

      console.log(`[SCAN-FP] ✓ Check-out recorded successfully`);
      return res.json({
        status: "MATCH",
        message: "Attendance OK - Check-out",
        action: "checkout"
      });
    } else {
      console.log(`[SCAN-FP] Already checked out today`);
      return res.json({
        status: "ALREADY",
        message: "Already checked out today"
      });
    }
  });

  return httpServer;
}
