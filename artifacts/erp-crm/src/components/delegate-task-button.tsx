import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { DelegateTaskDialog } from "./delegate-task-dialog";
import { useAuth } from "@/hooks/useAuth";

interface DelegateTaskButtonProps {
  taskType: string;
  taskLabel: string;
  leadId?: number;
  className?: string;
}

export function DelegateTaskButton({ taskType, taskLabel, leadId, className }: DelegateTaskButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const lvl = (user as any)?.permissionLevel;
  if (lvl !== "company_admin" && lvl !== "super_admin") return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 text-violet-600 hover:text-violet-700 hover:bg-violet-50 ${className ?? ""}`}
        title="Delegate this task to a user"
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
      >
        <ClipboardList className="w-3.5 h-3.5" />
      </Button>
      {open && (
        <DelegateTaskDialog
          open={open}
          onClose={() => setOpen(false)}
          defaultLeadId={leadId}
          defaultTaskType={taskType}
          defaultTaskLabel={taskLabel}
        />
      )}
    </>
  );
}
