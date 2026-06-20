import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Check, X, FileText, Plus, AlertCircle, Sparkles, UserCheck } from "lucide-react";
import { format } from "date-fns";

const leaveSchema = z.object({
  type: z.string().min(1, "Jenis cuti wajib dipilih"),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
  endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
  reason: z.string().min(5, "Alasan minimal 5 karakter"),
});

type LeaveValues = z.infer<typeof leaveSchema>;

export default function Leave() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("requests");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  // Queries
  const { data: leaveRequests = [], isLoading: isLoadingRequests } = useQuery<any[]>({
    queryKey: ["/api/leave"],
  });

  const { data: leaveBalances = [], isLoading: isLoadingBalances } = useQuery<any[]>({
    queryKey: ["/api/leave/balances"],
  });

  // Form for employee
  const form = useForm<LeaveValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      type: "annual",
      startDate: "",
      endDate: "",
      reason: "",
    },
  });

  // Mutations
  const createLeaveMutation = useMutation({
    mutationFn: async (values: LeaveValues) => {
      return await apiRequest("POST", "/api/leave", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/balances"] });
      form.reset();
      toast({
        title: "Pengajuan Cuti Berhasil",
        description: "Pengajuan Anda telah dikirim dan menunggu persetujuan HR.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Pengajuan Cuti Gagal",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return await apiRequest("POST", `/api/leave/${id}/approve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/balances"] });
      setIsApproveOpen(false);
      setActionNotes("");
      toast({
        title: "Pengajuan Disetujui",
        description: "Status pengajuan cuti telah diperbarui menjadi disetujui.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Gagal Memproses",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return await apiRequest("POST", `/api/leave/${id}/reject`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/balances"] });
      setIsRejectOpen(false);
      setActionNotes("");
      toast({
        title: "Pengajuan Ditolak",
        description: "Status pengajuan cuti telah diperbarui menjadi ditolak.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Gagal Memproses",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: LeaveValues) => {
    createLeaveMutation.mutate(values);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none px-2.5 py-0.5">Disetujui</Badge>;
      case "rejected":
        return <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-none px-2.5 py-0.5">Ditolak</Badge>;
      default:
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none px-2.5 py-0.5 animate-pulse">Menunggu</Badge>;
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case "annual":
        return "Cuti Tahunan";
      case "sick":
        return "Sakit";
      case "permit":
        return "Izin Penting";
      case "maternity":
        return "Cuti Melahirkan";
      default:
        return type;
    }
  };

  const calculateDays = (start: string, end: string) => {
    try {
      const s = new Date(start);
      const e = new Date(end);
      const diff = Math.abs(e.getTime() - s.getTime());
      return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    } catch {
      return 0;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {user?.role === "admin" ? "Manajemen Cuti & Izin" : "Pengajuan Cuti Anda"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === "admin"
              ? "Kelola saldo cuti karyawan, tinjau permohonan masuk, dan verifikasi persetujuan."
              : "Ajukan cuti secara mandiri, pantau saldo kuota cuti tahunan, dan riwayat permohonan."}
          </p>
        </div>
      </div>

      {user?.role === "employee" ? (
        // ============================================================
        // EMPLOYEE VIEW
        // ============================================================
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Balances & Submit Form */}
          <div className="lg:col-span-1 space-y-6">
            {/* Saldo Cuti */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Sisa Kuota Cuti ({new Date().getFullYear()})
                </CardTitle>
                <CardDescription>Sisa jatah cuti yang dapat digunakan</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {leaveBalances.map((bal) => (
                  <div key={bal.id} className="col-span-2 grid grid-cols-2 gap-4">
                    <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-xl text-center">
                      <span className="text-xs text-muted-foreground block mb-1">Cuti Tahunan</span>
                      <span className="text-2xl font-bold text-primary">
                        {bal.annualTotal - bal.annualUsed} <span className="text-xs font-normal text-muted-foreground">Hari</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 block mt-1">Terpakai: {bal.annualUsed}/{bal.annualTotal}</span>
                    </div>
                    <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-center">
                      <span className="text-xs text-muted-foreground block mb-1">Cuti Sakit</span>
                      <span className="text-2xl font-bold text-emerald-500">
                        {bal.sickTotal - bal.sickUsed} <span className="text-xs font-normal text-muted-foreground">Hari</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 block mt-1">Terpakai: {bal.sickUsed}/{bal.sickTotal}</span>
                    </div>
                  </div>
                ))}
                {leaveBalances.length === 0 && (
                  <div className="col-span-2 text-center py-4 text-muted-foreground text-sm">
                    Memuat jatah cuti...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Form Pengajuan */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Form Pengajuan Cuti
                </CardTitle>
                <CardDescription>Isi detail pengajuan cuti baru</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jenis Cuti</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih jenis cuti" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="annual">Cuti Tahunan</SelectItem>
                              <SelectItem value="sick">Sakit (Butuh Surat Keterangan)</SelectItem>
                              <SelectItem value="permit">Izin Penting</SelectItem>
                              <SelectItem value="maternity">Cuti Melahirkan</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tanggal Mulai</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tanggal Selesai</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alasan Cuti</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Jelaskan keperluan cuti Anda secara detail..."
                              className="min-h-[90px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={createLeaveMutation.isPending}
                      className="w-full"
                    >
                      {createLeaveMutation.isPending ? "Mengirim..." : "Kirim Pengajuan Cuti"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Right: Personal History Table */}
          <div className="lg:col-span-2">
            <Card className="border-border bg-card h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Riwayat Pengajuan Cuti Anda
                </CardTitle>
                <CardDescription>Daftar seluruh cuti yang Anda ajukan</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Jenis Cuti</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Durasi</TableHead>
                      <TableHead>Alasan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-6">Catatan HR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-semibold text-foreground pl-6">
                          {getLeaveTypeLabel(req.type)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {req.startDate} s/d {req.endDate}
                        </TableCell>
                        <TableCell className="text-foreground font-medium">
                          {calculateDays(req.startDate, req.endDate)} Hari
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate text-xs">
                          {req.reason}
                        </TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-muted-foreground italic text-xs pr-6">
                          {req.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {leaveRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Belum ada riwayat pengajuan cuti.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        // ============================================================
        // ADMIN / HR VIEW
        // ============================================================
        <Tabs defaultValue="incoming" className="w-full space-y-6">
          <TabsList>
            <TabsTrigger value="incoming">
              Permohonan Masuk ({leaveRequests.filter((r: any) => r.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="history">
              Riwayat Cuti
            </TabsTrigger>
            <TabsTrigger value="balances">
              Saldo Cuti Karyawan
            </TabsTrigger>
          </TabsList>

          {/* Incoming Requests */}
          <TabsContent value="incoming">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Persetujuan Cuti Masuk
                </CardTitle>
                <CardDescription>Tinjau pengajuan cuti karyawan dan tentukan persetujuan.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Karyawan</TableHead>
                      <TableHead>Jenis Cuti</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Durasi</TableHead>
                      <TableHead>Alasan</TableHead>
                      <TableHead className="text-center pr-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests
                      .filter((req) => req.status === "pending")
                      .map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="pl-6">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{req.employeeName}</span>
                              <span className="text-xs text-muted-foreground">{req.employeeIdCode} - {req.department}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-foreground">{getLeaveTypeLabel(req.type)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {req.startDate} s/d {req.endDate}
                          </TableCell>
                          <TableCell className="text-foreground font-semibold">
                            {calculateDays(req.startDate, req.endDate)} Hari
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate" title={req.reason}>
                            {req.reason}
                          </TableCell>
                          <TableCell className="text-center pr-6">
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setIsApproveOpen(true);
                                }}
                              >
                                <Check className="h-4 w-4 mr-1" /> Setujui
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setIsRejectOpen(true);
                                }}
                              >
                                <X className="h-4 w-4 mr-1" /> Tolak
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {leaveRequests.filter((req) => req.status === "pending").length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Tidak ada pengajuan cuti pending saat ini.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Riwayat Pengolahan Cuti
                </CardTitle>
                <CardDescription>Semua pengajuan cuti yang telah disetujui atau ditolak.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Karyawan</TableHead>
                      <TableHead>Jenis Cuti</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Durasi</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-6">Catatan HR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests
                      .filter((req) => req.status !== "pending")
                      .map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="pl-6">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{req.employeeName}</span>
                              <span className="text-xs text-muted-foreground">{req.employeeIdCode} - {req.department}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-foreground">{getLeaveTypeLabel(req.type)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {req.startDate} s/d {req.endDate}
                          </TableCell>
                          <TableCell className="text-foreground font-semibold">
                            {calculateDays(req.startDate, req.endDate)} Hari
                          </TableCell>
                          <TableCell>{getStatusBadge(req.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs pr-6 italic">
                            {req.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    {leaveRequests.filter((req) => req.status !== "pending").length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Belum ada riwayat pengajuan cuti yang diolah.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balances */}
          <TabsContent value="balances">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Ketersediaan Saldo Cuti Karyawan
                </CardTitle>
                <CardDescription>Pantau jatah tahunan dan sakit per karyawan.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Karyawan</TableHead>
                      <TableHead>Cuti Tahunan (Tersisa/Total)</TableHead>
                      <TableHead>Telah Dipakai</TableHead>
                      <TableHead>Cuti Sakit (Tersisa/Total)</TableHead>
                      <TableHead className="pr-6">Telah Dipakai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveBalances.map((bal) => (
                      <TableRow key={bal.id}>
                        <TableCell className="pl-6">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{bal.employeeName}</span>
                            <span className="text-xs text-muted-foreground">{bal.employeeIdCode} - {bal.department}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-primary font-bold">
                          {bal.annualTotal - bal.annualUsed} / {bal.annualTotal} Hari
                        </TableCell>
                        <TableCell className="text-muted-foreground font-medium">
                          {bal.annualUsed} Hari
                        </TableCell>
                        <TableCell className="text-emerald-500 font-bold">
                          {bal.sickTotal - bal.sickUsed} / {bal.sickTotal} Hari
                        </TableCell>
                        <TableCell className="text-muted-foreground font-medium pr-6">
                          {bal.sickUsed} Hari
                        </TableCell>
                      </TableRow>
                    ))}
                    {leaveBalances.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Tidak ada data saldo cuti karyawan.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Dialog: Approval Notes */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setujui Pengajuan Cuti</DialogTitle>
            <DialogDescription>
              Pengajuan oleh <strong>{selectedRequest?.employeeName}</strong> selama{" "}
              <strong>{selectedRequest ? calculateDays(selectedRequest.startDate, selectedRequest.endDate) : 0} Hari</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Catatan HR (Opsional)</label>
              <Textarea
                placeholder="Tulis pesan atau catatan persetujuan untuk karyawan..."
                className="min-h-[80px]"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={() => approveMutation.mutate({ id: selectedRequest.id, notes: actionNotes })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "Memproses..." : "Setujui Permohonan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reject Notes */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Pengajuan Cuti</DialogTitle>
            <DialogDescription>
              Pengajuan oleh <strong>{selectedRequest?.employeeName}</strong> selama{" "}
              <strong>{selectedRequest ? calculateDays(selectedRequest.startDate, selectedRequest.endDate) : 0} Hari</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Alasan Penolakan (Wajib)</label>
              <Textarea
                placeholder="Tulis alasan mengapa pengajuan cuti ini ditolak..."
                className="min-h-[80px]"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-500 text-white"
              onClick={() => rejectMutation.mutate({ id: selectedRequest.id, notes: actionNotes })}
              disabled={rejectMutation.isPending || !actionNotes.trim()}
            >
              {rejectMutation.isPending ? "Memproses..." : "Tolak Permohonan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
