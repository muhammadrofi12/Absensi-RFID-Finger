import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
    Fingerprint,
    RefreshCw,
    Trash2,
    Plus,
    Loader2,
    AlertCircle,
    CheckCircle,
} from "lucide-react";
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

interface FingerprintSlot {
    slotId: number;
    hasFingerprint: boolean;
    employeeId?: string | null;
    employeeName?: string | null;
}

export default function FingerprintsPage() {
    const { toast } = useToast();
    const [slots, setSlots] = useState<FingerprintSlot[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [hasData, setHasData] = useState(false);
    const [enrollSlotId, setEnrollSlotId] = useState("");
    const [showEnrollDialog, setShowEnrollDialog] = useState(false);
    const [pendingOperation, setPendingOperation] = useState<string | null>(null);
    const [deleteSlotId, setDeleteSlotId] = useState<number | null>(null);

    // Poll for command result
    const pollForResult = async (
        expectedCommand: string
    ): Promise<{ success: boolean; data?: FingerprintSlot[] }> => {
        setIsPolling(true);
        const maxAttempts = 60;
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const res = await fetch("/api/fingerprints/result");
                const result = await res.json();

                if (result && result.command === expectedCommand) {
                    if (result.success) {
                        toast({
                            title: "Berhasil!",
                            description: result.message || "Operasi selesai",
                        });
                    } else {
                        toast({
                            title: "Gagal",
                            description: result.message || "Operasi gagal",
                            variant: "destructive",
                        });
                    }

                    const resultData = result.data;
                    await fetch("/api/fingerprints/result", { method: "DELETE" });
                    setIsPolling(false);
                    setPendingOperation(null);
                    return { success: result.success, data: resultData };
                }
            } catch (err) {
                // Continue polling
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
            attempts++;
        }

        setIsPolling(false);
        setPendingOperation(null);
        toast({
            title: "Timeout",
            description: "ESP32 tidak merespon",
            variant: "destructive",
        });
        return { success: false };
    };

    // Scan all fingerprints
    const handleScan = async () => {
        setIsScanning(true);
        setPendingOperation("scan_all");

        try {
            await fetch("/api/fingerprints/scan", { method: "POST" });
            toast({
                title: "Scanning...",
                description: "Menunggu ESP32 scan semua slot",
            });

            const result = await pollForResult("scan_all");
            if (result.success && result.data) {
                setSlots(result.data);
                setHasData(true);
            }
        } catch (err) {
            toast({
                title: "Error",
                description: "Gagal mengirim perintah scan",
                variant: "destructive",
            });
        } finally {
            setIsScanning(false);
        }
    };

    // Delete fingerprint
    const handleDelete = async (slotId: number) => {
        setDeleteSlotId(null);
        setPendingOperation(`delete_${slotId}`);

        try {
            await fetch(`/api/fingerprints/${slotId}`, { method: "DELETE" });
            toast({
                title: "Menghapus...",
                description: `Menghapus fingerprint di slot ${slotId}`,
            });

            const result = await pollForResult("delete");
            if (result.success) {
                setSlots((prev) => prev.filter((s) => s.slotId !== slotId));
            }
        } catch (err) {
            toast({
                title: "Error",
                description: "Gagal mengirim perintah hapus",
                variant: "destructive",
            });
            setPendingOperation(null);
        }
    };

    // Enroll fingerprint
    const handleEnroll = async () => {
        const slotId = parseInt(enrollSlotId);
        if (isNaN(slotId) || slotId < 1 || slotId > 127) {
            toast({
                title: "Invalid Slot",
                description: "Slot ID harus antara 1-127",
                variant: "destructive",
            });
            return;
        }

        setShowEnrollDialog(false);
        setPendingOperation(`enroll_${slotId}`);

        try {
            await fetch("/api/fingerprints/enroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slotId }),
            });

            toast({
                title: "Enroll Mode",
                description: `Tempelkan jari pada sensor (Slot ${slotId})`,
            });

            const result = await pollForResult("enroll");
            if (result.success) {
                handleScan();
            }
        } catch (err) {
            toast({
                title: "Error",
                description: "Gagal mengirim perintah enroll",
                variant: "destructive",
            });
            setPendingOperation(null);
        }
    };

    // Load existing data on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await fetch("/api/fingerprints");
                const data = await res.json();
                setSlots(data.slots || []);
                setHasData(data.hasData);
            } catch (err) {
                // Ignore
            }
        };
        loadData();
    }, []);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold flex items-center gap-2">
                    <Fingerprint className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    Fingerprint Management
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Kelola data fingerprint di sensor ESP32
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Slot</p>
                                <p className="text-3xl font-semibold mt-1">127</p>
                            </div>
                            <div className="p-3 rounded-md bg-purple-100 dark:bg-purple-900/30">
                                <Fingerprint className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Slot Terisi</p>
                                {isScanning ? (
                                    <Skeleton className="h-8 w-16 mt-1" />
                                ) : (
                                    <p className="text-3xl font-semibold mt-1">{slots.length}</p>
                                )}
                            </div>
                            <div className="p-3 rounded-md bg-green-100 dark:bg-green-900/30">
                                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Slot Kosong</p>
                                {isScanning ? (
                                    <Skeleton className="h-8 w-16 mt-1" />
                                ) : (
                                    <p className="text-3xl font-semibold mt-1">
                                        {127 - slots.length}
                                    </p>
                                )}
                            </div>
                            <div className="p-3 rounded-md bg-amber-100 dark:bg-amber-900/30">
                                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions & Table */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-medium">
                            Data Fingerprint di Sensor
                        </CardTitle>
                        <div className="flex gap-2">
                            <Button
                                onClick={handleScan}
                                disabled={isScanning || isPolling}
                                variant="outline"
                            >
                                {isScanning ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Scan Semua
                            </Button>
                            <Button
                                onClick={() => {
                                    setEnrollSlotId("");
                                    setShowEnrollDialog(true);
                                }}
                                disabled={isPolling}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Tambah
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isPolling && (
                        <div className="mb-4 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-3">
                            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                            <span className="text-sm text-amber-700 dark:text-amber-300">
                                Menunggu respon dari ESP32... ({pendingOperation})
                            </span>
                        </div>
                    )}

                    {!hasData ? (
                        <div className="text-center py-12">
                            <Fingerprint className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-muted-foreground text-sm">
                                Belum ada data fingerprint
                            </p>
                            <p className="text-muted-foreground/60 text-xs mt-1">
                                Klik "Scan Semua" untuk membaca data dari sensor
                            </p>
                        </div>
                    ) : slots.length === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-muted-foreground text-sm">
                                Sensor kosong - tidak ada fingerprint terdaftar
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Slot ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Karyawan</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {slots.map((slot) => (
                                    <TableRow key={slot.slotId}>
                                        <TableCell className="font-mono">#{slot.slotId}</TableCell>
                                        <TableCell>
                                            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                                <Fingerprint className="h-3 w-3 mr-1" />
                                                Terdaftar
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {slot.employeeName ? (
                                                <span className="text-green-600 dark:text-green-400 font-medium">
                                                    {slot.employeeName}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground italic">
                                                    Tidak terhubung
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => setDeleteSlotId(slot.slotId)}
                                                disabled={
                                                    isPolling ||
                                                    pendingOperation === `delete_${slot.slotId}`
                                                }
                                            >
                                                {pendingOperation === `delete_${slot.slotId}` ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Enroll Dialog */}
            <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tambah Fingerprint Baru</DialogTitle>
                        <DialogDescription>
                            Masukkan Slot ID (1-127) untuk menyimpan fingerprint baru
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            type="number"
                            min="1"
                            max="127"
                            placeholder="Slot ID (1-127)"
                            value={enrollSlotId}
                            onChange={(e) => setEnrollSlotId(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowEnrollDialog(false)}
                        >
                            Batal
                        </Button>
                        <Button onClick={handleEnroll}>
                            <Fingerprint className="h-4 w-4 mr-2" />
                            Mulai Enroll
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={deleteSlotId !== null}
                onOpenChange={(open) => !open && setDeleteSlotId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Fingerprint?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Apakah Anda yakin ingin menghapus fingerprint di slot #
                            {deleteSlotId}? Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteSlotId && handleDelete(deleteSlotId)}
                        >
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
