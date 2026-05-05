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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, ArrowLeft, ArrowRight, Upload, ChevronDown, Pencil } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { WhatsAppQuickIcon } from "@/components/whatsapp-button";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type ContactForm = {
  name: string; email: string; phone: string; whatsapp: string;
  companyName: string; designation: string;
};
const emptyForm: ContactForm = { name: "", email: "", phone: "", whatsapp: "", companyName: "", designation: "" };

const FIELDS: [keyof ContactForm, string][] = [
  ["name", "Name *"], ["designation", "Designation"],
  ["phone", "Mobile"], ["whatsapp", "WhatsApp"],
  ["email", "Email"], ["companyName", "Company"],
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-import-contacts">
                <Upload className="w-4 h-4 mr-2" />Import Contacts <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => toast({ title: "Excel import", description: "Coming in next phase." })}>From Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast({ title: "CSV import", description: "Coming in next phase." })}>From CSV (.csv)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast({ title: "PDF import", description: "Coming in next phase." })}>From PDF (.pdf)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search contacts..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">#</TableHead>
              <TableHead>Client Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              : filtered.length === 0
              ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No contacts found. Add your first contact.</TableCell></TableRow>
              : filtered.map((c, idx) => (
                <TableRow key={c.id} data-contact-row={c.id} className="hover:bg-muted/40">
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
                        onClick={() => del.mutate({ id: c.id })}
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
