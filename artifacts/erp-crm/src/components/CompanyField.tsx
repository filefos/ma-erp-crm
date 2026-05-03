import { useEffect } from "react";
import { useListCompanies } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface CompanyFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Drop-in company selector that respects per-user company scope.
 *
 * The /companies endpoint already filters by the caller's accessible
 * companies, so this component simply:
 *
 *  - When the user has access to a single company: auto-fills the value
 *    once and renders a read-only badge (no dropdown). The user never
 *    sees the other company's name.
 *  - When the user has access to multiple companies (admins): renders a
 *    Select with only the allowed options.
 *  - While companies are loading: renders a disabled placeholder so the
 *    surrounding form layout stays stable.
 */
export function CompanyField({ value, onChange, disabled, placeholder = "Select" }: CompanyFieldProps) {
  const { data: companies, isLoading } = useListCompanies();

  // Auto-select when the user only has one company.
  useEffect(() => {
    if (!companies || companies.length !== 1) return;
    const only = String(companies[0]!.id);
    if (value !== only) onChange(only);
  }, [companies, value, onChange]);

  if (isLoading || !companies) {
    return (
      <div className="h-10 px-3 rounded-md border border-input bg-muted/30 flex items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="h-10 px-3 rounded-md border border-destructive/30 bg-destructive/5 flex items-center text-sm text-destructive">
        No company access
      </div>
    );
  }

  if (companies.length === 1) {
    const c = companies[0]!;
    return (
      <div className="h-10 px-3 rounded-md border border-input bg-muted/30 flex items-center gap-2 text-sm font-medium">
        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{c.shortName ?? c.name}</span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {companies.map(c => (
          <SelectItem key={c.id} value={String(c.id)}>
            {c.shortName ?? c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
