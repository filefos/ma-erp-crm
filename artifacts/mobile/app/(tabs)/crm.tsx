import React from "react";
import { useRouter } from "expo-router";
import { useListLeads, useListDeals, useListContacts, useListActivities } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { KpiGrid, KpiTile, QuickLink, SectionHeading } from "@/components/ui";
import { isOverdue, num } from "@/lib/format";

function count<T>(data: T[] | undefined, predicate?: (t: T) => boolean): number {
  if (!data) return 0;
  return predicate ? data.filter(predicate).length : data.length;
}

export default function CrmHub() {
  const router = useRouter();
  const leads = useListLeads();
  const deals = useListDeals();
  const contacts = useListContacts();
  const activities = useListActivities();

  const open = count(leads.data, l => !["won", "lost"].includes((l.status ?? "").toLowerCase()));
  const won = count(leads.data, l => (l.status ?? "").toLowerCase() === "won");
  const dealsValue = (deals.data ?? []).reduce((s, d) => s + num(d.value), 0);
  const followUpsDue = count(activities.data, a => !a.isDone && (isOverdue(a.dueDate) || (!!a.dueDate && new Date(a.dueDate).getTime() < Date.now() + 86_400_000)));

  return (
    <DashboardScreen title="CRM" subtitle="Leads, deals, contacts and activities">
      <SectionHeading title="Pipeline at a glance" />
      <KpiGrid>
        <KpiTile label="Open leads"      value={open}                        icon="users"      tone="navy"   />
        <KpiTile label="Won leads"       value={won}                         icon="check"      tone="blue"   hint="Lifetime" />
        <KpiTile label="Active deals"    value={count(deals.data)}           icon="briefcase"  tone="orange" hint={`AED ${(dealsValue / 1000).toFixed(0)}k pipeline`} />
        <KpiTile label="Follow-ups due"  value={followUpsDue}                icon="clock"      tone="muted" />
      </KpiGrid>

      <SectionHeading title="Workspaces" />
      <QuickLink icon="users"        label="Leads"            hint={`${count(leads.data)} total`}     onPress={() => router.push("/crm/leads")} />
      <QuickLink icon="user"         label="Contacts"         hint={`${count(contacts.data)} total`}  onPress={() => router.push("/crm/contacts")} />
      <QuickLink icon="briefcase"    label="Deals"            hint={`${count(deals.data)} active`}    onPress={() => router.push("/crm/deals")} />
      <QuickLink icon="activity"     label="Activities"       hint={`${count(activities.data)} logged`} onPress={() => router.push("/crm/activities")} />

      <SectionHeading title="Tools" />
      <QuickLink icon="rotate-cw"    label="Follow-up center" hint="Today + overdue"                   onPress={() => router.push("/crm/follow-ups")} />
      <QuickLink icon="trello"       label="Lead pipeline"    hint="Kanban by status"                  onPress={() => router.push("/crm/pipeline")} />
      <QuickLink icon="award"        label="Sales leaderboard" hint="Won leads by owner"               onPress={() => router.push("/crm/leaderboard")} />
    </DashboardScreen>
  );
}
