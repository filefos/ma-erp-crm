import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { EmailPanel } from "@/pages/email/index";
import { Building2 } from "lucide-react";

const COMPANIES = [
  { id: 1, name: "Prime Max General Trading", short: "PM", prefix: "PM" },
  { id: 2, name: "Elite Prefab Industries", short: "EP", prefix: "EP" },
];

export function AdminEmailPanel() {
  const { user } = useAuth();
  const isSuperAdmin = (user as any)?.permissionLevel === "super_admin";
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(1);

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Access restricted to Super Admin only.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] gap-0">
      {/* Company switcher tabs */}
      <div className="flex items-center gap-0 border-b border-gray-200 bg-white px-4 pt-3 flex-shrink-0">
        <div className="flex items-center gap-1 mr-4">
          <Building2 className="w-4 h-4 text-[#1e6ab0]" />
          <span className="text-xs font-semibold text-[#0f2d5a] uppercase tracking-wide">Company Email</span>
        </div>
        {COMPANIES.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedCompanyId(c.id)}
            className={`relative px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              selectedCompanyId === c.id
                ? "border-[#1e6ab0] text-[#1e6ab0]"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            <span className={`inline-flex items-center gap-1.5`}>
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white ${
                selectedCompanyId === c.id ? "bg-[#1e6ab0]" : "bg-gray-400"
              }`}>
                {c.prefix}
              </span>
              {c.short}
            </span>
          </button>
        ))}
      </div>

      {/* Email panel for selected company — key forces full re-mount on company switch */}
      <div className="flex-1 overflow-hidden">
        <EmailPanel key={selectedCompanyId} companyId={selectedCompanyId} />
      </div>
    </div>
  );
}
