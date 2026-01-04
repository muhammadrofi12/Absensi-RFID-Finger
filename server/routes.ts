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

      // Check if there's a pending RFID with fingerId that matches this employee's RFID
      const pending = storage.getPendingRfid();
      if (pending && pending.rfidId === data.rfidId && pending.fingerId !== undefined) {
        // Use the fingerId from pending registration
        data.fingerprintId = pending.fingerId;
        console.log(`[CREATE EMPLOYEE] Using pending fingerId: ${pending.fingerId} for RFID: ${data.rfidId}`);
      }

      const employee = await storage.createEmployee(data);

      // Clear pending if we used it
      if (pending && pending.rfidId === data.rfidId) {
        storage.clearPendingRfid();
      }

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
      res.json({
        rfidId: pending.rfidId,
        fingerId: pending.fingerId ?? null,
        enrollMode: pending.enrollMode ?? false
      });
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

  // FE meminta ESP masuk mode enroll fingerprint BARU
  app.post("/api/esp/start-fp-enroll", async (_req, res) => {
    const pending = storage.getPendingRfid();
    if (!pending) {
      return res.status(400).json({
        status: "ERROR",
        message: "Scan RFID dulu sebelum enroll fingerprint"
      });
    }

    storage.setEnrollMode(true);
    console.log(`[FP-ENROLL] Enrollment mode activated for RFID: ${pending.rfidId}`);

    return res.json({
      status: "OK",
      message: "Fingerprint enrollment mode ON",
      rfidId: pending.rfidId
    });
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

    // Try to find employee with this RFID first
    const employee = await storage.getEmployeeByRfid(pending.rfidId);
    if (employee) {
      // Employee exists, update fingerprint directly
      await storage.updateEmployee(employee.id, { fingerprintId: fingerId });
      storage.clearPendingRfid();
      return res.json({
        status: "OK",
        message: "Fingerprint enrolled successfully"
      });
    }

    // No employee yet - save fingerId to pending for later use when employee is created
    const success = storage.setPendingFingerId(fingerId);
    if (success) {
      return res.json({
        status: "FP_SAVED",
        message: "Fingerprint saved, waiting for employee registration"
      });
    }

    return res.json({
      status: "ERROR",
      message: "Failed to save fingerprint"
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

    // Verify fingerprint matches - use strict type comparison
    const expectedFpId = employee.fingerprintId;
    const receivedFpId = Number(fingerId);

    console.log(`[SCAN-FP] Fingerprint check:`);
    console.log(`  - Expected: ${expectedFpId} (type: ${typeof expectedFpId})`);
    console.log(`  - Received: ${receivedFpId} (type: ${typeof receivedFpId})`);
    console.log(`  - Match: ${expectedFpId === receivedFpId}`);

    if (expectedFpId !== receivedFpId) {
      console.log(`[SCAN-FP] ❌ MISMATCH! Employee fingerprint ID ${expectedFpId} does not match scanned ID ${receivedFpId}`);
      return res.json({ status: "MISMATCH", message: "Fingerprint does not match" });
    }

    console.log(`[SCAN-FP] ✓ Fingerprint matched!`);

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

  // ============================================================
  // FINGERPRINT MANAGEMENT ENDPOINTS
  // ============================================================

  // ESP32: Poll for pending command
  app.get("/api/esp/fingerprints/command", async (_req, res) => {
    const command = storage.getCommand();
    if (command) {
      res.json({
        hasCommand: true,
        type: command.type,
        slotId: command.slotId ?? null
      });
    } else {
      res.json({ hasCommand: false });
    }
  });

  // ESP32: Submit command result
  app.post("/api/esp/fingerprints/result", async (req, res) => {
    const { success, command, data, message } = req.body;

    storage.setCommandResult({
      success,
      command,
      data: data ?? [],
      message
    });

    console.log(`[FP-MGMT] Command result received: ${command}, success: ${success}`);

    res.json({ status: "OK" });
  });

  // Frontend: Get command result (poll)
  app.get("/api/fingerprints/result", async (_req, res) => {
    const result = storage.getCommandResult();
    res.json(result);
  });

  // Frontend: Clear result after reading
  app.delete("/api/fingerprints/result", async (_req, res) => {
    storage.clearCommandResult();
    res.json({ status: "OK" });
  });

  // Frontend: Trigger scan all fingerprints
  app.post("/api/fingerprints/scan", async (_req, res) => {
    storage.setCommand({
      type: 'scan_all',
      createdAt: new Date()
    });
    console.log(`[FP-MGMT] Scan all command queued`);
    res.json({ status: "OK", message: "Scan command sent to ESP32" });
  });

  // Frontend: Get fingerprints with employee mapping
  app.get("/api/fingerprints", async (_req, res) => {
    const employees = await storage.getEmployees();
    const result = storage.getCommandResult();

    // If we have scan result, map employees to slots
    if (result && result.command === 'scan_all' && result.data) {
      const mappedSlots = result.data.map(slot => {
        const employee = employees.find(e => e.fingerprintId === slot.slotId);
        return {
          ...slot,
          employeeId: employee?.id ?? null,
          employeeName: employee?.name ?? null
        };
      });
      res.json({ slots: mappedSlots, hasData: true });
    } else {
      res.json({ slots: [], hasData: false });
    }
  });

  // Frontend: Delete fingerprint at slot
  app.delete("/api/fingerprints/:id", async (req, res) => {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId) || slotId < 1 || slotId > 127) {
      return res.status(400).json({ status: "ERROR", message: "Invalid slot ID" });
    }

    storage.setCommand({
      type: 'delete',
      slotId,
      createdAt: new Date()
    });
    console.log(`[FP-MGMT] Delete command queued for slot ${slotId}`);
    res.json({ status: "OK", message: `Delete command sent for slot ${slotId}` });
  });

  // Frontend: Enroll fingerprint to specific slot
  app.post("/api/fingerprints/enroll", async (req, res) => {
    const { slotId } = req.body;

    if (!slotId || slotId < 1 || slotId > 127) {
      return res.status(400).json({ status: "ERROR", message: "Invalid slot ID (1-127)" });
    }

    storage.setCommand({
      type: 'enroll',
      slotId,
      createdAt: new Date()
    });
    console.log(`[FP-MGMT] Enroll command queued for slot ${slotId}`);
    res.json({ status: "OK", message: `Enroll command sent for slot ${slotId}` });
  });

  return httpServer;
}
