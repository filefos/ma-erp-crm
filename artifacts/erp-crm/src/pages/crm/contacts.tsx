import { useState } from "react";
import { useListContacts, useCreateContact, useDeleteContact } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, ArrowLeft } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { WhatsAppQuickIcon } from "@/components/whatsapp-button";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListContactsQueryKey } from "@workspace/api-client-react";

export function ContactsList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: contacts, isLoading } = useListContacts({ search: search || undefined });
  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(contacts ?? []);
  const create = useCreateContact({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() }); setOpen(false); } } });
  const del = useDeleteContact({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() }); } } });

  const [form, setForm] = useState({ name: "", email: "", phone: "", whatsapp: "", companyName: "", designation: "" });

  const filteredWithSno = filtered.map((c, idx) => ({ ...c, sno: idx + 1 }));

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
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />Add Contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 pt-2">
              {[["name","Name *"],["email","Email"],["phone","Phone"],["whatsapp","WhatsApp"],["companyName","Company"],["designation","Designation"]].map(([k,l]) => (
                <div key={k} className="space-y-1">
                  <Label>{l}</Label>
                  <Input value={(form as any)[k]} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} />
                </div>
              ))}
            </div>
            <Button className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={() => create.mutate({ data: form as any })} disabled={!form.name || create.isPending}>
              {create.isPending ? "Saving..." : "Save Contact"}
            </Button>
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
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No contacts found. Add your first contact.</TableCell></TableRow> :
            filtered.map((c, idx) => (
              <TableRow key={c.id}>
                <TableCell className="text-center text-muted-foreground text-sm font-mono">{idx + 1}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
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
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => del.mutate({ id: c.id })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
