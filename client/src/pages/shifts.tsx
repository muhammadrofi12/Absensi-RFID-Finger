import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Clock, Plus, Users, Trash2, CalendarDays, CheckCircle2, Sparkles, AlertCircle } from "lucide-react";

// Shift creation validation schema
const shiftSchema = z.object({
  name: z.string().min(1, "Nama shift wajib diisi"),
  startTime: z.string().min(1, "Jam masuk wajib diisi"),
  endTime: z.string().min(1, "Jam pulang wajib diisi"),
  workDays: z.array(z.string()).min(1, "Pilih minimal 1 hari kerja"),
});

// Shift assignment validation schema
const assignSchema = z.object({
  employeeId: z.string().min(1, "Karyawan wajib dipilih"),
  shiftId: z.string().min(1, "Shift wajib dipilih"),
  effectiveDate: z.string().min(1, "Tanggal efektif wajib diisi"),
});

type ShiftValues = z.infer<typeof shiftSchema>;
type AssignValues = z.infer<typeof assignSchema>;

const DAYS_OF_WEEK = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export default function Shifts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Queries
  const { data: shifts = [], isLoading: isLoadingShifts } = useQuery<any[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<any[]>({
    queryKey: ["/api/shifts/assignments"],
    enabled: user?.role === "admin",
  });

  const { data: activeShift = null, isLoading: isLoadingActive } = useQuery<any>({
    queryKey: [`/api/shifts/active/${user?.employeeId}`],
    enabled: user?.role === "employee" && !!user?.employeeId,
  });

  // Forms
  const shiftForm = useForm<ShiftValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      name: "",
      startTime: "08:00",
      endTime: "17:00",
      workDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
    },
  });

  const assignForm = useForm<AssignValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      employeeId: "",
      shiftId: "",
      effectiveDate: new Date().toISOString().split("T")[0],
    },
  });

  // Mutations
  const createShiftMutation = useMutation({
    mutationFn: async (values: ShiftValues) => {
      return await apiRequest("POST", "/api/shifts", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      shiftForm.reset();
      setIsCreateOpen(false);
      toast({
        title: "Shift Berhasil Dibuat",
        description: "Template shift baru telah tersimpan di sistem.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Gagal Membuat Shift",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const assignShiftMutation = useMutation({
    mutationFn: async (values: AssignValues) => {
      return await apiRequest("POST", "/api/shifts/assign", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/assignments"] });
      assignForm.reset({
        employeeId: "",
        shiftId: "",
        effectiveDate: new Date().toISOString().split("T")[0],
      });
      toast({
        title: "Shift Berhasil Ditugaskan",
        description: "Jadwal shift karyawan berhasil diperbarui.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Gagal Menugaskan Shift",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateShift = (values: ShiftValues) => {
    createShiftMutation.mutate(values);
  };

  const handleAssignShift = (values: AssignValues) => {
    assignShiftMutation.mutate(values);
  };

  const formatDays = (daysJson: string) => {
    try {
      const days = JSON.parse(daysJson);
      return days.join(", ");
    } catch {
      return daysJson;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {user?.role === "admin" ? "Manajemen Shift Kerja" : "Jadwal Shift Kerja"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {user?.role === "admin"
            ? "Buat template jam kerja, distribusikan shift kepada karyawan, dan pantau jadwal operasional."
            : "Lihat status shift kerja Anda saat ini beserta jam kerja dan hari operasional."}
        </p>
      </div>

      {user?.role === "employee" ? (
        // ============================================================
        // EMPLOYEE VIEW
        // ============================================================
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Active Shift details */}
          <Card className="border-border bg-card relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Clock className="h-40 w-40 text-primary" />
            </div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Shift Aktif Anda
                </CardTitle>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5">
                  Berjalan
                </Badge>
              </div>
              <CardDescription>Jadwal kerja resmi yang saat ini berlaku</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10 pt-4">
              {activeShift ? (
                <>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Nama Shift</span>
                    <span className="text-2xl font-bold text-foreground block">{activeShift.shift?.name}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 border border-border rounded-xl">
                      <span className="text-xs text-muted-foreground block mb-1">Jam Kerja</span>
                      <span className="text-lg font-bold text-primary">
                        {activeShift.shift?.startTime} - {activeShift.shift?.endTime}
                      </span>
                    </div>
                    <div className="p-3 bg-muted/50 border border-border rounded-xl">
                      <span className="text-xs text-muted-foreground block mb-1">Berlaku Mulai</span>
                      <span className="text-sm font-semibold text-foreground mt-1 block">
                        {activeShift.effectiveDate}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 bg-muted/50 border border-border rounded-xl">
                    <span className="text-xs text-muted-foreground">Hari Kerja</span>
                    <span className="text-sm font-medium text-foreground block">
                      {formatDays(activeShift.shift?.workDays)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
                  <span>Jadwal shift Anda belum diset oleh HR.</span>
                  <span className="text-xs text-muted-foreground/60">Silakan hubungi admin / HRD untuk penugasan.</span>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/30 py-3.5 border-t border-border text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Jam check-in default mengikuti acuan shift Anda.</span>
            </CardFooter>
          </Card>

          {/* Guidelines Card */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Panduan Jam Masuk & Pulang
              </CardTitle>
              <CardDescription>Ketentuan toleransi dan keterlambatan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-sm text-foreground">
              <div className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
                <div>
                  <p className="font-semibold text-foreground">Check-in Tepat Waktu</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Lakukan tap kartu & finger di alat absensi maksimal 10 menit sebelum jam masuk shift.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
                <div>
                  <p className="font-semibold text-foreground">Keterlambatan</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Check-in setelah waktu masuk shift akan tercatat sebagai keterlambatan dan dihitung dalam menit pada akhir bulan.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</div>
                <div>
                  <p className="font-semibold text-foreground">Check-out / Pulang</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Harap melakukan scan tap kartu & finger saat jam kerja shift berakhir untuk menyelesaikan absensi hari tersebut.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // ============================================================
        // ADMIN / HR VIEW
        // ============================================================
        <Tabs defaultValue="assignments" className="w-full space-y-6">
          <TabsList>
            <TabsTrigger value="assignments">
              Penugasan Shift
            </TabsTrigger>
            <TabsTrigger value="templates">
              Template Shift ({shifts.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Assignments & Assign form */}
          <TabsContent value="assignments">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Assign Shift */}
              <div className="lg:col-span-1">
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      Tugaskan Shift Baru
                    </CardTitle>
                    <CardDescription>Hubungkan karyawan dengan template shift kerja</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...assignForm}>
                      <form onSubmit={assignForm.handleSubmit(handleAssignShift)} className="space-y-4">
                        <FormField
                          control={assignForm.control}
                          name="employeeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pilih Karyawan</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Pilih karyawan..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {employees.map((emp) => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                      {emp.name} ({emp.employeeId})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={assignForm.control}
                          name="shiftId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pilih Shift</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Pilih shift..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {shifts.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name} ({s.startTime} - {s.endTime})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={assignForm.control}
                          name="effectiveDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tanggal Efektif</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          disabled={assignShiftMutation.isPending}
                          className="w-full"
                        >
                          {assignShiftMutation.isPending ? "Menugaskan..." : "Tugaskan Shift"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>

              {/* Table of active assignments */}
              <div className="lg:col-span-2">
                <Card className="border-border bg-card h-full">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Daftar Penugasan Shift Karyawan
                    </CardTitle>
                    <CardDescription>Semua shift kerja aktif yang ditugaskan</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-6">Karyawan</TableHead>
                          <TableHead>Shift Kerja</TableHead>
                          <TableHead>Jam Operasional</TableHead>
                          <TableHead>Hari Kerja</TableHead>
                          <TableHead className="pr-6">Tanggal Mulai</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="pl-6">
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground">{item.employeeName}</span>
                                <span className="text-xs text-muted-foreground">{item.employeeIdCode} - {item.department}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-foreground">
                              {item.shift?.name}
                            </TableCell>
                            <TableCell className="text-primary font-medium">
                              {item.shift?.startTime} - {item.shift?.endTime}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate" title={formatDays(item.shift?.workDays)}>
                              {formatDays(item.shift?.workDays)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs pr-6">
                              {item.effectiveDate}
                            </TableCell>
                          </TableRow>
                        ))}
                        {assignments.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Belum ada penugasan shift karyawan.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Shift Templates */}
          <TabsContent value="templates" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">Template Shift Kerja</h2>
              <Button
                className="gap-2"
                onClick={() => setIsCreateOpen(!isCreateOpen)}
              >
                <Plus className="h-4 w-4" /> Buat Template Shift
              </Button>
            </div>

            {/* Create shift card (toggleable) */}
            {isCreateOpen && (
              <Card className="border-border bg-card max-w-xl">
                <CardHeader>
                  <CardTitle className="text-lg">Buat Template Shift Baru</CardTitle>
                  <CardDescription>Tentukan jam masuk, jam pulang, dan hari kerja operasional.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...shiftForm}>
                    <form onSubmit={shiftForm.handleSubmit(handleCreateShift)} className="space-y-4">
                      <FormField
                        control={shiftForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nama Shift</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Contoh: Shift Pagi, Shift Malam, WFH..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={shiftForm.control}
                          name="startTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Jam Masuk (Check-In)</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={shiftForm.control}
                          name="endTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Jam Pulang (Check-Out)</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={shiftForm.control}
                        name="workDays"
                        render={() => (
                          <FormItem className="space-y-2">
                            <FormLabel>Hari Kerja Operasional</FormLabel>
                            <div className="grid grid-cols-4 gap-2.5 pt-1">
                              {DAYS_OF_WEEK.map((day) => (
                                <FormField
                                  key={day}
                                  control={shiftForm.control}
                                  name="workDays"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        key={day}
                                        className="flex flex-row items-start space-x-2 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(day)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, day])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== day
                                                    )
                                                  );
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="text-xs font-normal">
                                          {day}
                                        </FormLabel>
                                      </FormItem>
                                    );
                                  }}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-3 justify-end pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateOpen(false)}
                        >
                          Batal
                        </Button>
                        <Button
                          type="submit"
                          disabled={createShiftMutation.isPending}
                        >
                          {createShiftMutation.isPending ? "Menyimpan..." : "Simpan Template"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Grid of shifts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shifts.map((s) => (
                <Card key={s.id} className="border-border bg-card relative overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-foreground">{s.name}</CardTitle>
                    <CardDescription>Template Jadwal Shift</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Clock className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-sm">
                        {s.startTime} s/d {s.endTime}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground block">Hari Kerja Operasional:</span>
                      <span className="text-xs text-foreground leading-relaxed font-medium block">
                        {formatDays(s.workDays)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {shifts.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
                  <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <span>Belum ada template shift kerja yang dibuat.</span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
