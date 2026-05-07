import { useState } from "react";
import {
  useListContacts, useCreateContact, useDeleteContact,
  useUpdateContact, useCreateLead,
  getListContactsQueryKey, getListLeadsQueryKey,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { WhatsAppQuickIcon } from "@/components/whatsapp-button";
import { BulkUploadDialog } from "@/components/BulkUploadDialog";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { authHeaders } from "@/lib/ai-client";

type ContactForm = {
  name: string; email: string; phone: string; whatsapp: string;
  companyName: string; designation: string; location: string;
};
const emptyForm: ContactForm = { name: "", email: "", phone: "", whatsapp: "", companyName: "", designation: "", location: "" };

const FIELDS: [keyof ContactForm, string][] = [
  ["name", "Name *"], ["companyName", "Company"],
  ["designation", "Designation"], ["location", "Location"],
  ["phone", "Mobile"], ["whatsapp", "WhatsApp"],
  ["email", "Email"],
];

export function ContactsList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: contacts, isLoading } = useListContacts({ search: search || undefined });
  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const filtered = filterByCompany(contacts ?? []);
  const create = useCreateContact();
  const update = useUpdateContact();
  const createLead = useCreateLead();
  const del = useDeleteContact({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() }); } } });

  const [form, setForm] = useState<ContactForm>(emptyForm);
  const filteredWithSno = filtered.map((c, idx) => ({ ...c, sno: idx + 1 }));

  // ── Multi-select state ─────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.id)));
  };
  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selected);
      if (ids.length === 1) {
        await del.mutateAsync({ id: ids[0] });
      } else {
        await fetch(`${import.meta.env.BASE_URL}api/contacts`, {
          method: "DELETE",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ids }),
        });
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
      }
      clearSelection();
      setConfirmDeleteOpen(false);
      toast({ title: `${ids.length} contact${ids.length === 1 ? "" : "s"} deleted` });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── Edit dialog state ──────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editContact, setEditContact] = useState<(typeof filtered)[0] | null>(null);
  const [editForm, setEditForm] = useState<ContactForm>(emptyForm);
  const [convertLoading, setConvertLoading] = useState(false);

  const openEdit = (c: (typeof filtered)[0]) => {
    setEditContact(c);
    setEditForm({
      name: c.name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      whatsapp: c.whatsapp ?? "",
      companyName: c.companyName ?? "",
      designation: c.designation ?? "",
      location: (c as any).location ?? "",
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editContact) return;
    try {
      await update.mutateAsync({ id: editContact.id, data: editForm });
      queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
      setEditOpen(false);
      toast({ title: "Contact updated", description: `${editForm.name} has been saved.` });
    } catch (err: any) {
      toast({ title: "Failed to update contact", description: err?.message || "Unknown error", variant: "destructive" });
    }
  };

  const handleConvertToLead = async () => {
    if (!editContact) return;
    setConvertLoading(true);
    try {
      const newLead = await createLead.mutateAsync({
        data: {
          leadName: editForm.name,
          companyName: editForm.companyName || undefined,
          contactPerson: editForm.name,
          phone: editForm.phone || undefined,
          whatsapp: editForm.whatsapp || undefined,
          email: editForm.email || undefined,
          designation: editForm.designation || undefined,
          status: "new",
          contactId: editContact.id,
          ...(activeCompanyId ? { companyId: activeCompanyId } : {}),
        },
      });
      queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      setEditOpen(false);
      toast({
        title: "Lead created",
        description: `${editForm.name} has been converted to a lead${(newLead as any)?.leadNumber ? ` (${(newLead as any).leadNumber})` : ""}.`,
      });
    } catch (err: any) {
      toast({ title: "Failed to convert to lead", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setConvertLoading(false);
    }
  };

  // ── Add-contact handlers ───────────────────────────────────────────────────
  const handleSave = async (convert: boolean) => {
    try {
      const payload: any = { ...form };
      if (activeCompanyId) payload.companyId = activeCompanyId;
      const created = await create.mutateAsync({ data: payload });
      queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
      setOpen(false);
      setForm(emptyForm);
      if (convert) {
        sessionStorage.setItem("prefillLeadFromContact", JSON.stringify({ ...created, fromContact: true }));
        setLocation("/crm/leads?openNew=1");
      } else {
        toast({
          title: "Contact saved",
          description: created.clientCode ? `Client Code: ${created.clientCode}` : "Saved.",
        });
      }
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      const data = err?.response?.data ?? err?.data;
      if (status === 409 && data?.existingContactId) {
        const existing = data.existingContact;
        toast({
          title: "Contact already exists",
          description: data.message || `Showing existing contact${existing?.name ? `: ${existing.name}` : ""}.`,
          variant: "destructive",
        });
        const term = existing?.phone || existing?.email || existing?.name || "";
        if (term) setSearch(term);
        setOpen(false);
        setForm(emptyForm);
        setTimeout(() => {
          const row = document.querySelector(`[data-contact-row="${data.existingContactId}"]`);
          if (row) {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
            row.classList.add("ring-2", "ring-amber-400", "bg-amber-50");
            setTimeout(() => row.classList.remove("ring-2", "ring-amber-400", "bg-amber-50"), 3000);
          }
        }, 200);
      } else {
        toast({ title: "Failed to save contact", description: err?.message || "Unknown error", variant: "destructive" });
      }
    }
  };

  const goCreateLeadDirect = () => {
    sessionStorage.removeItem("prefillLeadFromContact");
    setLocation("/crm/leads?openNew=1");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/crm">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />Back to CRM
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Manage your client contacts and directory.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={filteredWithSno}
            columns={[
              { header: "S.No.", key: "sno" },
              { header: "Client Code", key: "clientCode" },
              { header: "Name", key: "name" },
              { header: "Company", key: "companyName" },
              { header: "Designation", key: "designation" },
              { header: "Location", key: "location" },
              { header: "Phone", key: "phone" },
              { header: "WhatsApp", key: "whatsapp" },
              { header: "Email", key: "email" },
            ]}
            filename="contacts"
            title="Contacts"
            defaultLandscape={true}
          />
          <Button variant="outline" onClick={goCreateLeadDirect} data-testid="button-convert-to-lead">
            <ArrowRight className="w-4 h-4 mr-2" />Convert To Lead
          </Button>
          <BulkUploadDialog
            title="Import Contacts"
            description="Upload an Excel (.xlsx) or CSV file to bulk-import contacts. Download the template to see the required format."
            triggerLabel="Import Contacts"
            templateFilename="contacts-import-template"
            columns={[
              { key: "name",        label: "Name",        example: "John Doe",
                aliases: ["full name","contact name","client name","customer name","person name","contact","client","person",
                          "contact detail","contact details","contact info","contact information","details","detail"] },
              { key: "companyName", label: "Company",     example: "Acme Corp",
                aliases: ["company name","organisation","organization","firm","employer","account","account name","business","business name"] },
              { key: "designation", label: "Designation", example: "Manager",
                aliases: ["title","job title","position","role","post","department"] },
              { key: "phone",       label: "Mobile",      example: "+971501234567",
                aliases: ["phone","phone number","mobile number","telephone","tel","cell","contact number","mob","contact no"] },
              { key: "whatsapp",    label: "WhatsApp",    example: "+971501234567",
                aliases: ["whatsapp number","wa","wa number","whatsapp no"] },
              { key: "email",       label: "Email",       example: "john@example.com",
                aliases: ["email address","e-mail","e-mail address","mail"] },
              { key: "location",    label: "Location",    example: "Dubai, UAE",
                aliases: ["city","area","address","region","country","emirate","location","place","site"] },
            ]}
            onRow={async (row) => {
              const payload: Record<string, string | number> = {
                name:        row["Name"]        || "",
                companyName: row["Company"]     || "",
                designation: row["Designation"] || "",
                phone:       row["Mobile"]      || "",
                whatsapp:    row["WhatsApp"]    || "",
                email:       row["Email"]       || "",
                location:    row["Location"]    || "",
              };
              if (!payload.name && !payload.phone && !payload.email) throw new Error("Row has no identifiable contact data");
              if (activeCompanyId) payload.companyId = activeCompanyId;
              const res = await fetch(`${import.meta.env.BASE_URL}api/contacts`, {
                method: "POST",
                headers: { ...authHeaders(), "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as any).message ?? `HTTP ${res.status}`);
              }
            }}
            onComplete={() => queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() })}
          />

          {/* Add Contact dialog */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />Add Contact</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 pt-2">
                {FIELDS.map(([k, l]) => (
                  <div key={k} className="space-y-1">
                    <Label>{l}</Label>
                    <Input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Button
                  className="bg-[#0f2d5a] hover:bg-[#1e6ab0] flex-1"
                  onClick={() => handleSave(false)}
                  disabled={!form.name || create.isPending}
                  data-testid="button-save-contact"
                >
                  {create.isPending ? "Saving..." : "Save Contact"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-[#0f2d5a] text-[#0f2d5a]"
                  onClick={() => handleSave(true)}
                  disabled={!form.name || create.isPending}
                  data-testid="button-save-and-convert"
                >
                  Save & Convert to Lead <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk-action toolbar — visible when rows are selected */}
      {selected.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            className="border-red-400"
          />
          <span className="text-sm font-medium text-red-700">
            {selected.size} contact{selected.size === 1 ? "" : "s"} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={bulkDeleting}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete Selected ({selected.size})
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection} className="text-muted-foreground">
            Cancel
          </Button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search contacts..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all contacts"
                />
              </TableHead>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Client Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              : filtered.length === 0
              ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No contacts found. Add your first contact.</TableCell></TableRow>
              : filtered.map((c, idx) => (
                <TableRow
                  key={c.id}
                  data-contact-row={c.id}
                  className={`hover:bg-muted/40 transition-colors ${selected.has(c.id) ? "bg-red-50/60" : ""}`}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleOne(c.id)}
                      aria-label={`Select ${c.name}`}
                    />
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm font-mono">{idx + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{c.clientCode || "-"}</TableCell>
                  <TableCell className="font-medium">
                    <button
                      className="text-[#0f2d5a] hover:underline text-left font-medium"
                      onClick={() => openEdit(c)}
                    >
                      {c.name}
                    </button>
                  </TableCell>
                  <TableCell>{c.companyName || "-"}</TableCell>
                  <TableCell>{c.designation || "-"}</TableCell>
                  <TableCell>{(c as any).location || "-"}</TableCell>
                  <TableCell>{c.phone || "-"}</TableCell>
                  <TableCell>{c.email || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(c.whatsapp || c.phone) && (
                        <WhatsAppQuickIcon
                          phone={c.whatsapp || c.phone}
                          context="contact"
                          contactId={c.id}
                          defaultTemplateId="lead_intro"
                          vars={{ name: c.name, companyName: c.companyName }}
                          testId={`button-wa-contact-${c.id}`}
                        />
                      )}
                      <Button
                        variant="ghost" size="icon"
                        className="text-[#1e6ab0] hover:text-[#0f2d5a]"
                        onClick={() => openEdit(c)}
                        title="Edit contact"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => { setSelected(new Set([c.id])); setConfirmDeleteOpen(true); }}
                        title="Delete contact"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size === 1 ? "Contact" : `${selected.size} Contacts`}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {selected.size === 1 ? "this contact" : `these ${selected.size} contacts`}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmDeleteOpen(false); clearSelection(); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Contact dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            {FIELDS.map(([k, l]) => (
              <div key={k} className="space-y-1">
                <Label>{l}</Label>
                <Input
                  value={editForm[k]}
                  onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button
              className="bg-[#0f2d5a] hover:bg-[#1e6ab0] flex-1"
              onClick={handleEditSave}
              disabled={!editForm.name || update.isPending}
            >
              {update.isPending ? "Saving..." : "Save to Contact"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-[#0f2d5a] text-[#0f2d5a]"
              onClick={handleConvertToLead}
              disabled={!editForm.name || convertLoading || createLead.isPending}
            >
              {convertLoading ? "Converting..." : "Convert to Lead"}
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
