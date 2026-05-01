import { useListAuditLogs } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const actionColors: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  approve: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  login: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function AuditLogsList() {
  const { data: logs, isLoading } = useListAuditLogs();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">Complete trail of all system actions and changes.</p>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            logs?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No audit logs found.</TableCell></TableRow> :
            logs?.map(log => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{log.userName || `User #${log.userId}`}</TableCell>
                <TableCell><Badge variant="secondary" className={actionColors[log.action] ?? ""}>{log.action}</Badge></TableCell>
                <TableCell className="capitalize">{log.entity?.replace("_"," ")}{log.entityId ? ` #${log.entityId}` : ""}</TableCell>
                <TableCell className="text-sm max-w-xs truncate">{log.details || "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{log.ipAddress || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
