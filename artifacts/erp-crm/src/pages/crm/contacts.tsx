import { useState } from "react";
import { useListContacts, useCreateContact, useDeleteContact } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, MessageCircle, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListContactsQueryKey } from "@workspace/api-client-react";

export function ContactsList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: contacts, isLoading } = useListContacts({ search: search || undefined });
  const create = useCreateContact({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() }); setOpen(false); } } });

  const [form, setForm] = useState({ name: "", email: "", phone: "", whatsapp: "", companyName: "", designation: "" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Manage your client contacts and directory.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Contact</Button>
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
            <Button className="mt-4" onClick={() => create.mutate({ data: form as any })} disabled={!form.name || create.isPending}>
              {create.isPending ? "Saving..." : "Save Contact"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search contacts..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            contacts?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No contacts found. Add your first contact.</TableCell></TableRow> :
            contacts?.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.companyName || "-"}</TableCell>
                <TableCell>{c.designation || "-"}</TableCell>
                <TableCell>{c.phone || "-"}</TableCell>
                <TableCell>{c.email || "-"}</TableCell>
                <TableCell>
                  {c.whatsapp && <Button variant="ghost" size="icon" asChild><a href={`https://wa.me/${c.whatsapp.replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer"><MessageCircle className="w-4 h-4 text-green-600" /></a></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
