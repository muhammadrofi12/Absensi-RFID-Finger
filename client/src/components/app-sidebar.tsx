import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Wifi,
  Fingerprint,
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

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Karyawan", url: "/employees", icon: Users },
  { title: "Log Absensi", url: "/attendance", icon: ClipboardList },
  { title: "Fingerprints", url: "/fingerprints", icon: Fingerprint },
];

interface AppSidebarProps {
  espConnected?: boolean;
}

export function AppSidebar({ espConnected = false }: AppSidebarProps) {
  const [location] = useLocation();

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
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${espConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
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
      </SidebarFooter>
    </Sidebar>
  );
}
