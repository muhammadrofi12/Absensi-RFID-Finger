import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ClipboardList,
  Search,
  Calendar,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  CreditCard,
  Fingerprint,
} from "lucide-react";
import type { AttendanceWithEmployee, Employee } from "@shared/schema";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { id } from "date-fns/locale";

export default function Attendance() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");

  const { data: attendanceRecords = [], isLoading } = useQuery<AttendanceWithEmployee[]>({
    queryKey: ["/api/attendance"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const checkinMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const res = await fetch("/api/test/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      if (!res.ok) throw new Error("Failed to create check-in");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/attendance"] }),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const res = await fetch("/api/test/attendance-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to checkout");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/attendance"] }),
  });

  const filteredRecords = attendanceRecords.filter((record) => {
    const matchesSearch =
      record.employee?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.employee?.employeeId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = !dateFilter || record.date === dateFilter;
    const matchesEmployee = employeeFilter === "all" || record.employeeId === employeeFilter;
    return matchesSearch && matchesDate && matchesEmployee;
  });

  const groupedRecords = filteredRecords.reduce((groups, record) => {
    const date = record.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(record);
    return groups;
  }, {} as Record<string, AttendanceWithEmployee[]>);

  const sortedDates = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));

  const getDateLabel = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      if (isToday(date)) return "Hari Ini";
      if (isYesterday(date)) return "Kemarin";
      return format(date, "EEEE, d MMMM yyyy", { locale: id });
    } catch {
      return dateStr;
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (timestamp: Date | string | null | undefined) => {
    if (!timestamp) return "-";
    try {
      return format(new Date(timestamp), "HH:mm", { locale: id });
    } catch {
      return "-";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-attendance-title">
          Log Absensi
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Riwayat absensi karyawan dengan RFID + Fingerprint
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Riwayat Absensi
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari karyawan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-48"
                  data-testid="input-search-attendance"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full sm:w-40"
                  data-testid="input-date-filter"
                />
                <div className="flex items-center gap-2">
                  <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="w-full sm:w-40" data-testid="select-employee-filter">
                    <SelectValue placeholder="Semua karyawan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Karyawan</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                  </Select>

                  {/* Manual check-in / check-out controls for testing */}
                  <Select value={selectedEmployeeId || ""} onValueChange={(v) => setSelectedEmployeeId(v || null)}>
                    <SelectTrigger className="w-full sm:w-40" data-testid="select-employee-manual">
                      <SelectValue placeholder="Pilih karyawan" />
                    </SelectTrigger>
                  <SelectContent>
  <SelectItem value="none">Pilih karyawan</SelectItem>
  {employees.map((emp) => (
    <SelectItem key={emp.id} value={emp.id}>
      {emp.name}
    </SelectItem>
  ))}
</SelectContent>

                  </Select>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => selectedEmployeeId && checkinMutation.mutate(selectedEmployeeId)}
                      disabled={!selectedEmployeeId}
                    >
                      Check-in
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => selectedEmployeeId && checkoutMutation.mutate(selectedEmployeeId)}
                      disabled={!selectedEmployeeId}
                    >
                      Check-out
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2].map((group) => (
                <div key={group} className="space-y-3">
                  <Skeleton className="h-5 w-32" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-md bg-muted/30">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : sortedDates.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Belum ada data absensi</p>
              <p className="text-muted-foreground/60 text-sm mt-1">
                Data akan muncul setelah karyawan melakukan absensi
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-8 pr-4">
                {sortedDates.map((date) => (
                  <div key={date} className="space-y-3">
                    <div className="flex items-center gap-2 sticky top-0 bg-card py-2 z-10">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {getDateLabel(date)}
                      </h3>
                      <Badge variant="secondary" className="ml-auto">
                        {groupedRecords[date].length} record
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {groupedRecords[date].map((record, idx) => (
                        <div
                          key={record.id || idx}
                          className="flex items-center gap-4 p-4 rounded-md bg-muted/30 border border-transparent hover:border-border transition-colors"
                          data-testid={`card-attendance-${record.id || idx}`}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(record.employee?.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {record.employee?.name || "Unknown"}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span>{record.employee?.employeeId || "-"}</span>
                              <span className="text-muted-foreground/40">|</span>
                              <span>{record.employee?.department || "-"}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                              <ArrowDownToLine className="h-3.5 w-3.5" />
                              <span className="font-medium">{formatTime(record.checkIn)}</span>
                            </div>
                            {record.checkOut && (
                              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                <ArrowUpFromLine className="h-3.5 w-3.5" />
                                <span className="font-medium">{formatTime(record.checkOut)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs gap-1">
                              <CreditCard className="h-3 w-3" />
                              <Fingerprint className="h-3 w-3" />
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
