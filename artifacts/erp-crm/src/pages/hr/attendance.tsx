import { useState } from "react";
import { useListAttendance, useListEmployees } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";

const statusColors: Record<string, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  absent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  half_day: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  leave: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  holiday: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

export function AttendanceList() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const { data: attendance, isLoading } = useListAttendance({ date: date || undefined });
  const { data: employees } = useListEmployees();

  const filtered = attendance?.filter(a => employeeFilter === "all" || a.employeeId === parseInt(employeeFilter, 10));

  const present = filtered?.filter(a => a.status === "present").length ?? 0;
  const absent = filtered?.filter(a => a.status === "absent").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">Daily attendance tracking with GPS verification.</p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{present}</div>
            <div className="text-xs text-muted-foreground">Present</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{absent}</div>
            <div className="text-xs text-muted-foreground">Absent</div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" />
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Overtime</TableHead>
              <TableHead>GPS</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No attendance records for this date.</TableCell></TableRow> :
            filtered?.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{(a as any).employeeName || `Emp #${a.employeeId}`}</TableCell>
                <TableCell>{a.date}</TableCell>
                <TableCell>{a.checkIn || "-"}</TableCell>
                <TableCell>{a.checkOut || "-"}</TableCell>
                <TableCell>{a.overtime ? `${a.overtime} hrs` : "-"}</TableCell>
                <TableCell>
                  {a.latitude && a.longitude
                    ? <a href={`https://maps.google.com/?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline text-sm"><MapPin className="w-3 h-3" />View</a>
                    : <span className="text-muted-foreground text-sm">-</span>}
                </TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[a.status] ?? ""}>{a.status?.replace("_"," ")}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
