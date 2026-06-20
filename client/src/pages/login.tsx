import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ShieldCheck, KeyRound, User, Loader2, Fingerprint } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loginMutation } = useAuth();
  
  // If user is already logged in, redirect to home
  if (user) {
    setLocation("/");
  }

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginValues) => {
    loginMutation.mutate(values, {
      onSuccess: () => {
        setLocation("/");
      },
    });
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-950 text-slate-100">
      {/* Background Gradient Accents */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/30 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-600/30 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-4">
        <Card className="border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-2xl text-violet-400">
                <Fingerprint className="h-10 w-10 animate-pulse" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">Smart Attendance System</CardTitle>
            <CardDescription className="text-slate-400">
              Platform Absensi RFID + Fingerprint & Portal Karyawan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">Username atau NIP</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                          <Input
                            placeholder="Masukkan username/NIP..."
                            className="pl-10 bg-slate-950/50 border-white/10 text-white placeholder-slate-500 focus:border-violet-500"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                          <Input
                            type="password"
                            placeholder="••••••••"
                            className="pl-10 bg-slate-950/50 border-white/10 text-white placeholder-slate-500 focus:border-violet-500"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-violet-500/25"
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memverifikasi...
                    </>
                  ) : (
                    "Masuk ke Dashboard"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 text-center text-xs text-slate-500">
            <div className="flex items-center justify-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
              <span>Sistem Absensi Multi-Role Terenkripsi</span>
            </div>
            <div>
              Default Admin: <code className="text-slate-400 font-mono">admin</code> / <code className="text-slate-400 font-mono">admin123</code>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
