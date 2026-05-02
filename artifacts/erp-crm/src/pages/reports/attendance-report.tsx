import { useListAttendance, useListEmployees } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Users } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

const statusColors: Record<string, string> = {
  present: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800",
  half_day: "bg-orange-100 text-orange-800",
  leave: "bg-blue-100 text-blue-800",
  holiday: "bg-purple-100 text-purple-800",
};

export function AttendanceReport() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.substring(0, 8) + "01";
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);

  const { data: employees } = useListEmployees();
  const { data: attendanceToday } = useListAttendance({ date: today });
  const { data: attendanceAll } = useListAttendance();

  const totalEmployees = employees?.length ?? 0;
  const presentToday = attendanceToday?.filter(a => a.status === "present").length ?? 0;
  const absentToday = attendanceToday?.filter(a => a.status === "absent").length ?? 0;
  const onLeaveToday = attendanceToday?.filter(a => a.status === "leave").length ?? 0;

  const filtered = attendanceAll?.filter(a => {
    if (fromDate && a.date < fromDate) return false;
    if (toDate && a.date > toDate) return false;
    return true;
  }) ?? [];

  const totalDays = filtered.length;
  const presentDays = filtered.filter(a => a.status === "present").length;
  const attendanceRate = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : "0";
  const totalOvertime = filtered.reduce((s, a) => s + (a.overtime ?? 0), 0);

  const byEmployee: Record<string, { name: string; present: number; absent: number; leave: number; overtime: number }> = {};
  filtered.forEach(a => {
    const key = String(a.employeeId);
    const name = (a as any).employeeName ?? `Emp #${a.employeeId}`;
    if (!byEmployee[key]) byEmployee[key] = { name, present: 0, absent: 0, leave: 0, overtime: 0 };
    if (a.status === "present") byEmployee[key].present += 1;
    if (a.status === "absent") byEmployee[key].absent += 1;
    if (a.status === "leave") byEmployee[key].leave += 1;
    byEmployee[key].overtime += a.overtime ?? 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/reports"><ArrowLeft className="w-4 h-4 mr-1" />Reports</Link></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance Report</h1>
          <p className="text-muted-foreground text-sm">Monthly attendance summary, overtime, and absence tracking.</p>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Today's Summary — {today}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Staff", value: totalEmployees, color: "text-foreground" },
            { label: "Present Today", value: presentToday, color: "text-green-600" },
            { label: "Absent Today", value: absentToday, color: "text-red-600" },
            { label: "On Leave", value: onLeaveToday, color: "text-blue-600" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">From</span>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">To</span>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Records", value: totalDays, color: "text-foreground" },
          { label: "Present Days", value: presentDays, color: "text-green-600" },
          { label: "Attendance Rate", value: `${attendanceRate}%`, color: "text-blue-600" },
          { label: "Total Overtime", value: `${totalOvertime.toFixed(1)} hrs`, color: "text-orange-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-5">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b"><h2 className="font-semibold">Attendance Summary by Employee</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-medium">Employee</th>
              <th className="text-center p-3 font-medium text-green-700">Present</th>
              <th className="text-center p-3 font-medium text-red-700">Absent</th>
              <th className="text-center p-3 font-medium text-blue-700">Leave</th>
              <th className="text-right p-3 font-medium">Overtime (hrs)</th>
              <th className="text-right p-3 font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byEmployee).map(([empId, data]) => {
              const total = data.present + data.absent + data.leave;
              const rate = total > 0 ? ((data.present / total) * 100).toFixed(0) : "0";
              return (
                <tr key={empId} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-medium">{data.name}</td>
                  <td className="p-3 text-center text-green-600 font-medium">{data.present}</td>
                  <td className="p-3 text-center text-red-600 font-medium">{data.absent}</td>
                  <td className="p-3 text-center text-blue-600 font-medium">{data.leave}</td>
                  <td className="p-3 text-right">{data.overtime > 0 ? <span className="text-orange-600 font-medium">{data.overtime.toFixed(1)}</span> : "-"}</td>
                  <td className="p-3 text-right"><Badge variant="secondary" className={parseInt(rate) >= 90 ? "bg-green-100 text-green-800" : parseInt(rate) >= 75 ? "bg-orange-100 text-orange-800" : "bg-red-100 text-red-800"}>{rate}%</Badge></td>
                </tr>
              );
            })}
            {Object.keys(byEmployee).length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No attendance data for selected period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
