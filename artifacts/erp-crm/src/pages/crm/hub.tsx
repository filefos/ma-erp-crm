import { Link } from "wouter";
import { useListLeads, useListContacts, useListDeals, useListActivities } from "@workspace/api-client-react";
import { Users, Briefcase, Calendar, HardHat, ArrowRight, TrendingUp } from "lucide-react";

export function CRMHub() {
  const { data: leads } = useListLeads({});
  const { data: contacts } = useListContacts({});
  const { data: deals } = useListDeals();
  const { data: activities } = useListActivities();

  const hotLeads = leads?.filter(l => l.leadScore === "hot").length ?? 0;
  const activeLeads = leads?.filter(l => !["won","lost"].includes(l.status)).length ?? 0;
  const openDeals = deals?.filter(d => !["won","lost"].includes(d.stage)).length ?? 0;
  const pendingActivities = (activities as any[])?.filter((a: any) => !a.isDone).length ?? 0;

  const sections = [
    {
      href: "/crm/leads",
      icon: TrendingUp,
      label: "Leads",
      description: "Manage sales prospects and inquiries",
      stat: `${activeLeads} active · ${hotLeads} hot`,
      color: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800",
      iconColor: "text-red-600",
      iconBg: "bg-red-100 dark:bg-red-900/20",
    },
    {
      href: "/crm/contacts",
      icon: Users,
      label: "Contacts",
      description: "Client contacts and directory",
      stat: `${contacts?.length ?? 0} contacts`,
      color: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800",
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      href: "/crm/deals",
      icon: Briefcase,
      label: "Deals",
      description: "Track and manage active deals",
      stat: `${openDeals} open deals`,
      color: "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800",
      iconColor: "text-amber-600",
      iconBg: "bg-amber-100 dark:bg-amber-900/20",
    },
    {
      href: "/crm/activities",
      icon: Calendar,
      label: "Activities",
      description: "Tasks, calls and follow-ups",
      stat: `${pendingActivities} pending`,
      color: "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800",
      iconColor: "text-purple-600",
      iconBg: "bg-purple-100 dark:bg-purple-900/20",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
        <p className="text-muted-foreground">Customer Relationship Management — leads, contacts, deals and activities.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map(s => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <div className={`border rounded-xl p-5 cursor-pointer hover:shadow-md transition-all ${s.color}`}>
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                    <Icon className={`w-5 h-5 ${s.iconColor}`} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground mt-1" />
                </div>
                <div className="mt-4">
                  <div className="text-lg font-bold tracking-tight">{s.label}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{s.description}</div>
                  <div className={`text-xs font-semibold mt-3 ${s.iconColor}`}>{s.stat}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
