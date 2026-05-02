import type { ReactElement } from "react";
import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Info, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListNotificationsQueryKey } from "@workspace/api-client-react";

const typeIcons: Record<string, ReactElement> = {
  info: <Info className="w-4 h-4 text-blue-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  error: <XCircle className="w-4 h-4 text-red-500" />,
  success: <CheckCircle className="w-4 h-4 text-green-500" />,
};

export function NotificationsList() {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useListNotifications();
  const markRead = useMarkNotificationRead({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) } });
  const markAll = useMarkAllNotificationsRead({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) } });

  const unread = notifications?.filter(n => !n.isRead).length ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">{unread > 0 ? `${unread} unread notifications` : "All notifications read"}</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
            <CheckCheck className="w-4 h-4 mr-2" />Mark All Read
          </Button>
        )}
      </div>
      {isLoading ? <div className="text-muted-foreground text-center py-8">Loading...</div> :
      notifications?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-medium text-muted-foreground">No notifications</h3>
          <p className="text-sm text-muted-foreground">You are all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications?.map(n => (
            <div key={n.id} className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${n.isRead ? "bg-card opacity-70" : "bg-card border-l-4 border-l-primary"}`}>
              <div className="mt-0.5">{typeIcons[n.type] ?? <Info className="w-4 h-4 text-blue-500" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                  {!n.isRead && <Badge variant="secondary" className="bg-primary text-primary-foreground text-xs px-1.5 py-0">New</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.isRead && (
                <Button variant="ghost" size="sm" className="shrink-0 text-xs h-7" onClick={() => markRead.mutate({ id: n.id })}>
                  Mark Read
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
