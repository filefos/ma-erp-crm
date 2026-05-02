import { useMemo, useState } from "react";
import { useCreateActivity, getListActivitiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, ExternalLink, AlertTriangle, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  buildWaUrl,
  normalizeWaPhone,
  isValidWaPhone,
  templatesForContext,
  buildActivitySubject,
  previewActivityDescription,
  WA_ACTIVITY_TYPE,
  type WaContext,
  type WaTemplate,
  type WaTemplateVars,
} from "@/lib/whatsapp";

type ButtonVariantProp = "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
type ButtonSizeProp = "default" | "sm" | "lg" | "icon";

interface WhatsAppButtonProps {
  phone?: string | null;
  context: WaContext;
  vars?: WaTemplateVars;
  defaultTemplateId?: string;
  // Activity-log targets (CRM only — pass at most one)
  leadId?: number;
  dealId?: number;
  contactId?: number;
  // Visual
  variant?: ButtonVariantProp;
  size?: ButtonSizeProp;
  className?: string;
  iconClassName?: string;
  label?: string;
  iconOnly?: boolean;
  testId?: string;
}

export function WhatsAppButton({
  phone,
  context,
  vars,
  defaultTemplateId,
  leadId,
  dealId,
  contactId,
  variant = "ghost",
  size = "icon",
  className,
  iconClassName = "w-4 h-4 text-green-600",
  label = "WhatsApp",
  iconOnly = true,
  testId,
}: WhatsAppButtonProps) {
  const { user } = useAuth();
  const sender = (user as { name?: string } | undefined)?.name;
  const baseVars = useMemo<WaTemplateVars>(() => ({ ...vars, sender: vars?.sender ?? sender }), [vars, sender]);

  const templates = useMemo(() => templatesForContext(context), [context]);
  const initialTemplate: WaTemplate =
    (defaultTemplateId && templates.find(t => t.id === defaultTemplateId)) ||
    templates[0] ||
    { id: "custom", label: "Custom", description: "", contexts: [context], render: v => v.custom || "" };

  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(initialTemplate.id);
  const [phoneInput, setPhoneInput] = useState(phone ?? "");
  const [message, setMessage] = useState(initialTemplate.render(baseVars));
  const [logActivity, setLogActivity] = useState(Boolean(leadId || dealId || contactId));
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createActivity = useCreateActivity();

  const selectedTemplate = templates.find(t => t.id === templateId) || initialTemplate;

  const openDialog = () => {
    setPhoneInput(phone ?? "");
    setTemplateId(initialTemplate.id);
    setMessage(initialTemplate.render(baseVars));
    setLogActivity(Boolean(leadId || dealId || contactId));
    setOpen(true);
  };

  const onTemplateChange = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) setMessage(tpl.render(baseVars));
  };

  const phoneOk = isValidWaPhone(phoneInput);

  const doSend = async () => {
    const url = buildWaUrl(phoneInput, message);
    window.open(url, "_blank", "noopener,noreferrer");

    if (logActivity && (leadId || dealId || contactId)) {
      try {
        await createActivity.mutateAsync({
          data: {
            type: WA_ACTIVITY_TYPE,
            subject: buildActivitySubject(context, selectedTemplate, baseVars),
            description: previewActivityDescription(message, phoneInput),
            isDone: true,
            leadId,
            dealId,
            contactId,
          },
        });
        queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
        toast({ title: "WhatsApp opened", description: "Activity logged in the timeline." });
      } catch {
        toast({ title: "WhatsApp opened", description: "Could not log the activity (continued anyway).", variant: "destructive" });
      }
    } else {
      toast({ title: "WhatsApp opened", description: phoneOk ? `Sending to +${normalizeWaPhone(phoneInput)}` : "Pick a contact in WhatsApp to send." });
    }
    setOpen(false);
  };

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={(e) => { stop(e); openDialog(); }}
        title={label}
        aria-label={label}
        data-testid={testId ?? "button-whatsapp"}
      >
        <MessageCircle className={iconClassName} />
        {!iconOnly && <span className="ml-1.5">{label}</span>}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); else setOpen(true); }}>
        <DialogContent className="max-w-lg" onClick={stop}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </span>
              Send WhatsApp message
            </DialogTitle>
            <DialogDescription>Pick a template, edit the message, then send via WhatsApp.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Phone (with country code)</Label>
                <Input
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+971 50 xxx xxxx"
                  data-testid="input-wa-phone"
                />
                {!phoneOk && phoneInput && (
                  <div className="text-[11px] text-orange-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Looks invalid — WhatsApp will ask you to pick the contact.
                  </div>
                )}
                {phoneOk && (
                  <div className="text-[11px] text-muted-foreground">Will send to <span className="font-mono">+{normalizeWaPhone(phoneInput)}</span></div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Template</Label>
                <Select value={templateId} onValueChange={onTemplateChange}>
                  <SelectTrigger data-testid="select-wa-template"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-muted-foreground">{selectedTemplate.description}</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Message</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{message.length} chars</Badge>
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={doCopy}>
                    {copied ? <Check className="w-3 h-3 mr-1 text-green-600" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
              <Textarea
                rows={9}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="font-sans text-sm"
                data-testid="textarea-wa-message"
              />
            </div>

            {(leadId || dealId || contactId) && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={logActivity}
                  onChange={(e) => setLogActivity(e.target.checked)}
                  className="rounded border-input"
                  data-testid="checkbox-wa-log"
                />
                <span>Log this WhatsApp message to the activity timeline</span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                type="button"
                onClick={doSend}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
                disabled={!message.trim() || createActivity.isPending}
                data-testid="button-wa-send"
              >
                {createActivity.isPending ? "Sending…" : <>Open WhatsApp <ExternalLink className="w-4 h-4" /></>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface WhatsAppQuickIconProps {
  phone?: string | null;
  context: WaContext;
  vars?: WaTemplateVars;
  defaultTemplateId?: string;
  leadId?: number;
  dealId?: number;
  contactId?: number;
  className?: string;
  testId?: string;
}

export function WhatsAppQuickIcon(props: WhatsAppQuickIconProps) {
  return (
    <WhatsAppButton
      {...props}
      variant="ghost"
      size="icon"
      iconOnly
      iconClassName="w-4 h-4 text-green-600"
      className={props.className ?? "h-7 w-7"}
      label="Send WhatsApp"
    />
  );
}
