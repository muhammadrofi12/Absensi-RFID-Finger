import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Clock, CheckCircle, Wifi } from "lucide-react";
import type { Employee, AttendanceWithEmployee } from "@shared/schema";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function Dashboard() {
  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: todayAttendance = [], isLoading: loadingAttendance } = useQuery<AttendanceWithEmployee[]>({
    queryKey: ["/api/attendance/today"],
  });

  const { data: recentActivity = [], isLoading: loadingRecent } = useQuery<AttendanceWithEmployee[]>({
    queryKey: ["/api/attendance/recent"],
  });

  const stats = [
    {
      title: "Total Karyawan",
      value: employees.length,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Hadir Hari Ini",
      value: todayAttendance.filter((a) => a.checkIn).length,
      icon: CheckCircle,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    {
      title: "Sudah Checkout",
      value: todayAttendance.filter((a) => a.checkOut).length,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      title: "Perangkat IoT",
      value: 1,
      icon: Wifi,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sistem Absensi Karyawan dengan ESP32 IoT
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  {loadingEmployees || loadingAttendance ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-semibold mt-1" data-testid={`text-stat-${stat.title.toLowerCase().replace(/\s/g, "-")}`}>
                      {stat.value}
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-md ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium">Aktivitas Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Belum ada aktivitas hari ini</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Scan RFID untuk memulai absensi</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.slice(0, 5).map((activity, idx) => (
                  <div
                    key={activity.id || idx}
                    className="flex items-center gap-4 p-3 rounded-md bg-muted/50"
                    data-testid={`card-activity-${idx}`}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {activity.employee?.name?.charAt(0).toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {activity.employee?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.checkOut ? "Check-out" : "Check-in"} -{" "}
                        {activity.checkOut
                          ? format(new Date(activity.checkOut), "HH:mm", { locale: id })
                          : activity.checkIn
                          ? format(new Date(activity.checkIn), "HH:mm", { locale: id })
                          : "-"}
                      </p>
                    </div>
                    <Badge variant={activity.checkOut ? "secondary" : "default"}>
                      {activity.checkOut ? "OUT" : "IN"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium">Status Perangkat IoT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-md border border-border bg-card">
                <div className="relative">
                  <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
                    <Wifi className="h-6 w-6 text-primary" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-card" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">ESP32 DevKit</p>
                  <p className="text-xs text-muted-foreground">RFID + Fingerprint Scanner</p>
                </div>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Online
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">RFID Reader</p>
                  <p className="text-sm font-medium">MFRC522</p>
                </div>
                <div className="p-4 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Fingerprint</p>
                  <p className="text-sm font-medium">AS608</p>
                </div>
              </div>
              <div className="p-4 rounded-md bg-muted/30 border border-dashed border-border">
                <p className="text-xs text-muted-foreground text-center">
                  Tempelkan kartu RFID atau jari untuk absensi
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
