import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEmployeeSchema } from "@shared/schema";
import { z } from "zod";

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
  // TEST/DEBUG ROUTES
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
