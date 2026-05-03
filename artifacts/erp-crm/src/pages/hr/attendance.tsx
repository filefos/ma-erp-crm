import { useState, useRef, useEffect } from "react";
import { useListAttendance, useCreateAttendance, useListEmployees } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Plus, UserCheck, Camera, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  absent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  half_day: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  leave: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  holiday: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

type GpsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; lat: number; lng: number; accuracy: number }
  | { status: "error"; message: string };

function GpsCapture({ value, onChange }: { value: GpsState; onChange: (s: GpsState) => void }) {
  const capture = () => {
    if (!("geolocation" in navigator)) {
      onChange({ status: "error", message: "GPS is not available on this device." });
      return;
    }
    onChange({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      pos => onChange({
        status: "ok",
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      err => onChange({
        status: "error",
        message: err.code === err.PERMISSION_DENIED
          ? "Location permission denied. Allow location access in your browser settings."
          : err.message || "Could not get GPS location.",
      }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  // Auto-capture once when the dialog mounts.
  useEffect(() => {
    if (value.status === "idle") capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-start gap-2">
        <MapPin className="w-4 h-4 mt-0.5 text-[#1e6ab0] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">GPS Location *</div>
          {value.status === "idle" && (
            <div className="text-xs text-muted-foreground mt-0.5">Tap “Capture location” to record your position.</div>
          )}
          {value.status === "loading" && (
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Getting your location…
            </div>
          )}
          {value.status === "ok" && (
            <>
              <div className="text-xs font-mono mt-0.5">
                {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
              </div>
              <div className="text-[11px] text-muted-foreground">Accuracy ±{Math.round(value.accuracy)} m</div>
              <a
                href={`https://maps.google.com/?q=${value.lat},${value.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#1e6ab0] hover:underline"
              >
                Preview on Google Maps
              </a>
            </>
          )}
          {value.status === "error" && (
            <div className="text-xs text-destructive mt-0.5 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{value.message}</span>
            </div>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={capture} disabled={value.status === "loading"}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          {value.status === "ok" ? "Retake" : "Capture"}
        </Button>
      </div>
    </div>
  );
}

function SelfieCapture({ value, onChange }: { value: string; onChange: (dataUrl: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image.");
      return;
    }
    // Downscale to a reasonable size to keep payload small.
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setError("Could not process image.");
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        onChange(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => setError("Could not load image.");
      img.src = String(reader.result);
    };
    reader.onerror = () => setError("Could not read file.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-start gap-2">
        <Camera className="w-4 h-4 mt-0.5 text-[#1e6ab0] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Selfie at Location *</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Take a wide-angle photo that clearly shows you and the location around you.
          </div>
          {value && (
            <img
              src={value}
              alt="Selfie preview"
              className="mt-2 max-h-40 rounded border"
            />
          )}
          {error && (
            <div className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {error}
            </div>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          <Camera className="w-3.5 h-3.5 mr-1" />
          {value ? "Retake" : "Take photo"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

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

  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(attendance ?? []).filter(a => employeeFilter === "all" || a.employeeId === parseInt(employeeFilter, 10));

  const present = filtered?.filter(a => a.status === "present").length ?? 0;
  const absent = filtered?.filter(a => a.status === "absent").length ?? 0;
  const leave = filtered?.filter(a => a.status === "leave").length ?? 0;
  const halfDay = filtered?.filter(a => a.status === "half_day").length ?? 0;

  // The web admin panel records attendance on behalf of staff — GPS + selfie
  // verification is only enforced on the mobile self-check-in flow.
  const requiresOnSitePresence = ["present", "half_day"].includes(form.status);
  const canSubmit = !!form.employeeId && !!form.date && !create.isPending;

  const submit = () => {
    create.mutate({
      data: {
        ...form,
        employeeId: parseInt(form.employeeId, 10),
        overtime: form.overtime ? parseFloat(form.overtime) : undefined,
      } as any,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">Daily attendance, recorded by HR from the web admin panel.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={(filtered ?? [])}
            columns={[
              { header: "Employee", key: "employeeName" },
              { header: "Date", key: "date" },
              { header: "Status", key: "status" },
              { header: "Check In", key: "checkIn" },
              { header: "Check Out", key: "checkOut" },
              { header: "Overtime (hrs)", key: "overtime" },
              { header: "Notes", key: "notes" },
            ]}
            filename="attendance"
            title="Attendance"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
                <Plus className="w-4 h-4 mr-2" />Mark Attendance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="leave">Leave</SelectItem>
                      <SelectItem value="holiday">Holiday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {requiresOnSitePresence && (
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
                onClick={submit}
                disabled={!canSubmit}
              >
                {create.isPending ? "Saving..." : "Mark Attendance"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Present", value: present, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "Absent", value: absent, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
          { label: "Leave", value: leave, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Half Day", value: halfDay, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
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
              <TableHead>Selfie</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
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
                <TableCell>{a.overtime ? <span className="text-orange-600 font-medium">{a.overtime} hrs</span> : "-"}</TableCell>
                <TableCell>
                  {a.latitude && a.longitude
                    ? <a href={`https://maps.google.com/?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#1e6ab0] hover:underline text-sm"><MapPin className="w-3 h-3" />View</a>
                    : <span className="text-muted-foreground text-sm">-</span>}
                </TableCell>
                <TableCell>
                  {a.selfieUrl
                    ? <a href={a.selfieUrl} target="_blank" rel="noreferrer"><img src={a.selfieUrl} alt="selfie" className="w-8 h-8 rounded object-cover border" /></a>
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
