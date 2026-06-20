import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Employee } from "@shared/schema";

export interface AuthState {
  user: {
    id: string;
    username: string;
    role: "admin" | "employee";
    employeeId: string | null;
  } | null;
  employee: Employee | null;
}

export function useAuth() {
  const { toast } = useToast();

  const { data: auth, error, isLoading, refetch } = useQuery<AuthState | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: Record<string, string>) => {
      return await apiRequest("POST", "/api/auth/login", credentials);
    },
    onSuccess: (data: AuthState) => {
      refetch();
      toast({
        title: "Login Berhasil",
        description: `Selamat datang kembali, ${data.user?.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login Gagal",
        description: error.message || "Username atau password salah",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Logout Berhasil",
        description: "Anda telah keluar dari sistem.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout Gagal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    user: auth?.user ?? null,
    employee: auth?.employee ?? null,
    isLoading,
    error,
    loginMutation,
    logoutMutation,
  };
}
