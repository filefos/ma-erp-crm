import { useState } from "react";
import { useListAttendance, useCreateAttendance, useListEmployees } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Plus, UserCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: "", date: today, status: "present",
    checkIn: "08:00", checkOut: "17:00", overtime: "", notes: "",
  });
  const queryClient = useQueryClient();
  const { data: attendance, isLoading } = useListAttendance({ date: date || undefined });
  const { data: employees } = useListEmployees();
  const create = useCreateAttendance({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/attendance"] });
        setOpen(false);
        setForm({ employeeId: "", date: today, status: "present", checkIn: "08:00", checkOut: "17:00", overtime: "", notes: "" });
      },
    },
  });

  const filtered = attendance?.filter(a => employeeFilter === "all" || a.employeeId === parseInt(employeeFilter, 10));

  const present = filtered?.filter(a => a.status === "present").length ?? 0;
  const absent = filtered?.filter(a => a.status === "absent").length ?? 0;
  const leave = filtered?.filter(a => a.status === "leave").length ?? 0;
  const halfDay = filtered?.filter(a => a.status === "half_day").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">Daily attendance tracking with GPS verification.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
              <Plus className="w-4 h-4 mr-2" />Mark Attendance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Mark Attendance</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1 col-span-2"><Label>Employee *</Label>
                <Select value={form.employeeId} onValueChange={v => setForm(p => ({...p, employeeId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name} — {e.employeeId}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Status *</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({...p, status: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">✅ Present</SelectItem>
                    <SelectItem value="absent">❌ Absent</SelectItem>
                    <SelectItem value="half_day">⚡ Half Day</SelectItem>
                    <SelectItem value="leave">🏖️ Leave</SelectItem>
                    <SelectItem value="holiday">🎉 Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {["present","half_day"].includes(form.status) && (
                <>
                  <div className="space-y-1"><Label>Check In</Label><Input type="time" value={form.checkIn} onChange={e => setForm(p => ({...p, checkIn: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Check Out</Label><Input type="time" value={form.checkOut} onChange={e => setForm(p => ({...p, checkOut: e.target.value}))} /></div>
                  <div className="space-y-1 col-span-2"><Label>Overtime (hours)</Label><Input type="number" step="0.5" value={form.overtime} onChange={e => setForm(p => ({...p, overtime: e.target.value}))} placeholder="0" /></div>
                </>
              )}
              <div className="space-y-1 col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Reason for absence, leave type, etc." /></div>
            </div>
            <Button
              className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={() => create.mutate({ data: { ...form, employeeId: parseInt(form.employeeId, 10), overtime: form.overtime ? parseFloat(form.overtime) : undefined } as any })}
              disabled={!form.employeeId || !form.date || create.isPending}
            >
              {create.isPending ? "Saving..." : "Mark Attendance"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Present", value: present, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "Absent", value: absent, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
          { label: "Leave", value: leave, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Half Day", value: halfDay, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border rounded-lg p-3 text-center`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
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
              <TableHead>Emp ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Overtime</TableHead>
              <TableHead>GPS</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                No attendance records for this date.
              </TableCell></TableRow>
            ) :
            filtered?.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{(a as any).employeeName || `Emp #${a.employeeId}`}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{(a as any).employeeId}</TableCell>
                <TableCell>{a.date}</TableCell>
                <TableCell className="font-mono text-sm">{a.checkIn || "-"}</TableCell>
                <TableCell className="font-mono text-sm">{a.checkOut || "-"}</TableCell>
                <TableCell>{a.overtime ? <span className="text-amber-600 font-medium">{a.overtime} hrs</span> : "-"}</TableCell>
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
