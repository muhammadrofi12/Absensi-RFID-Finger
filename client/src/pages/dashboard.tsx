import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Users, Clock, CheckCircle, AlertCircle, CalendarDays, Sparkles, Award, ArrowUpRight } from "lucide-react";
import type { AttendanceWithEmployee } from "@shared/schema";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === "employee") {
    return <EmployeeDashboard employeeId={user.employeeId || ""} username={user.username} />;
  }

  return <HRDashboard />;
}

// ============================================================
// HR / ADMIN DASHBOARD
// ============================================================
const renderCustomLegend = (props: any) => {
  const { payload } = props;
  if (!payload) return null;

  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
      {payload.map((entry: any, index: number) => (
        <div key={`legend-${index}`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span 
            className="w-2 h-2 rounded-full shrink-0" 
            style={{ backgroundColor: entry.color }} 
          />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

function HRDashboard() {
  const { data: analytics = {}, isLoading: loadingAnalytics } = useQuery<any>({
    queryKey: ["/api/analytics/dashboard"],
    refetchInterval: 5000,
    staleTime: 0,
  });

  const { data: recentActivity = [], isLoading: loadingRecent } = useQuery<AttendanceWithEmployee[]>({
    queryKey: ["/api/attendance/recent"],
    refetchInterval: 5000,
    staleTime: 0,
  });

  const stats = [
    {
      title: "Total Karyawan",
      value: analytics.totalEmployees ?? 0,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10 border border-blue-500/20",
      desc: "Terdaftar di sistem",
    },
    {
      title: "Hadir Hari Ini",
      value: analytics.todayPresent ?? 0,
      icon: CheckCircle,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10 border border-emerald-500/20",
      desc: "Check-in hari ini",
    },
    {
      title: "Terlambat Hari Ini",
      value: analytics.todayLate ?? 0,
      icon: Clock,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10 border border-rose-500/20",
      desc: "Melewati batas jam",
    },
    {
      title: "Menunggu Approval",
      value: analytics.pendingLeaves ?? 0,
      icon: CalendarDays,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10 border border-amber-500/20",
      desc: "Pengajuan cuti pending",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard Analitik HR
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring kehadiran karyawan dan perangkat IoT Smart Workplace.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs py-1.5 px-3">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          Live Monitor
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  {loadingAnalytics ? (
                    <Skeleton className="h-9 w-20 mt-2" />
                  ) : (
                    <p className="text-3xl font-bold mt-2 text-foreground">
                      {stat.value}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                </div>
                <div className={`p-3 rounded-xl shrink-0 ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kehadiran 30 Hari */}
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Trend Kehadiran (30 Hari Terakhir)</CardTitle>
            <CardDescription>Grafik jumlah kehadiran harian karyawan</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {loadingAnalytics ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.dailyTrend || []}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} />
                  <XAxis dataKey="date" stroke="currentColor" opacity={0.5} fontSize={10} tickFormatter={(tick) => (typeof tick === "string" && tick.length >= 10 ? tick.substring(5) : tick)} />
                  <YAxis stroke="currentColor" opacity={0.5} fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                      fontSize: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="count" name="Kehadiran" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Departemen stats */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Distribusi per Departemen</CardTitle>
            <CardDescription>Kehadiran hari ini per unit kerja</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {loadingAnalytics ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 20, bottom: 10, left: 20 }}>
                  <Pie
                    data={analytics.departmentStats || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="total"
                    nameKey="department"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {(analytics.departmentStats || []).map((entry: any, index: number) => {
                      const colors = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899"];
                      return (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                      fontSize: "12px",
                    }}
                  />
                  <Legend content={renderCustomLegend} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hourly stats & Activity logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent logs */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Log Aktivitas Terbaru</CardTitle>
            <CardDescription>Aliran log check-in/check-out secara langsung</CardDescription>
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
              <div className="text-center py-10">
                <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Belum ada aktivitas hari ini</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Scan kartu RFID pada perangkat absensi untuk mulai</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentActivity.slice(0, 5).map((activity, idx) => (
                  <div
                    key={activity.id || idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {activity.employee?.name?.charAt(0).toUpperCase() || "?"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {activity.employee?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.employee?.department || "No Department"} · {activity.method}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground font-medium block">
                          {activity.checkOut ? "Check-out" : "Check-in"}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 block">
                          {activity.checkOut
                            ? format(new Date(activity.checkOut), "HH:mm:ss", { locale: id })
                            : activity.checkIn
                            ? format(new Date(activity.checkIn), "HH:mm:ss", { locale: id })
                            : "-"}
                        </span>
                      </div>
                      <Badge className={activity.checkOut ? "bg-muted text-muted-foreground text-xs" : "bg-primary text-primary-foreground text-xs"}>
                        {activity.checkOut ? "OUT" : "IN"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hourly Check-In stats */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Distribusi Jam Masuk (Harian)</CardTitle>
            <CardDescription>Rentang jam tersibuk masuk karyawan</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            {loadingAnalytics ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.hourlyStats || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} />
                  <XAxis dataKey="hour" stroke="currentColor" opacity={0.5} fontSize={10} />
                  <YAxis stroke="currentColor" opacity={0.5} fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                      fontSize: "12px",
                    }}
                  />
                  <Line type="monotone" dataKey="count" name="Absensi" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// EMPLOYEE / KARYAWAN DASHBOARD (Personalized)
// ============================================================
function EmployeeDashboard({ employeeId, username }: { employeeId: string; username: string }) {
  const { data: employeeData } = useQuery<any>({
    queryKey: [`/api/employees/${employeeId}`],
    enabled: !!employeeId,
  });

  const { data: stats = {}, isLoading: loadingStats } = useQuery<any>({
    queryKey: [`/api/analytics/employee/${employeeId}`],
    enabled: !!employeeId,
  });

  const { data: activeShift = null, isLoading: loadingShift } = useQuery<any>({
    queryKey: [`/api/shifts/active/${employeeId}`],
    enabled: !!employeeId,
  });

  const { data: leaveBalances = [] } = useQuery<any[]>({
    queryKey: ["/api/leave/balances"],
  });

  const personalStats = [
    {
      title: "Total Hadir",
      value: stats.totalPresent ?? 0,
      icon: CheckCircle,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10 border border-emerald-500/20",
    },
    {
      title: "Tepat Waktu",
      value: stats.onTime ?? 0,
      icon: Award,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10 border border-violet-500/20",
    },
    {
      title: "Terlambat",
      value: stats.late ?? 0,
      icon: Clock,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10 border border-rose-500/20",
    },
    {
      title: "Sisa Jatah Cuti",
      value: leaveBalances[0] ? (leaveBalances[0].annualTotal - leaveBalances[0].annualUsed) : 12,
      icon: CalendarDays,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10 border border-amber-500/20",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Welcome Banner */}
      <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <Sparkles className="h-28 w-28 text-primary" />
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-lg">
            {employeeData?.name?.charAt(0).toUpperCase() || username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Selamat Datang, {employeeData?.name || username}!
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              NIP: {employeeData?.employeeId || "–"} · Departemen: {employeeData?.department || "–"}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {personalStats.map((stat) => (
          <Card key={stat.title} className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-16 mt-2" />
                  ) : (
                    <p className="text-2xl font-bold mt-2 text-foreground">
                      {stat.value}
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-xl shrink-0 ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Shift and Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active shift widget */}
        <Card className="md:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Shift Kerja Anda Hari Ini
            </CardTitle>
            <CardDescription>Jadwal kerja resmi yang saat ini berlaku</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingShift ? (
              <Skeleton className="w-full h-24" />
            ) : activeShift ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 border border-border rounded-xl col-span-2 md:col-span-1">
                  <span className="text-xs text-muted-foreground block mb-1">Nama Shift</span>
                  <span className="text-lg font-bold text-foreground block">{activeShift.shift?.name}</span>
                  <span className="text-sm text-primary font-semibold mt-1.5 block">
                    {activeShift.shift?.startTime} – {activeShift.shift?.endTime}
                  </span>
                </div>
                <div className="p-4 bg-muted/50 border border-border rounded-xl col-span-2 md:col-span-1">
                  <span className="text-xs text-muted-foreground block mb-1">Hari Kerja</span>
                  <span className="text-sm font-semibold text-foreground block leading-relaxed">
                    {activeShift.shift?.workDays ? JSON.parse(activeShift.shift.workDays).join(", ") : "–"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 border border-dashed border-border rounded-xl text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Jadwal shift Anda belum dikonfigurasi oleh HR.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick action buttons */}
        <Card className="border-border bg-card flex flex-col justify-center">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">Menu Cepat</CardTitle>
            <CardDescription>Akses fitur portal karyawan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/leave" className="w-full block">
              <Button
                className="w-full justify-between bg-card border border-border text-foreground hover:bg-muted"
                variant="outline"
              >
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Pengajuan Cuti & Izin
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            </Link>
            <Link href="/shifts" className="w-full block">
              <Button
                className="w-full justify-between bg-card border border-border text-foreground hover:bg-muted"
                variant="outline"
              >
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Jadwal Shift Kerja
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
