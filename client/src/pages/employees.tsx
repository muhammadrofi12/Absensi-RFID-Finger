import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  CreditCard,
  Fingerprint,
  Users,
  Loader2,
  Key,
} from "lucide-react";
import type { Employee, InsertEmployee } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";

const employeeFormSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  employeeId: z.string().min(1, "ID Karyawan wajib diisi"),
  department: z.string().min(1, "Departemen wajib dipilih"),
  rfidId: z.string().optional(),
  fingerprintId: z.number().optional(),
  photoUrl: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

const departments = [
  "IT",
  "HR",
  "Finance",
  "Marketing",
  "Operations",
  "Engineering",
  "Sales",
];

export default function Employees() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [createUserPassword, setCreateUserPassword] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const createUserMutation = useMutation({
    mutationFn: async (data: { employeeId: string; username: string; password: string }) => {
      return await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      setIsCreateUserOpen(false);
      setCreateUserPassword("");
      toast({
        title: "Berhasil",
        description: `Akses login web aktif untuk ${selectedEmployee?.name}`,
      });
      setSelectedEmployee(null);
    },
    onError: (err: Error) => {
      toast({
        title: "Gagal mengaktifkan akses",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: "",
      employeeId: "",
      department: "",
      rfidId: "",
      fingerprintId: undefined,
      photoUrl: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertEmployee) => apiRequest("POST", "/api/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({ title: "Berhasil", description: "Karyawan berhasil ditambahkan" });
    },
    onError: () => {
      toast({ title: "Gagal", description: "Gagal menambahkan karyawan", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string } & Partial<InsertEmployee>) =>
      apiRequest("PATCH", `/api/employees/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsEditDialogOpen(false);
      setSelectedEmployee(null);
      form.reset();
      toast({ title: "Berhasil", description: "Data karyawan berhasil diperbarui" });
    },
    onError: () => {
      toast({ title: "Gagal", description: "Gagal memperbarui data", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsDeleteDialogOpen(false);
      setSelectedEmployee(null);
      toast({ title: "Berhasil", description: "Karyawan berhasil dihapus" });
    },
    onError: () => {
      toast({ title: "Gagal", description: "Gagal menghapus karyawan", variant: "destructive" });
    },
  });

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleScanRfid = async () => {
  try {
    setIsScanning(true);
    toast({
      title: "Mode Pendaftaran RFID",
      description: "Tempelkan kartu RFID pada scanner",
    });

    // 1. TELL BACKEND TO ENABLE REGISTER MODE
    await apiRequest("POST", "/api/esp/start-register");

    // 2. MULAI POLLING pending-rfid (sudah ada)
    const interval = setInterval(async () => {
      const pending = await apiRequest("GET", "/api/esp/pending-rfid");
      if (pending && pending.rfidId) {
        form.setValue("rfidId", pending.rfidId);
        toast({
          title: "RFID Terdeteksi",
          description: `ID: ${pending.rfidId}`,
        });

        clearInterval(interval);
        setIsScanning(false);

        // optional bersihkan pending
        await apiRequest("DELETE", "/api/esp/pending-rfid");
      }
    }, 800);

    // Stop scanning after 10s
    setTimeout(() => {
      clearInterval(interval);
      setIsScanning(false);
    }, 10000);

  } catch (err) {
    setIsScanning(false);
    toast({
      title: "Error",
      description: "Gagal mengaktifkan mode scan RFID",
      variant: "destructive",
    });
  }
};


  const openEditDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    form.reset({
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department,
      rfidId: employee.rfidId || "",
      fingerprintId: employee.fingerprintId || undefined,
      photoUrl: employee.photoUrl || "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDeleteDialogOpen(true);
  };

  const onSubmit = (data: EmployeeFormData) => {
    if (selectedEmployee) {
      updateMutation.mutate({ id: selectedEmployee.id, ...data });
    } else {
      createMutation.mutate(data as InsertEmployee);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-employees-title">
            Karyawan
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kelola data karyawan dan perangkat IoT
          </p>
        </div>
        <Button onClick={() => { form.reset(); setIsAddDialogOpen(true); }} data-testid="button-add-employee">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Karyawan
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Users className="h-5 w-5" />
              Daftar Karyawan
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari karyawan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-employee"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Belum ada karyawan</p>
              <p className="text-muted-foreground/60 text-sm mt-1 mb-4">
                Klik tombol "Tambah Karyawan" untuk memulai
              </p>
              <Button variant="outline" onClick={() => { form.reset(); setIsAddDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Karyawan Pertama
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead>RFID</TableHead>
                    <TableHead>Fingerprint</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id} data-testid={`row-employee-${employee.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(employee.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{employee.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {employee.employeeId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{employee.department}</Badge>
                      </TableCell>
                      <TableCell>
                        {employee.rfidId ? (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            <CreditCard className="h-3 w-3 mr-1" />
                            Terdaftar
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Belum
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.fingerprintId ? (
                          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            <Fingerprint className="h-3 w-3 mr-1" />
                            Terdaftar
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Belum
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setIsCreateUserOpen(true);
                            }}
                            title="Aktifkan Login Web"
                          >
                            <Key className="h-4 w-4 text-violet-400" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(employee)}
                            data-testid={`button-edit-${employee.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openDeleteDialog(employee)}
                            data-testid={`button-delete-${employee.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Employee Dialog */}
      <Dialog
        open={isAddDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setIsEditDialogOpen(false);
            setSelectedEmployee(null);
            form.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedEmployee ? "Edit Karyawan" : "Tambah Karyawan Baru"}
            </DialogTitle>
            <DialogDescription>
              {selectedEmployee
                ? "Perbarui data karyawan di bawah ini"
                : "Isi data karyawan baru di bawah ini"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Masukkan nama lengkap"
                        {...field}
                        data-testid="input-employee-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Karyawan</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="EMP001"
                          {...field}
                          data-testid="input-employee-id"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departemen</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-department">
                            <SelectValue placeholder="Pilih departemen" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="rfidId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RFID ID</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder="Scan atau input manual"
                          {...field}
                          data-testid="input-rfid"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleScanRfid}
                        disabled={isScanning}
                        data-testid="button-scan-rfid"
                      >
                        {isScanning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                        <span className="ml-2">Scan</span>
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fingerprintId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fingerprint ID</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="ID Fingerprint"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          value={field.value || ""}
                          data-testid="input-fingerprint"
                        />
                      </FormControl>
                      <Button type="button" variant="outline" disabled data-testid="button-enroll-fingerprint">
                        <Fingerprint className="h-4 w-4" />
                        <span className="ml-2">Enroll</span>
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setIsEditDialogOpen(false);
                    setSelectedEmployee(null);
                    form.reset();
                  }}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-employee"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {selectedEmployee ? "Simpan Perubahan" : "Tambah Karyawan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create User Credentials Dialog */}
      <Dialog
        open={isCreateUserOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateUserOpen(false);
            setCreateUserPassword("");
            setSelectedEmployee(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-slate-900 border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Aktifkan Akses Login Web</DialogTitle>
            <DialogDescription className="text-slate-400">
              Buat kredensial login portal untuk karyawan <strong>{selectedEmployee?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Username / NIP</label>
              <Input
                value={selectedEmployee?.employeeId || ""}
                disabled
                className="bg-slate-950/80 border-white/5 text-slate-400 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-500">Username login disamakan dengan NIP/ID Karyawan secara default.</span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Password Baru</label>
              <Input
                type="password"
                placeholder="Buat password login..."
                value={createUserPassword}
                onChange={(e) => setCreateUserPassword(e.target.value)}
                className="bg-slate-950 border-white/10 text-white focus:border-violet-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
              onClick={() => {
                setIsCreateUserOpen(false);
                setCreateUserPassword("");
                setSelectedEmployee(null);
              }}
            >
              Batal
            </Button>
            <Button
              type="button"
              className="bg-violet-600 hover:bg-violet-500 text-white"
              onClick={() => {
                if (selectedEmployee) {
                  createUserMutation.mutate({
                    employeeId: selectedEmployee.id,
                    username: selectedEmployee.employeeId,
                    password: createUserPassword,
                  });
                }
              }}
              disabled={createUserMutation.isPending || !createUserPassword}
            >
              {createUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aktifkan Akses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Karyawan?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{selectedEmployee?.name}</strong>?
              Data absensi karyawan ini juga akan terhapus. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedEmployee && deleteMutation.mutate(selectedEmployee.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
