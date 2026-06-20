import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  CalendarCheck2,
  LogOut,
  Wifi,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

interface AppSidebarProps {
  espConnected?: boolean;
}

export function AppSidebar({ espConnected = false }: AppSidebarProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const adminMenuItems = [
    { title: "Dashboard HR", url: "/", icon: LayoutDashboard },
    { title: "Karyawan", url: "/employees", icon: Users },
    { title: "Log Absensi", url: "/attendance", icon: ClipboardList },
    { title: "Cuti & Izin", url: "/leave", icon: CalendarCheck2 },
    { title: "Shift Kerja", url: "/shifts", icon: Calendar },
  ];

  const employeeMenuItems = [
    { title: "Dashboard Personal", url: "/", icon: LayoutDashboard },
    { title: "Pengajuan Cuti", url: "/leave", icon: CalendarCheck2 },
    { title: "Jadwal Shift", url: "/shifts", icon: Calendar },
  ];

  const menuItems = user?.role === "admin" ? adminMenuItems : employeeMenuItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wifi className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Attendance</span>
            <span className="text-xs text-muted-foreground">IoT System</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={isActive ? "bg-sidebar-accent" : ""}
                    >
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border space-y-3">
        {user && (
          <div className="flex flex-col gap-1 pb-1 border-b border-sidebar-border/50">
            <span className="text-sm font-semibold text-sidebar-foreground truncate">
              {user.username}
            </span>
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
              {user.role}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              espConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            ESP32 {espConnected ? "Terhubung" : "Tidak Terhubung"}
          </span>
          {espConnected && (
            <Badge variant="secondary" className="ml-auto text-xs">
              Online
            </Badge>
          )}
        </div>
        {user && (
          <SidebarMenuButton
            onClick={() => logoutMutation.mutate()}
            className="w-full text-red-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar</span>
          </SidebarMenuButton>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
