import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function useWebSocket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    function connect() {
      console.log(`[WebSocket] Connecting to ${wsUrl}...`);
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "ATTENDANCE_UPDATE") {
            const actionLabel = data.action === "checkin" ? "Masuk" : "Pulang";
            const timeStr = data.time;
            
            // Invalidate attendance queries and dashboard statistics queries
            queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
            queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
            queryClient.invalidateQueries({ queryKey: ["/api/attendance/recent"] });
            queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
            if (data.employeeId) {
              queryClient.invalidateQueries({ queryKey: [`/api/analytics/employee/${data.employeeId}`] });
              queryClient.invalidateQueries({ queryKey: [`/api/shifts/active/${data.employeeId}`] });
            }
            
            toast({
              title: `🎉 Absensi ${actionLabel} Real-Time!`,
              description: `${data.employeeName} baru saja check-${data.action} pukul ${timeStr}.`,
              duration: 5000,
            });
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      socket.onclose = () => {
        console.log("[WebSocket] Connection closed. Retrying in 5 seconds...");
        reconnectTimeout = setTimeout(() => {
          connect();
        }, 5000);
      };

      socket.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
      };
    }

    connect();

    return () => {
      if (socket) {
        socket.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [queryClient, toast]);
}
