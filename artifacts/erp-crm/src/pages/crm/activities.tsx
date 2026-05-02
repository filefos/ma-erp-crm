import { useState } from "react";
import { useListActivities, useCreateActivity } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CheckCircle2, Circle } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { getListActivitiesQueryKey } from "@workspace/api-client-react";

const TYPES = ["call", "email", "meeting", "site_visit", "follow_up", "task", "other"];

export function ActivitiesList() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "call", subject: "", description: "", dueDate: "" });
  const queryClient = useQueryClient();
  const { data: activities, isLoading } = useListActivities();
  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(activities ?? []);
  const create = useCreateActivity({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() }); setOpen(false); } } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
          <p className="text-muted-foreground">Track all CRM activities, tasks and follow-ups.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={filtered as Record<string, unknown>[]}
            columns={[
              { header: "Type", key: "type" },
              { header: "Subject", key: "subject" },
              { header: "Status", key: "status" },
              { header: "Due Date", key: "dueDate" },
              { header: "Description", key: "description" },
            ]}
            filename="activities"
            title="Activities"
          />
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />Add Activity</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Activity</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Type</Label>
                  <Select value={form.type} onValueChange={v => setForm(p => ({...p, type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_"," ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={e => setForm(p => ({...p, dueDate: e.target.value}))} /></div>
              </div>
              <div className="space-y-1"><Label>Subject *</Label><Input value={form.subject} onChange={e => setForm(p => ({...p, subject: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Notes</Label><Textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={3} /></div>
              <Button onClick={() => create.mutate({ data: form as any })} disabled={!form.subject || create.isPending}>
                {create.isPending ? "Saving..." : "Create Activity"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Done</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Created By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No activities found.</TableCell></TableRow> :
            filtered.map((a: any) => (
              <TableRow key={a.id} className={a.isDone ? "opacity-60" : ""}>
                <TableCell>{a.isDone ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{a.type?.replace("_"," ")}</Badge></TableCell>
                <TableCell className="font-medium">{a.subject}</TableCell>
                <TableCell>{a.dueDate || "-"}</TableCell>
                <TableCell>{(a as any).createdByName || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
