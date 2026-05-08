import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListCompanies } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  FileText,
  FileImage,
  File,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  X,
  Pencil,
  Building2,
} from "lucide-react";
import { authHeaders } from "@/lib/ai-client";

const BASE = import.meta.env.BASE_URL;
const MAX_MB = 25;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx";
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const STANDARD_CATEGORIES = [
  "Trade Licence",
  "Accounts Detail",
  "VAT Certificate",
  "Corporate Certificate",
  "Tenancy Contract",
  "Partner Detail",
  "MOA Certificate",
  "Establishment Card",
  "Emirates ID",
  "Passport",
  "Driving Licence",
  "Vehicle Registration",
];
const CUSTOM_CATEGORY = "More Attachment With Name";

interface DocRecord {
  id: number;
  companyId: number;
  category: string;
  customName: string | null;
  fileName: string;
  contentType: string;
  fileSize: number | null;
  revisionNumber: number;
  status: string;
  remarks: string | null;
  uploadedByName: string | null;
  uploadDate: string | null;
  createdAt: string;
}

interface UploadedFile {
  name: string;
  content: string;
  size: number;
  type: string;
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function revisionLabel(
  cat: string,
  rev: number,
  customName?: string | null
): string {
  const base = customName || cat;
  if (rev === 0) return base;
  return `${base} R${rev}`;
}

function FileIcon({ contentType }: { contentType: string }) {
  if (contentType.includes("pdf"))
    return <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (contentType.includes("image"))
    return <FileImage className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  return <File className="w-4 h-4 text-gray-500 flex-shrink-0" />;
}

export function CompanyDocuments() {
  const { user } = useAuth();
  const { activeCompanyId } = useActiveCompany();
  const { data: companies } = useListCompanies();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    activeCompanyId ?? null
  );
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set(STANDARD_CATEGORIES.slice(0, 4))
  );

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadCustomName, setUploadCustomName] = useState("");
  const [uploadRemarks, setUploadRemarks] = useState("");
  const [uploadFile, setUploadFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);

  // Replace state
  const [replaceDoc, setReplaceDoc] = useState<DocRecord | null>(null);
  const [replaceFile, setReplaceFile] = useState<UploadedFile | null>(null);
  const [keepPreviousOpen, setKeepPreviousOpen] = useState(false);

  // Other dialogs
  const [viewDoc, setViewDoc] = useState<DocRecord | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocRecord | null>(null);
  const [editRemarksDoc, setEditRemarksDoc] = useState<DocRecord | null>(null);
  const [editRemarksVal, setEditRemarksVal] = useState("");

  // Custom group inline add
  const [customGroupName, setCustomGroupName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = user?.role === "super_admin";
  const companyId =
    selectedCompanyId ?? (companies?.[0]?.id ?? null);

  const { data: docs = [], isLoading } = useQuery<DocRecord[]>({
    queryKey: ["company-documents", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const r = await fetch(
        `${BASE}api/company-documents?companyId=${companyId}`,
        { headers: authHeaders() }
      );
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    enabled: !!companyId,
  });

  async function readFile(f: File): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      if (!ALLOWED_TYPES.has(f.type)) {
        reject(new Error("File type not allowed. Use PDF, JPG, PNG, DOC, DOCX, XLS, XLSX."));
        return;
      }
      if (f.size > MAX_MB * 1_048_576) {
        reject(new Error(`Max file size is ${MAX_MB} MB`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve({ name: f.name, content: base64, size: f.size, type: f.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  function openUpload(category: string, customName = "") {
    setUploadCategory(category);
    setUploadCustomName(customName);
    setUploadRemarks("");
    setUploadFile(null);
    setUploadOpen(true);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    readFile(f)
      .then(setUploadFile)
      .catch((err) =>
        toast({ title: "File error", description: err.message, variant: "destructive" })
      );
  }

  function handleReplaceFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    readFile(f)
      .then((data) => {
        setReplaceFile(data);
        setKeepPreviousOpen(true);
      })
      .catch((err) =>
        toast({ title: "File error", description: err.message, variant: "destructive" })
      );
  }

  async function handleUpload() {
    if (!uploadFile || !companyId || !uploadCategory) return;
    if (uploadCategory === CUSTOM_CATEGORY && !uploadCustomName.trim()) {
      toast({ title: "Please enter a name for this attachment", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const r = await fetch(`${BASE}api/company-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          companyId,
          category: uploadCategory,
          customName:
            uploadCategory === CUSTOM_CATEGORY ? uploadCustomName.trim() : null,
          fileName: uploadFile.name,
          contentType: uploadFile.type,
          fileContent: uploadFile.content,
          fileSize: uploadFile.size,
          remarks: uploadRemarks || null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Document uploaded successfully" });
      qc.invalidateQueries({ queryKey: ["company-documents"] });
      setUploadOpen(false);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleReplace(keepPrevious: boolean) {
    if (!replaceFile || !replaceDoc) return;
    setKeepPreviousOpen(false);
    setUploading(true);
    try {
      const r = await fetch(
        `${BASE}api/company-documents/${replaceDoc.id}/replace`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            keepPrevious,
            fileContent: replaceFile.content,
            fileName: replaceFile.name,
            contentType: replaceFile.type,
            fileSize: replaceFile.size,
          }),
        }
      );
      if (!r.ok) throw new Error(await r.text());
      toast({
        title: keepPrevious
          ? `New revision saved as R${(replaceDoc.revisionNumber ?? 0) + 1}`
          : "Document replaced successfully",
      });
      qc.invalidateQueries({ queryKey: ["company-documents"] });
    } catch (e: any) {
      toast({ title: "Replace failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setReplaceDoc(null);
      setReplaceFile(null);
    }
  }

  async function handleDelete() {
    if (!deleteDoc) return;
    try {
      const r = await fetch(`${BASE}api/company-documents/${deleteDoc.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Document deleted" });
      qc.invalidateQueries({ queryKey: ["company-documents"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleteDoc(null);
    }
  }

  async function handleSaveRemarks() {
    if (!editRemarksDoc) return;
    try {
      const r = await fetch(
        `${BASE}api/company-documents/${editRemarksDoc.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ remarks: editRemarksVal }),
        }
      );
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Remarks saved" });
      qc.invalidateQueries({ queryKey: ["company-documents"] });
      setEditRemarksDoc(null);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  }

  function toggleCat(cat: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  function docsForCategory(cat: string) {
    return docs.filter((d) => d.category === cat);
  }

  const customDocs = docs.filter((d) => d.category === CUSTOM_CATEGORY);
  const customGroups = Array.from(
    new Set(customDocs.map((d) => d.customName ?? "Unnamed"))
  );

  function DocRow({ doc }: { doc: DocRecord }) {
    const label = revisionLabel(
      doc.category,
      doc.revisionNumber,
      doc.customName
    );
    return (
      <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-[#1e6ab0]/30 hover:bg-[#f0f6ff] transition-colors group">
        <FileIcon contentType={doc.contentType} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800 truncate">
              {label}
            </span>
            {doc.revisionNumber > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-700 bg-orange-50"
              >
                R{doc.revisionNumber}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">
              {doc.fileName}
            </span>
            {doc.fileSize != null && (
              <span className="text-[10px] text-muted-foreground">
                ({fmtBytes(doc.fileSize)})
              </span>
            )}
            {doc.uploadDate && (
              <span className="text-[10px] text-muted-foreground">
                {fmtDate(doc.uploadDate)}
              </span>
            )}
            {doc.uploadedByName && (
              <span className="text-[10px] text-muted-foreground">
                by {doc.uploadedByName}
              </span>
            )}
            {doc.remarks && (
              <span className="text-[10px] text-muted-foreground italic">
                "{doc.remarks}"
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            title="View"
            className="h-7 w-7 text-[#1e6ab0]"
            onClick={() => setViewDoc(doc)}
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Download"
            className="h-7 w-7 text-green-600"
            onClick={() => {
              const a = document.createElement("a");
              a.href = `${BASE}api/company-documents/${doc.id}/file?download=1`;
              a.download = doc.fileName;
              a.click();
            }}
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Edit remarks"
            className="h-7 w-7 text-gray-500"
            onClick={() => {
              setEditRemarksDoc(doc);
              setEditRemarksVal(doc.remarks ?? "");
            }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Replace / add revision"
            className="h-7 w-7 text-orange-500"
            onClick={() => {
              setReplaceDoc(doc);
              replaceFileInputRef.current?.click();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            className="h-7 w-7 text-red-500"
            onClick={() => setDeleteDoc(doc)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  function CategorySection({ cat }: { cat: string }) {
    const catDocs = docsForCategory(cat);
    const expanded = expandedCats.has(cat);
    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
          onClick={() => toggleCat(cat)}
        >
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="font-semibold text-sm text-gray-800">{cat}</span>
            {catDocs.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0">
                {catDocs.length} file{catDocs.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-[#1e6ab0] text-[#0f2d5a] hover:bg-[#e8f1fb]"
            onClick={(e) => {
              e.stopPropagation();
              openUpload(cat);
            }}
          >
            <Upload className="w-3 h-3 mr-1" />
            Upload
          </Button>
        </button>
        {expanded && (
          <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-2">
            {catDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No documents uploaded yet.
              </p>
            ) : (
              catDocs.map((d) => <DocRow key={d.id} doc={d} />)
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">
            Company Document
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Store and manage all company-related documents with full revision
            history.
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <Select
              value={String(companyId ?? "__none__")}
              onValueChange={(v) =>
                setSelectedCompanyId(
                  v === "__none__" ? null : parseInt(v, 10)
                )
              }
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select company…" />
              </SelectTrigger>
              <SelectContent>
                {(companies ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading documents…
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Standard categories ── */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
              Standard Documents
            </h2>
            <div className="space-y-2">
              {STANDARD_CATEGORIES.map((cat) => (
                <CategorySection key={cat} cat={cat} />
              ))}
            </div>
          </div>

          {/* ── Custom attachments ── */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
              More Attachment With Name
            </h2>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-4 bg-white">
                <span className="font-semibold text-sm text-gray-800">
                  Custom Attachments
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-[#1e6ab0] text-[#0f2d5a] hover:bg-[#e8f1fb]"
                  onClick={() => setAddingCustom(true)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>

              {/* Inline name input */}
              {addingCustom && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Attachment name (e.g. Insurance Certificate)…"
                      value={customGroupName}
                      onChange={(e) => setCustomGroupName(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customGroupName.trim()) {
                          openUpload(CUSTOM_CATEGORY, customGroupName.trim());
                          setAddingCustom(false);
                          setCustomGroupName("");
                        }
                        if (e.key === "Escape") {
                          setAddingCustom(false);
                          setCustomGroupName("");
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                      disabled={!customGroupName.trim()}
                      onClick={() => {
                        openUpload(CUSTOM_CATEGORY, customGroupName.trim());
                        setAddingCustom(false);
                        setCustomGroupName("");
                      }}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1" />
                      Upload
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setAddingCustom(false);
                        setCustomGroupName("");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Groups */}
              {customGroups.length === 0 && !addingCustom ? (
                <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-6 text-sm text-center text-muted-foreground">
                  No custom attachments yet. Click Add to create one.
                </div>
              ) : (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-4">
                  {customGroups.map((groupName) => {
                    const groupDocs = customDocs.filter(
                      (d) => (d.customName ?? "Unnamed") === groupName
                    );
                    return (
                      <div key={groupName} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide px-1">
                            {groupName}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-[#1e6ab0]"
                            onClick={() =>
                              openUpload(CUSTOM_CATEGORY, groupName)
                            }
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add file
                          </Button>
                        </div>
                        {groupDocs.map((d) => (
                          <DocRow key={d.id} doc={d} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ Upload Dialog ════ */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!v) setUploadOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Upload —{" "}
              {uploadCategory === CUSTOM_CATEGORY
                ? uploadCustomName || CUSTOM_CATEGORY
                : uploadCategory}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {uploadCategory === CUSTOM_CATEGORY && (
              <div className="space-y-1.5">
                <Label>
                  Attachment Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={uploadCustomName}
                  onChange={(e) => setUploadCustomName(e.target.value)}
                  placeholder="e.g. Insurance Certificate"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Remarks / Notes</Label>
              <Textarea
                rows={2}
                value={uploadRemarks}
                onChange={(e) => setUploadRemarks(e.target.value)}
                placeholder="Optional notes…"
              />
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                uploadFile
                  ? "border-green-400 bg-green-50"
                  : "border-gray-200 hover:border-[#1e6ab0] hover:bg-blue-50/30"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-medium text-green-800 text-sm">
                      {uploadFile.name}
                    </div>
                    <div className="text-xs text-green-600">
                      {fmtBytes(uploadFile.size)}
                    </div>
                  </div>
                  <button
                    className="ml-2 text-gray-400 hover:text-red-500 p-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadFile(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">
                    Click to select file
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, JPG, PNG, DOC, DOCX, XLS, XLSX · Max {MAX_MB} MB
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                disabled={
                  uploading ||
                  !uploadFile ||
                  (uploadCategory === CUSTOM_CATEGORY &&
                    !uploadCustomName.trim())
                }
                onClick={handleUpload}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════ View Dialog ════ */}
      <Dialog open={!!viewDoc} onOpenChange={(open) => { if (!open) setViewDoc(null); }}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-sm">
                  {viewDoc &&
                    revisionLabel(
                      viewDoc.category,
                      viewDoc.revisionNumber,
                      viewDoc.customName
                    )}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {viewDoc?.fileName}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-green-700 border-green-300"
                onClick={() => {
                  if (!viewDoc) return;
                  const a = document.createElement("a");
                  a.href = `${BASE}api/company-documents/${viewDoc.id}/file?download=1`;
                  a.download = viewDoc.fileName;
                  a.click();
                }}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {viewDoc &&
              (viewDoc.contentType.startsWith("image/") ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 p-4">
                  <img
                    src={`${BASE}api/company-documents/${viewDoc.id}/file`}
                    alt={viewDoc.fileName}
                    className="max-w-full max-h-full object-contain rounded-lg shadow"
                  />
                </div>
              ) : (
                <iframe
                  src={`${BASE}api/company-documents/${viewDoc.id}/file`}
                  className="w-full h-full border-0"
                  title="Company Document"
                />
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ════ Hidden replace file input ════ */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleReplaceFileSelect}
      />

      {/* ════ Keep previous confirmation ════ */}
      <AlertDialog
        open={keepPreviousOpen}
        onOpenChange={(open) => {
          if (!open) {
            setKeepPreviousOpen(false);
            setReplaceFile(null);
            setReplaceDoc(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Do you want to keep the previous attachment?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {replaceDoc && (
                  <>
                    <p>
                      Current file:{" "}
                      <strong className="text-foreground">
                        {revisionLabel(
                          replaceDoc.category,
                          replaceDoc.revisionNumber,
                          replaceDoc.customName
                        )}
                      </strong>
                    </p>
                    <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-xs">
                      <div className="p-3">
                        <p className="font-semibold text-foreground mb-1">
                          YES — Keep previous
                        </p>
                        <p>
                          Both files are saved. The new file will appear as{" "}
                          <em>
                            {revisionLabel(
                              replaceDoc.category,
                              (replaceDoc.revisionNumber ?? 0) + 1,
                              replaceDoc.customName
                            )}
                          </em>
                          .
                        </p>
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-foreground mb-1">
                          NO — Replace
                        </p>
                        <p>
                          The old file is archived and only the new file is
                          shown.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setKeepPreviousOpen(false);
                setReplaceFile(null);
                setReplaceDoc(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              className="border-orange-400 text-orange-700 hover:bg-orange-50"
              onClick={() => handleReplace(false)}
            >
              No — Replace
            </Button>
            <AlertDialogAction
              className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={() => handleReplace(true)}
            >
              Yes — Keep Previous
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════ Edit Remarks Dialog ════ */}
      <Dialog open={!!editRemarksDoc} onOpenChange={(open) => { if (!open) setEditRemarksDoc(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Remarks</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Textarea
              rows={3}
              value={editRemarksVal}
              onChange={(e) => setEditRemarksVal(e.target.value)}
              placeholder="Add notes about this document…"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditRemarksDoc(null)}>
                Cancel
              </Button>
              <Button
                className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                onClick={handleSaveRemarks}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════ Delete Confirmation ════ */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => { if (!open) setDeleteDoc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete{" "}
              <strong>
                {deleteDoc &&
                  revisionLabel(
                    deleteDoc.category,
                    deleteDoc.revisionNumber,
                    deleteDoc.customName
                  )}
              </strong>{" "}
              ({deleteDoc?.fileName})? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
