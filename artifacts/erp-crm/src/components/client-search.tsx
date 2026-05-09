import { useState, useRef, useEffect } from "react";
import { useListContacts, getListContactsQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, User } from "lucide-react";
import type { Contact } from "@workspace/api-client-react";

interface ClientSearchProps {
  value?: string;
  onSelect: (contact: Contact) => void;
  onClear: () => void;
  companyId?: string | number;
  placeholder?: string;
  className?: string;
}

export function ClientSearch({ value, onSelect, onClear, placeholder = "Search client by name, code, phone, email…", className }: ClientSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const searchParams = { search: query || undefined };
  const { data: contacts = [] } = useListContacts(searchParams, {
    query: {
      queryKey: getListContactsQueryKey(searchParams),
      enabled: open || query.length > 0,
    },
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (value) {
    return (
      <div className={`flex items-center gap-2 rounded-md border bg-blue-50 border-blue-200 px-3 py-2 ${className ?? ""}`}>
        <User className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
        <span className="text-sm font-medium text-blue-900 flex-1 truncate">{value}</span>
        <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300 bg-white">Master</Badge>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-blue-400 hover:text-blue-700 flex-shrink-0" onClick={onClear}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-8 text-sm"
        />
      </div>
      {open && contacts.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
          {contacts.slice(0, 20).map(c => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-accent text-sm border-b last:border-b-0 transition-colors"
              onMouseDown={e => {
                e.preventDefault();
                onSelect(c);
                setQuery("");
                setOpen(false);
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.companyName || c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[c.name !== c.companyName && c.name, c.phone, c.email].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {c.clientCode && (
                  <Badge variant="outline" className="text-[10px] font-mono flex-shrink-0">{c.clientCode}</Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query.length > 0 && contacts.length === 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-md px-3 py-3 text-sm text-muted-foreground">
          No clients found for "{query}". You can still type the name manually below.
        </div>
      )}
    </div>
  );
}
