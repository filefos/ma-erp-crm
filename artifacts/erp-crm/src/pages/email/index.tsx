import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Mail, Send, Inbox, Star, Trash2, FileText, Plus, X, Reply,
  Search, RefreshCw, Eye, EyeOff, Settings, RotateCcw, Loader2,
  Paperclip, FileIcon, ChevronDown, ChevronRight, Flag, Archive,
  MoreHorizontal, Forward, AlertCircle, Bold, Italic, Underline,
  Link as LinkIcon, Smile, AlignJustify, Columns2, PanelRight,
  CalendarDays, LayoutGrid, MessageSquare,
  Printer, Undo2, Users, Clock, Tag, PenLine, ImageIcon, UserPlus,
  Shield, ShieldAlert,
  AlignLeft, AlignCenter, AlignRight, AlignJustify as AlignJustifyIcon,
  List, ListOrdered, Type, Strikethrough, Palette,
  Scissors, Copy, ClipboardPaste, Pen, Highlighter, Eraser,
  HelpCircle, BookOpen, Lightbulb, ZoomIn, ZoomOut, AtSign,
  SlidersHorizontal, Minus, Mic, Lock, ChevronsUp, ChevronsDown,
  Table, SpellCheck, Wand2, IndentDecrease, IndentIncrease,
  Subscript, Superscript,
} from "lucide-react";
import { EmailSettingsModal } from "./settings-modal";

/* ── Outlook Ribbon ─────────────────────────────────────────────────────────
   Renders the Outlook-style tab bar + ribbon row with labelled groups.
──────────────────────────────────────────────────────────────────────────── */
const MENU_TABS = ["File", "Home", "View", "Help", "Message", "Insert", "Format text", "Draw", "Options"];

/* ── FixedDropdown ────────────────────────────────────────────────────────────
   Renders a dropdown at a fixed viewport position, escaping any overflow
   clipping on ancestor containers (e.g. the ribbon's overflow-x-auto row).
──────────────────────────────────────────────────────────────────────────── */
function FixedDropdown({ triggerRef, open, onClose, children, minWidth = 160 }: {
  triggerRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  minWidth?: number;
}) {
  if (!open) return null;
  const rect = triggerRef.current?.getBoundingClientRect();
  const top  = rect ? rect.bottom + 4 : 8;
  const left = rect ? rect.left      : 8;
  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 99998 }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed", top, left, zIndex: 99999, minWidth,
          background: "#ffffff", border: "1px solid #e1dfdd",
          borderRadius: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

function OutlookRibbon({
  activeTab, setActiveTab, onNewMail, onSync, syncing,
  selectedEmail, onDelete, onArchive, onReply, onForward,
  onMarkAllRead, onToggleStar, onMove, currentFolder,
  sidebarVisible, onToggleSidebar, readingPaneLayout, onChangeReadingPane,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  onNewMail: () => void;
  onSync: () => void;
  syncing: boolean;
  selectedEmail?: Email | null;
  onDelete?: () => void;
  onArchive?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  onMarkAllRead?: () => void;
  onToggleStar?: () => void;
  onMove?: (folder: string) => void;
  currentFolder?: string;
  sidebarVisible?: boolean;
  onToggleSidebar?: () => void;
  readingPaneLayout?: "right" | "bottom" | "off";
  onChangeReadingPane?: (layout: "right" | "bottom" | "off") => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [categorizeOpen, setCategorizeOpen] = useState(false);
  const [folderPaneOpen, setFolderPaneOpen] = useState(false);
  const [readingPaneOpen, setReadingPaneOpen] = useState(false);
  const [densityOpen, setDensityOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const hasSelected = !!selectedEmail;

  const moveTriggerRef        = useRef<HTMLDivElement>(null);
  const flagTriggerRef        = useRef<HTMLDivElement>(null);
  const categorizeTriggerRef  = useRef<HTMLDivElement>(null);
  const folderPaneTriggerRef  = useRef<HTMLDivElement>(null);
  const readingPaneTriggerRef = useRef<HTMLDivElement>(null);
  const densityTriggerRef     = useRef<HTMLDivElement>(null);
  const signatureTriggerRef   = useRef<HTMLDivElement>(null);

  const closeAll = () => {
    setMoveOpen(false); setFlagOpen(false); setCategorizeOpen(false);
    setFolderPaneOpen(false); setReadingPaneOpen(false); setDensityOpen(false);
    setSignatureOpen(false);
  };

  useEffect(() => { closeAll(); }, [activeTab]);

  const MOVE_FOLDERS = [
    { key: "inbox",   label: "Inbox" },
    { key: "sent",    label: "Sent Items" },
    { key: "draft",   label: "Drafts" },
    { key: "trash",   label: "Deleted Items" },
    { key: "starred", label: "Starred" },
  ];

  const CATEGORIES = [
    { label: "Red",    color: "#ef4444" },
    { label: "Orange", color: "#f97316" },
    { label: "Yellow", color: "#eab308" },
    { label: "Green",  color: "#22c55e" },
    { label: "Blue",   color: "#3b82f6" },
    { label: "Purple", color: "#a855f7" },
  ];

  /* ── Button: tall icon + label (+ optional caret) ───────────────────── */
  function Btn({ icon, label, caret, onClick, disabled }: {
    icon: React.ReactNode; label: string; caret?: boolean; onClick?: () => void; disabled?: boolean;
  }) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex flex-col items-center justify-center gap-[3px] px-2 py-1 rounded transition-colors hover:bg-[#ebebeb] min-w-[40px] disabled:opacity-40"
        style={{ color: "#323130" }}
      >
        <span className="flex items-center justify-center" style={{ width: 22, height: 22 }}>{icon}</span>
        <span className="flex items-center gap-[2px] text-[10px] whitespace-nowrap leading-none" style={{ color: "#323130" }}>
          {label}{caret && <ChevronDown className="w-[9px] h-[9px] opacity-55 ml-[1px]" />}
        </span>
      </button>
    );
  }

  /* ── Labelled group wrapper ─────────────────────────────────────────── */
  function Group({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex h-full">
        <div className="flex flex-col">
          <div className="flex items-center gap-0 flex-1 px-1 pt-1 pb-0">{children}</div>
          <div
            className="text-[9px] text-center px-2 pb-[3px] pt-[2px] border-t"
            style={{ color: "#a19f9d", borderColor: "#e1dfdd" }}
          >
            {label}
          </div>
        </div>
        <div className="w-px mx-1 my-2" style={{ background: "#e1dfdd" }} />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     HOME TAB  (matches screenshot: New | Delete | Report | Respond |
                Move | Tags | Print | Find | Undo)
  ══════════════════════════════════════════════════════════════════════ */
  const homeRibbon = (
    <div className="flex items-stretch h-full">
      <Group label="New">
        <Btn icon={<PenLine className="w-5 h-5" />} label="New" onClick={onNewMail} />
      </Group>
      <Group label="Delete">
        <Btn
          icon={<Trash2 className="w-5 h-5" />}
          label="Delete"
          disabled={!hasSelected}
          onClick={() => { onDelete?.(); }}
        />
        <Btn
          icon={<Archive className="w-5 h-5" />}
          label="Archive"
          disabled={!hasSelected}
          onClick={() => { onArchive?.(); }}
        />
      </Group>
      <Group label="Report">
        <Btn icon={<AlertCircle className="w-5 h-5" />} label="Report" disabled={!hasSelected} />
      </Group>
      <Group label="Respond">
        <Btn
          icon={<Reply className="w-5 h-5" />}
          label="Reply"
          disabled={!hasSelected}
          onClick={() => { onReply?.(); }}
        />
        <Btn
          icon={<Reply className="w-5 h-5" style={{ transform: "scaleX(-1)" }} />}
          label="Reply all"
          disabled={!hasSelected}
          onClick={() => { onReply?.(); }}
        />
        <Btn
          icon={<Forward className="w-5 h-5" />}
          label="Forward"
          disabled={!hasSelected}
          onClick={() => { onForward?.(); }}
        />
      </Group>

      {/* Move with dropdown */}
      <Group label="Move">
        <div ref={moveTriggerRef}>
          <Btn
            icon={<Columns2 className="w-5 h-5" />}
            label="Move"
            caret
            disabled={!hasSelected}
            onClick={() => { setMoveOpen(s => !s); setFlagOpen(false); setCategorizeOpen(false); setFolderPaneOpen(false); setReadingPaneOpen(false); setDensityOpen(false); }}
          />
        </div>
        <FixedDropdown triggerRef={moveTriggerRef} open={moveOpen && hasSelected} onClose={() => setMoveOpen(false)}>
          {MOVE_FOLDERS.filter(f => f.key !== currentFolder).map(f => (
            <button
              key={f.key}
              onClick={() => { onMove?.(f.key); setMoveOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors text-left"
              style={{ color: "#323130" }}
            >
              {f.label}
            </button>
          ))}
        </FixedDropdown>
      </Group>

      <Group label="Tags">
        <Btn
          icon={<Eye className="w-5 h-5" />}
          label="Mark all as read"
          onClick={() => { onMarkAllRead?.(); }}
        />

        {/* Categorize dropdown */}
        <div ref={categorizeTriggerRef}>
          <Btn
            icon={<Tag className="w-5 h-5" />}
            label="Categorize"
            caret
            onClick={() => { setCategorizeOpen(s => !s); setMoveOpen(false); setFlagOpen(false); setFolderPaneOpen(false); setReadingPaneOpen(false); setDensityOpen(false); }}
          />
        </div>
        <FixedDropdown triggerRef={categorizeTriggerRef} open={categorizeOpen} onClose={() => setCategorizeOpen(false)}>
          <div className="px-3 py-1.5 text-[11px] font-semibold" style={{ color: "#605e5c", background: "#f3f2f1" }}>Color Categories</div>
          {CATEGORIES.map(cat => (
            <button
              key={cat.label}
              onClick={() => { setCategorizeOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors"
              style={{ color: "#323130" }}
            >
              <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: cat.color }} />
              {cat.label} Category
            </button>
          ))}
        </FixedDropdown>

        {/* Flag dropdown */}
        <div ref={flagTriggerRef}>
          <Btn
            icon={<Flag className={`w-5 h-5 ${selectedEmail?.isStarred ? "fill-orange-400 text-orange-400" : ""}`} />}
            label={selectedEmail?.isStarred ? "Unflag" : "Flag"}
            caret
            disabled={!hasSelected}
            onClick={() => { setFlagOpen(s => !s); setMoveOpen(false); setCategorizeOpen(false); setFolderPaneOpen(false); setReadingPaneOpen(false); setDensityOpen(false); }}
          />
        </div>
        <FixedDropdown triggerRef={flagTriggerRef} open={flagOpen && hasSelected} onClose={() => setFlagOpen(false)}>
          <button
            onClick={() => { onToggleStar?.(); setFlagOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors"
            style={{ color: "#323130" }}
          >
            <Flag className="w-3.5 h-3.5 text-orange-500" />
            {selectedEmail?.isStarred ? "Remove Flag" : "Flag: Follow up"}
          </button>
          <button
            onClick={() => { onToggleStar?.(); setFlagOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors"
            style={{ color: "#323130" }}
          >
            <Star className="w-3.5 h-3.5 text-orange-500" />
            {selectedEmail?.isStarred ? "Remove Star" : "Mark as Starred"}
          </button>
        </FixedDropdown>

        <Btn icon={<Clock className="w-5 h-5" />} label="Snooze" caret disabled={!hasSelected} />
      </Group>
      <Group label="Print">
        <Btn
          icon={<Printer className="w-5 h-5" />}
          label="Print"
          disabled={!hasSelected}
          onClick={() => window.print()}
        />
      </Group>
      <Group label="Find">
        <Btn icon={<Users className="w-5 h-5" />} label="Find contacts" />
      </Group>
      <Group label="Undo">
        <Btn icon={<Undo2 className="w-5 h-5" />} label="Undo" />
      </Group>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     VIEW TAB  (Settings | Messages | Layout)
  ══════════════════════════════════════════════════════════════════════ */
  const DENSITY_OPTIONS = [
    { key: "compact",   label: "Compact" },
    { key: "normal",    label: "Normal" },
    { key: "spacious",  label: "Spacious" },
  ] as const;

  const viewRibbon = (
    <div className="flex items-stretch h-full">
      <Group label="Settings">
        <Btn icon={<Settings className="w-5 h-5" />} label="View settings" caret />
      </Group>
      <Group label="Messages">
        <Btn icon={<MessageSquare className="w-5 h-5" />} label="Conversations" />
        <Btn icon={<LayoutGrid className="w-5 h-5" />} label="Message preview" caret />
        <Btn
          icon={<RotateCcw className={`w-5 h-5${syncing ? " animate-spin" : ""}`} />}
          label="Sync"
          onClick={onSync}
        />
      </Group>
      <Group label="Layout">
        <Btn icon={<AlignJustify className="w-5 h-5" />} label="Ribbon" />

        {/* Folder pane dropdown */}
        <div ref={folderPaneTriggerRef}>
          <Btn
            icon={<PanelRight className="w-5 h-5" />}
            label="Folder pane"
            caret
            onClick={() => { setFolderPaneOpen(s => !s); setReadingPaneOpen(false); setDensityOpen(false); setMoveOpen(false); setFlagOpen(false); setCategorizeOpen(false); }}
          />
        </div>
        <FixedDropdown triggerRef={folderPaneTriggerRef} open={folderPaneOpen} onClose={() => setFolderPaneOpen(false)}>
          <div className="px-3 py-1.5 text-[11px] font-semibold" style={{ color: "#605e5c", background: "#f3f2f1" }}>Folder Pane</div>
          {[{ key: true,  label: "Normal" }, { key: false, label: "Off" }].map(opt => (
            <button
              key={String(opt.key)}
              onClick={() => { onToggleSidebar?.(); setFolderPaneOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors"
              style={{ color: "#323130", fontWeight: sidebarVisible === opt.key ? 600 : 400 }}
            >
              {sidebarVisible === opt.key && <span className="w-2 h-2 rounded-full bg-[#0078d4] flex-shrink-0" />}
              {sidebarVisible !== opt.key && <span className="w-2 h-2 flex-shrink-0" />}
              {opt.label}
            </button>
          ))}
        </FixedDropdown>

        {/* Reading pane dropdown */}
        <div ref={readingPaneTriggerRef}>
          <Btn
            icon={<Columns2 className="w-5 h-5" />}
            label="Reading pane"
            caret
            onClick={() => { setReadingPaneOpen(s => !s); setFolderPaneOpen(false); setDensityOpen(false); setMoveOpen(false); setFlagOpen(false); setCategorizeOpen(false); }}
          />
        </div>
        <FixedDropdown triggerRef={readingPaneTriggerRef} open={readingPaneOpen} onClose={() => setReadingPaneOpen(false)}>
          <div className="px-3 py-1.5 text-[11px] font-semibold" style={{ color: "#605e5c", background: "#f3f2f1" }}>Reading Pane</div>
          {([
            { key: "right",  label: "Right" },
            { key: "bottom", label: "Bottom" },
            { key: "off",    label: "Off" },
          ] as const).map(opt => (
            <button
              key={opt.key}
              onClick={() => { onChangeReadingPane?.(opt.key); setReadingPaneOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors"
              style={{ color: "#323130", fontWeight: readingPaneLayout === opt.key ? 600 : 400 }}
            >
              {readingPaneLayout === opt.key && <span className="w-2 h-2 rounded-full bg-[#0078d4] flex-shrink-0" />}
              {readingPaneLayout !== opt.key && <span className="w-2 h-2 flex-shrink-0" />}
              {opt.label}
            </button>
          ))}
        </FixedDropdown>

        <Btn icon={<CalendarDays className="w-5 h-5" />} label="My Day" caret />

        {/* Density dropdown */}
        <div ref={densityTriggerRef}>
          <Btn
            icon={<SlidersHorizontal className="w-5 h-5" />}
            label="Density"
            caret
            onClick={() => { setDensityOpen(s => !s); setFolderPaneOpen(false); setReadingPaneOpen(false); setMoveOpen(false); setFlagOpen(false); setCategorizeOpen(false); }}
          />
        </div>
        <FixedDropdown triggerRef={densityTriggerRef} open={densityOpen} onClose={() => setDensityOpen(false)}>
          <div className="px-3 py-1.5 text-[11px] font-semibold" style={{ color: "#605e5c", background: "#f3f2f1" }}>Message Density</div>
          {DENSITY_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => { setDensityOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors"
              style={{ color: "#323130" }}
            >
              <span className="w-2 h-2 flex-shrink-0" />
              {opt.label}
            </button>
          ))}
        </FixedDropdown>
      </Group>
      <Group label="Zoom">
        <Btn icon={<ZoomIn className="w-5 h-5" />} label="Zoom in" />
        <Btn icon={<ZoomOut className="w-5 h-5" />} label="Zoom out" />
      </Group>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     HELP TAB
  ══════════════════════════════════════════════════════════════════════ */
  const helpRibbon = (
    <div className="flex items-stretch h-full">
      <Group label="Help">
        <Btn icon={<HelpCircle className="w-5 h-5" />} label="Help" />
        <Btn icon={<BookOpen className="w-5 h-5" />} label="What's new" />
      </Group>
      <Group label="Community">
        <Btn icon={<Lightbulb className="w-5 h-5" />} label="Suggest a feature" />
        <Btn icon={<Users className="w-5 h-5" />} label="Community" />
      </Group>
      <Group label="Show">
        <Btn icon={<FileText className="w-5 h-5" />} label="Keyboard shortcuts" />
        <Btn icon={<AlertCircle className="w-5 h-5" />} label="About" />
      </Group>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     MESSAGE TAB  (matches Outlook compose ribbon screenshot exactly)
     Groups: Clipboard | Basic Text | Paragraph | Insert | Voice |
             Proofing | Add-ins | Tags | Encrypt | Print |
             Accessibility | Options
  ══════════════════════════════════════════════════════════════════════ */
  const messageRibbon = (
    <div className="flex items-stretch h-full">

      {/* ── Clipboard ──────────────────────────────────────────────────── */}
      <Group label="Clipboard">
        <Btn icon={<ClipboardPaste className="w-5 h-5" />} label="Paste" caret />
        <div className="flex flex-col justify-center gap-0.5 px-0.5">
          <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#ebebeb] transition-colors" style={{ color: "#323130" }}>
            <Scissors className="w-3.5 h-3.5" /><span>Cut</span>
          </button>
          <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#ebebeb] transition-colors" style={{ color: "#323130" }}>
            <Copy className="w-3.5 h-3.5" /><span>Copy</span>
          </button>
        </div>
      </Group>

      {/* ── Basic Text ─────────────────────────────────────────────────── */}
      <Group label="Basic Text">
        {/* Font name + size row */}
        <div className="flex flex-col gap-0.5 pr-1">
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 border rounded px-1.5 h-5 text-[10px] hover:border-[#0078d4] cursor-pointer" style={{ borderColor: "#c8c6c4", minWidth: 72, color: "#323130" }}>
              <Type className="w-3 h-3 opacity-50" />
              <span>Aptos</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-50 ml-auto" />
            </div>
            <div className="flex items-center border rounded px-1 h-5 text-[10px] hover:border-[#0078d4] cursor-pointer" style={{ borderColor: "#c8c6c4", minWidth: 28, color: "#323130" }}>
              <span>11</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-50" />
            </div>
          </div>
          {/* Formatting buttons row */}
          <div className="flex items-center gap-0">
            <button className="px-1 py-0.5 rounded font-bold text-[12px] hover:bg-[#ebebeb]" style={{ color: "#323130" }}>B</button>
            <button className="px-1 py-0.5 rounded italic text-[12px] hover:bg-[#ebebeb]" style={{ color: "#323130" }}>I</button>
            <button className="px-1 py-0.5 rounded underline text-[12px] hover:bg-[#ebebeb]" style={{ color: "#323130" }}>U<ChevronDown className="inline w-2 h-2 opacity-50" /></button>
            <button className="px-1 py-0.5 rounded text-[12px] hover:bg-[#ebebeb]" style={{ color: "#323130", textDecoration: "line-through" }}>S</button>
            <button className="px-1 py-0.5 rounded text-[12px] hover:bg-[#ebebeb] flex items-center" style={{ color: "#323130" }}><Highlighter className="w-3 h-3" /><ChevronDown className="w-2 h-2 opacity-50" /></button>
            <button className="px-1 py-0.5 rounded text-[12px] hover:bg-[#ebebeb] flex items-center" style={{ color: "#323130" }}><Palette className="w-3 h-3" /><ChevronDown className="w-2 h-2 opacity-50" /></button>
            <button className="px-1 py-0.5 rounded text-[10px] hover:bg-[#ebebeb]" style={{ color: "#323130" }}>x₂</button>
            <button className="px-1 py-0.5 rounded text-[10px] hover:bg-[#ebebeb]" style={{ color: "#323130" }}>Aa<ChevronDown className="inline w-2 h-2 opacity-50" /></button>
            <button className="px-1 py-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><Eraser className="w-3 h-3" /></button>
          </div>
        </div>
      </Group>

      {/* ── Paragraph ──────────────────────────────────────────────────── */}
      <Group label="Paragraph">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-0">
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><List className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><ListOrdered className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><IndentDecrease className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><IndentIncrease className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><AlignJustify className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex items-center gap-0">
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><AlignLeft className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><AlignCenter className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><AlignRight className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><AlignJustifyIcon className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb] flex items-center gap-0" style={{ color: "#323130" }}>
              <span className="text-[9px] leading-none">≡</span><ChevronDown className="w-2 h-2 opacity-50" />
            </button>
          </div>
        </div>
      </Group>

      {/* ── Insert ─────────────────────────────────────────────────────── */}
      <Group label="Insert">
        <Btn icon={<Paperclip className="w-5 h-5" />} label="Attach file" caret />
        <Btn icon={<ImageIcon className="w-5 h-5" />} label="Pictures" />
        <Btn icon={<Smile className="w-5 h-5" />} label="Emoji" />
        <div ref={signatureTriggerRef}>
          <Btn icon={<FileText className="w-5 h-5" />} label="Signature" caret onClick={() => setSignatureOpen(s => !s)} />
        </div>
        <FixedDropdown triggerRef={signatureTriggerRef} open={signatureOpen} onClose={() => setSignatureOpen(false)} minWidth={200}>
          <div className="px-3 py-1.5 text-[11px] font-semibold" style={{ color: "#605e5c", background: "#f3f2f1" }}>Signatures</div>
          <button onClick={() => setSignatureOpen(false)} className="flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors" style={{ color: "#323130" }}>
            <PenLine className="w-3.5 h-3.5" />No signature
          </button>
          <div className="border-t" style={{ borderColor: "#e1dfdd" }} />
          <button onClick={() => setSignatureOpen(false)} className="flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors" style={{ color: "#0078d4" }}>
            <Settings className="w-3.5 h-3.5" />Manage signatures…
          </button>
        </FixedDropdown>
        <Btn icon={<Table className="w-5 h-5" />} label="Table" />
      </Group>

      {/* ── Voice ──────────────────────────────────────────────────────── */}
      <Group label="Voice">
        <Btn icon={<Mic className="w-5 h-5" />} label="Dictate" caret />
      </Group>

      {/* ── Proofing ───────────────────────────────────────────────────── */}
      <Group label="Proofing">
        <Btn icon={<SpellCheck className="w-5 h-5" />} label="Editor" caret />
      </Group>

      {/* ── Add-ins ────────────────────────────────────────────────────── */}
      <Group label="Add-ins">
        <Btn icon={<LayoutGrid className="w-5 h-5" />} label="Apps" />
      </Group>

      {/* ── Tags ───────────────────────────────────────────────────────── */}
      <Group label="Tags">
        <div className="flex flex-col justify-center gap-0.5 px-0.5">
          <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#ebebeb] transition-colors whitespace-nowrap" style={{ color: "#323130" }}>
            <ChevronsUp className="w-3.5 h-3.5 text-red-500" /><span>High importance</span>
          </button>
          <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#ebebeb] transition-colors whitespace-nowrap" style={{ color: "#323130" }}>
            <ChevronsDown className="w-3.5 h-3.5 text-blue-400" /><span>Low importance</span>
          </button>
        </div>
      </Group>

      {/* ── Encrypt ────────────────────────────────────────────────────── */}
      <Group label="Encrypt">
        <Btn icon={<Lock className="w-5 h-5" />} label="Encrypt" caret />
      </Group>

      {/* ── Print ──────────────────────────────────────────────────────── */}
      <Group label="Print">
        <Btn icon={<Printer className="w-5 h-5" />} label="Print draft" />
      </Group>

      {/* ── Accessibility ──────────────────────────────────────────────── */}
      <Group label="Accessibility">
        <Btn icon={<Eye className="w-5 h-5" />} label="Check accessibility" />
      </Group>

      {/* ── Options ────────────────────────────────────────────────────── */}
      <Group label="Options">
        <Btn icon={<Wand2 className="w-5 h-5" />} label="Auto format options" />
      </Group>

    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     INSERT TAB
     Groups: Attachments | Tables | Images | Links | Text | Symbols
  ══════════════════════════════════════════════════════════════════════ */
  const insertRibbon = (
    <div className="flex items-stretch h-full">
      <Group label="Attachments">
        <Btn icon={<Paperclip className="w-5 h-5" />} label="Attach file" caret />
      </Group>
      <Group label="Tables">
        <Btn icon={<Table className="w-5 h-5" />} label="Table" />
      </Group>
      <Group label="Images">
        <Btn icon={<ImageIcon className="w-5 h-5" />} label="Pictures" />
        <Btn icon={<Search className="w-5 h-5" />} label="Online pictures" />
      </Group>
      <Group label="Links">
        <Btn icon={<LinkIcon className="w-5 h-5" />} label="Link" />
        <Btn icon={<AtSign className="w-5 h-5" />} label="Bookmark" />
      </Group>
      <Group label="Text">
        <div ref={signatureTriggerRef}>
          <Btn icon={<FileText className="w-5 h-5" />} label="Signature" caret onClick={() => setSignatureOpen(s => !s)} />
        </div>
        <FixedDropdown triggerRef={signatureTriggerRef} open={signatureOpen} onClose={() => setSignatureOpen(false)} minWidth={200}>
          <div className="px-3 py-1.5 text-[11px] font-semibold" style={{ color: "#605e5c", background: "#f3f2f1" }}>Signatures</div>
          <button onClick={() => setSignatureOpen(false)} className="flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors" style={{ color: "#323130" }}>
            <PenLine className="w-3.5 h-3.5" />No signature
          </button>
          <div className="border-t" style={{ borderColor: "#e1dfdd" }} />
          <button onClick={() => setSignatureOpen(false)} className="flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors" style={{ color: "#0078d4" }}>
            <Settings className="w-3.5 h-3.5" />Manage signatures…
          </button>
        </FixedDropdown>
        <Btn icon={<Type className="w-5 h-5" />} label="Text box" />
        <Btn icon={<FileIcon className="w-5 h-5" />} label="Quick Parts" caret />
      </Group>
      <Group label="Symbols">
        <Btn icon={<Smile className="w-5 h-5" />} label="Emoji" />
        <Btn icon={<MoreHorizontal className="w-5 h-5" />} label="Symbol" caret />
      </Group>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     FORMAT TEXT TAB  — mirrors Message tab compact 2-row layout
     Groups: Clipboard | Basic Text | Paragraph | Styles | Undo
  ══════════════════════════════════════════════════════════════════════ */
  const formatTextRibbon = (
    <div className="flex items-stretch h-full">

      {/* ── Clipboard ──────────────────────────────────────────────────── */}
      <Group label="Clipboard">
        <Btn icon={<ClipboardPaste className="w-5 h-5" />} label="Paste" caret />
        <div className="flex flex-col justify-center gap-0.5 px-0.5">
          <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#ebebeb] transition-colors" style={{ color: "#323130" }}>
            <Scissors className="w-3.5 h-3.5" /><span>Cut</span>
          </button>
          <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#ebebeb] transition-colors" style={{ color: "#323130" }}>
            <Copy className="w-3.5 h-3.5" /><span>Copy</span>
          </button>
        </div>
      </Group>

      {/* ── Basic Text — same compact 2-row as Message tab ─────────────── */}
      <Group label="Basic Text">
        <div className="flex flex-col gap-0.5 pr-1">
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 border rounded px-1.5 h-5 text-[10px] hover:border-[#0078d4] cursor-pointer" style={{ borderColor: "#c8c6c4", minWidth: 72, color: "#323130" }}>
              <Type className="w-3 h-3 opacity-50" /><span>Aptos</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-50 ml-auto" />
            </div>
            <div className="flex items-center border rounded px-1 h-5 text-[10px] hover:border-[#0078d4] cursor-pointer" style={{ borderColor: "#c8c6c4", minWidth: 28, color: "#323130" }}>
              <span>11</span><ChevronDown className="w-2.5 h-2.5 opacity-50" />
            </div>
          </div>
          <div className="flex items-center gap-0">
            <button className="px-1 py-0.5 rounded font-bold text-[12px] hover:bg-[#ebebeb]" style={{ color: "#323130" }}>B</button>
            <button className="px-1 py-0.5 rounded italic text-[12px] hover:bg-[#ebebeb]" style={{ color: "#323130" }}>I</button>
            <button className="px-1 py-0.5 rounded underline text-[12px] hover:bg-[#ebebeb]" style={{ color: "#323130" }}>U<ChevronDown className="inline w-2 h-2 opacity-50" /></button>
            <button className="px-1 py-0.5 rounded text-[12px] hover:bg-[#ebebeb]" style={{ color: "#323130", textDecoration: "line-through" }}>S</button>
            <button className="px-1 py-0.5 rounded text-[12px] hover:bg-[#ebebeb] flex items-center" style={{ color: "#323130" }}><Highlighter className="w-3 h-3" /><ChevronDown className="w-2 h-2 opacity-50" /></button>
            <button className="px-1 py-0.5 rounded text-[12px] hover:bg-[#ebebeb] flex items-center" style={{ color: "#323130" }}><Palette className="w-3 h-3" /><ChevronDown className="w-2 h-2 opacity-50" /></button>
            <button className="px-1 py-0.5 rounded text-[10px] hover:bg-[#ebebeb]" style={{ color: "#323130" }}>x₂</button>
            <button className="px-1 py-0.5 rounded text-[10px] hover:bg-[#ebebeb]" style={{ color: "#323130" }}>Aa<ChevronDown className="inline w-2 h-2 opacity-50" /></button>
            <button className="px-1 py-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><Eraser className="w-3 h-3" /></button>
          </div>
        </div>
      </Group>

      {/* ── Paragraph — same compact 2-row as Message tab ──────────────── */}
      <Group label="Paragraph">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-0">
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><List className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><ListOrdered className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><IndentDecrease className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><IndentIncrease className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><AlignJustify className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex items-center gap-0">
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><AlignLeft className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><AlignCenter className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><AlignRight className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb]" style={{ color: "#323130" }}><AlignJustifyIcon className="w-3.5 h-3.5" /></button>
            <button className="p-0.5 rounded hover:bg-[#ebebeb] flex items-center gap-0" style={{ color: "#323130" }}>
              <span className="text-[9px] leading-none">≡</span><ChevronDown className="w-2 h-2 opacity-50" />
            </button>
          </div>
        </div>
      </Group>

      {/* ── Styles ─────────────────────────────────────────────────────── */}
      <Group label="Styles">
        <div className="flex flex-col justify-center gap-0.5 px-1">
          <div className="flex items-center gap-1">
            {["Normal", "Heading 1", "Heading 2"].map(s => (
              <button key={s} className="border rounded px-1.5 h-5 text-[10px] hover:bg-[#ebebeb] hover:border-[#0078d4] whitespace-nowrap" style={{ borderColor: "#c8c6c4", color: "#323130" }}>{s}</button>
            ))}
            <ChevronDown className="w-3 h-3 opacity-50" />
          </div>
        </div>
      </Group>

      {/* ── Undo ───────────────────────────────────────────────────────── */}
      <Group label="Undo">
        <Btn icon={<Undo2 className="w-5 h-5" />} label="Undo" />
      </Group>

    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     DRAW TAB
  ══════════════════════════════════════════════════════════════════════ */
  const drawRibbon = (
    <div className="flex items-stretch h-full">
      <Group label="Tools">
        <Btn icon={<Pen className="w-5 h-5" />} label="Pen" />
        <Btn icon={<Highlighter className="w-5 h-5" />} label="Highlighter" />
        <Btn icon={<Eraser className="w-5 h-5" />} label="Eraser" />
      </Group>
      <Group label="Insert">
        <Btn icon={<Minus className="w-5 h-5" />} label="Line" />
        <Btn icon={<ImageIcon className="w-5 h-5" />} label="Image" />
      </Group>
      <Group label="Undo">
        <Btn icon={<Undo2 className="w-5 h-5" />} label="Undo" />
      </Group>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     OPTIONS TAB
     Groups: Show Fields | Tracking | More Options | Permission
  ══════════════════════════════════════════════════════════════════════ */
  const optionsRibbon = (
    <div className="flex items-stretch h-full">
      <Group label="Show Fields">
        <Btn icon={<Mail className="w-5 h-5" />} label="From" />
        <Btn icon={<Eye className="w-5 h-5" />} label="Bcc" />
      </Group>
      <Group label="Tracking">
        <div className="flex flex-col justify-center gap-0.5 px-0.5">
          <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#ebebeb] transition-colors whitespace-nowrap" style={{ color: "#323130" }}>
            <Eye className="w-3.5 h-3.5" /><span>Request a read receipt</span>
          </button>
          <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#ebebeb] transition-colors whitespace-nowrap" style={{ color: "#323130" }}>
            <Send className="w-3.5 h-3.5" /><span>Request delivery receipt</span>
          </button>
        </div>
      </Group>
      <Group label="More Options">
        <Btn icon={<Clock className="w-5 h-5" />} label="Delay delivery" />
        <Btn icon={<Reply className="w-5 h-5" />} label="Direct replies to" />
        <Btn icon={<SlidersHorizontal className="w-5 h-5" />} label="Message options" caret />
      </Group>
      <Group label="Permission">
        <Btn icon={<Lock className="w-5 h-5" />} label="Encrypt" caret />
      </Group>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     FILE TAB  (Info | New | Save | Print | Account)
     In Outlook, File opens a backstage panel — here we render it as
     a ribbon with the equivalent top-level actions.
  ══════════════════════════════════════════════════════════════════════ */
  const fileRibbon = (
    <div className="flex items-stretch h-full">
      <Group label="Info">
        <Btn icon={<Mail className="w-5 h-5" />} label="Account settings" caret />
        <Btn icon={<Settings className="w-5 h-5" />} label="Manage rules" />
      </Group>
      <Group label="New">
        <Btn icon={<PenLine className="w-5 h-5" />} label="New email" onClick={onNewMail} />
        <Btn icon={<FileText className="w-5 h-5" />} label="New folder" />
      </Group>
      <Group label="Open &amp; Export">
        <Btn icon={<FileIcon className="w-5 h-5" />} label="Open" />
        <Btn icon={<Send className="w-5 h-5" />} label="Import / Export" caret />
      </Group>
      <Group label="Save">
        <Btn icon={<FileText className="w-5 h-5" />} label="Save attachments" />
      </Group>
      <Group label="Print">
        <Btn icon={<Printer className="w-5 h-5" />} label="Print" />
      </Group>
      <Group label="Account">
        <Btn icon={<Users className="w-5 h-5" />} label="Office account" />
        <Btn icon={<HelpCircle className="w-5 h-5" />} label="Feedback" />
      </Group>
    </div>
  );

  /* ── Map tabs → ribbon content ───────────────────────────────────────── */
  const ribbonMap: Record<string, React.ReactNode> = {
    File: fileRibbon,
    Home: homeRibbon,
    View: viewRibbon,
    Help: helpRibbon,
    Message: messageRibbon,
    Insert: insertRibbon,
    "Format text": formatTextRibbon,
    Draw: drawRibbon,
    Options: optionsRibbon,
  };

  return (
    <div className="flex-shrink-0 select-none border-b" style={{ borderColor: "#e1dfdd", background: "#ffffff" }}>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center px-1" style={{ height: 32, background: "#ffffff" }}>
        <button className="p-1.5 mr-1 rounded hover:bg-[#f3f2f1] transition-colors" style={{ color: "#323130" }}>
          <AlignJustify className="w-4 h-4" />
        </button>
        {MENU_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-3 h-full text-[13px] transition-colors relative"
            style={{
              color: activeTab === tab ? "#0078d4" : "#323130",
              fontWeight: activeTab === tab ? 600 : 400,
              borderBottom: activeTab === tab ? "2px solid #0078d4" : "2px solid transparent",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Ribbon row ───────────────────────────────────────────────────── */}
      <div
        className="flex items-stretch px-2 overflow-x-auto"
        style={{ height: 72, background: "#ffffff", borderTop: "1px solid #f3f2f1" }}
      >
        {ribbonMap[activeTab] ?? homeRibbon}
      </div>

    </div>
  );
}

type Folder = "inbox" | "sent" | "draft" | "trash" | "starred";

interface Email {
  id: number;
  folder: string;
  fromAddress: string;
  fromName?: string;
  toAddress: string;
  toName?: string;
  ccAddress?: string;
  subject: string;
  body: string;
  isRead: boolean;
  isStarred: boolean;
  replyToId?: number;
  sentAt?: string;
  createdAt: string;
  companyId?: number;
  attachments?: Array<{ filename: string; contentType: string; size: number }>;
}

interface Attachment {
  filename: string;
  content: string;
  contentType: string;
  size: number;
}

interface ComposeData {
  toAddress: string;
  toName: string;
  ccAddress: string;
  bccAddress: string;
  subject: string;
  body: string;
  replyToId?: number;
}

const BASE = import.meta.env.BASE_URL;
const MAX_ATTACH_MB = 10;

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("erp_token");
  const res = await fetch(`${BASE}api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text).error ?? text; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" });
  if (diffDays < 7) return date.toLocaleDateString("en-AE", { weekday: "short" });
  return date.toLocaleDateString("en-AE", { day: "2-digit", month: "short" });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function groupByDate(emails: Email[]): { label: string; items: Email[] }[] {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - today.getDay());

  const groups: Record<string, Email[]> = {};
  for (const email of emails) {
    const d = new Date(email.createdAt);
    let label: string;
    if (d >= today) label = "Today";
    else if (d >= yesterday) label = "Yesterday";
    else if (d >= thisWeekStart) label = "This Week";
    else label = d.toLocaleDateString("en-AE", { month: "long", year: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(email);
  }
  const order = ["Today", "Yesterday", "This Week"];
  const sorted = Object.entries(groups).sort(([a], [b]) => {
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return b.localeCompare(a);
  });
  return sorted.map(([label, items]) => ({ label, items }));
}

/* ── Outlook envelope SVG ──────────────────────────────────────────────────── */
function OutlookEnvelope() {
  return (
    <svg width="96" height="72" viewBox="0 0 96 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="env-body" x1="0" y1="0" x2="96" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c5cae9" />
          <stop offset="100%" stopColor="#9fa8da" />
        </linearGradient>
        <linearGradient id="env-flap" x1="0" y1="0" x2="96" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b0bec5" />
          <stop offset="100%" stopColor="#90a4ae" />
        </linearGradient>
        <linearGradient id="env-inner" x1="0" y1="0" x2="0" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e8eaf6" />
          <stop offset="100%" stopColor="#c5cae9" />
        </linearGradient>
      </defs>
      {/* Envelope body */}
      <rect x="4" y="20" width="88" height="48" rx="4" fill="url(#env-body)" />
      {/* Inner white area */}
      <rect x="8" y="24" width="80" height="40" rx="2" fill="url(#env-inner)" />
      {/* Fold lines suggesting paper */}
      <line x1="20" y1="36" x2="76" y2="36" stroke="#b0bec5" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="42" x2="60" y2="42" stroke="#b0bec5" strokeWidth="1.5" strokeLinecap="round" />
      {/* Open flap */}
      <path d="M4 20 L48 4 L92 20" fill="url(#env-flap)" />
      <path d="M4 20 L48 4 L92 20 L4 20 Z" fill="none" stroke="#8e99a4" strokeWidth="0.5" />
    </svg>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export function EmailPanel({ companyId: companyIdProp }: { companyId?: number } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const companyId: number = companyIdProp ?? (user as any)?.companyId ?? 1;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("Home");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [readingPaneLayout, setReadingPaneLayout] = useState<"right" | "bottom" | "off">("right");
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(true);
  const [favExpanded, setFavExpanded] = useState(true);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [sendDropdown, setSendDropdown] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [compose, setCompose] = useState<ComposeData>({
    toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "",
  });

  const { data: settings } = useQuery({
    queryKey: ["email-settings", companyId],
    queryFn: () => apiFetch(`/email-settings?companyId=${companyId}`),
  });

  const isConnected = !!(settings?.smtpHost && settings?.smtpUser);
  const accountEmail = settings?.smtpUser ?? (companyId === 1 ? "info@primemaxprefab.com" : "info@eliteprefab.com");

  const emailsKey = ["emails", folder, search];
  const { data: emails = [], isLoading, refetch } = useQuery<Email[]>({
    queryKey: emailsKey,
    queryFn: () => {
      const params = new URLSearchParams(folder !== "starred" ? { folder } : {});
      if (search) params.set("search", search);
      return apiFetch(`/emails?${params}`);
    },
    refetchInterval: 60000,
  });

  const displayEmails = folder === "starred" ? emails.filter(e => e.isStarred) : emails;
  const groups = groupByDate(displayEmails);

  const { data: selectedEmail } = useQuery<Email>({
    queryKey: ["email", selectedId],
    queryFn: () => apiFetch(`/emails/${selectedId}`),
    enabled: !!selectedId,
  });

  // folder unread counts
  const { data: inboxEmails = [] } = useQuery<Email[]>({
    queryKey: ["emails", "inbox", ""],
    queryFn: () => apiFetch("/emails?folder=inbox"),
    refetchInterval: 60000,
  });
  const { data: draftEmails = [] } = useQuery<Email[]>({
    queryKey: ["emails", "draft", ""],
    queryFn: () => apiFetch("/emails?folder=draft"),
  });
  const { data: trashEmails = [] } = useQuery<Email[]>({
    queryKey: ["emails", "trash", ""],
    queryFn: () => apiFetch("/emails?folder=trash"),
  });

  const inboxUnread = inboxEmails.filter(e => !e.isRead).length;
  const draftCount = draftEmails.length;
  const trashCount = trashEmails.length;

  const folderCounts: Record<string, number> = {
    inbox: inboxUnread,
    draft: draftCount,
    trash: trashCount,
  };

  const syncMutation = useMutation({
    mutationFn: () => apiFetch("/emails/sync", { method: "POST", body: JSON.stringify({ companyId }) }),
    onSuccess: (data) => {
      toast({ title: data.message ?? "Inbox synced!" });
      qc.invalidateQueries({ queryKey: ["emails"] });
      setFolder("inbox");
      setLastSynced(new Date());
    },
    onError: (e: any) => {
      if (e.message?.includes("not configured")) {
        toast({ title: "Configure IMAP settings first.", variant: "destructive" });
        setShowSettings(true);
      } else {
        toast({ title: e.message, variant: "destructive" });
      }
    },
  });

  const sendMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/emails", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Email sent!" });
      setComposing(false);
      setAttachments([]);
      setCompose({ toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "" });
      qc.invalidateQueries({ queryKey: ["emails"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const saveDraftMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/emails", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      setDraftSavedAt(new Date());
      qc.invalidateQueries({ queryKey: ["emails"] });
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) =>
      apiFetch(`/emails/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["email", selectedId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/emails/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["emails"] });
      toast({ title: "Email moved to trash." });
    },
  });

  const handleSelect = (email: Email) => {
    setSelectedId(email.id);
    setComposing(false);
    if (!email.isRead && email.folder === "inbox") {
      patchMutation.mutate({ id: email.id, patch: { isRead: true } });
    }
  };

  const handleReply = (email: Email) => {
    setCompose({
      toAddress: email.fromAddress,
      toName: email.fromName ?? "",
      ccAddress: "",
      bccAddress: "",
      subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      body: `\n\n---\nOn ${formatDate(email.createdAt)}, ${email.fromName ?? email.fromAddress} wrote:\n${email.body.substring(0, 500)}`,
      replyToId: email.id,
    });
    setAttachments([]);
    setShowCc(false);
    setShowBcc(false);
    setComposing(true);
    setSelectedId(null);
  };

  const handleForward = (email: Email) => {
    setCompose({
      toAddress: "",
      toName: "",
      ccAddress: "",
      bccAddress: "",
      subject: email.subject.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n---\n---------- Forwarded message ----------\nFrom: ${email.fromName ?? email.fromAddress}\nDate: ${formatDate(email.createdAt)}\nSubject: ${email.subject}\n\n${email.body}`,
    });
    setAttachments([]);
    setShowCc(false);
    setShowBcc(false);
    setComposing(true);
    setSelectedId(null);
  };

  const handleMarkAllRead = () => {
    const unread = inboxEmails.filter(e => !e.isRead);
    if (unread.length === 0) { toast({ title: "All emails are already read." }); return; }
    Promise.all(unread.map(e => apiFetch(`/emails/${e.id}`, { method: "PATCH", body: JSON.stringify({ isRead: true }) })))
      .then(() => { qc.invalidateQueries({ queryKey: ["emails"] }); toast({ title: `${unread.length} email${unread.length === 1 ? "" : "s"} marked as read.` }); })
      .catch(() => toast({ title: "Failed to mark emails as read.", variant: "destructive" }));
  };

  const handleArchive = () => {
    if (!selectedId) return;
    patchMutation.mutate({ id: selectedId, patch: { folder: "trash" } }, {
      onSuccess: () => { setSelectedId(null); toast({ title: "Email archived." }); },
    });
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteMutation.mutate(selectedId);
  };

  const handleToggleStar = () => {
    if (!selectedId || !selectedEmail) return;
    patchMutation.mutate({ id: selectedId, patch: { isStarred: !selectedEmail.isStarred } });
  };

  const handleMove = (targetFolder: string) => {
    if (!selectedId) return;
    patchMutation.mutate({ id: selectedId, patch: { folder: targetFolder } }, {
      onSuccess: () => { setSelectedId(null); toast({ title: `Moved to ${targetFolder}.` }); },
    });
  };

  const handleSend = () => {
    if (!compose.toAddress || !compose.subject) {
      toast({ title: "To and Subject are required.", variant: "destructive" });
      return;
    }
    sendMutation.mutate({ ...compose, action: "send", companyId, attachments });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newAttachments: Attachment[] = [];
    for (const file of files) {
      if (file.size > MAX_ATTACH_MB * 1024 * 1024) {
        toast({ title: `${file.name} exceeds ${MAX_ATTACH_MB}MB limit.`, variant: "destructive" });
        continue;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      newAttachments.push({ filename: file.name, content: base64, contentType: file.type || "application/octet-stream", size: file.size });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  const openCompose = () => {
    setComposing(true);
    setSelectedId(null);
    setAttachments([]);
    setShowCc(false);
    setShowBcc(false);
    setCompose({ toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "" });
  };

  const FOLDERS: { key: Folder; label: string; icon: React.ReactNode }[] = [
    { key: "inbox",   label: "Inbox",        icon: <Inbox    className="w-4 h-4" /> },
    { key: "sent",    label: "Sent Items",   icon: <Send     className="w-4 h-4" /> },
    { key: "draft",   label: "Drafts",       icon: <FileText className="w-4 h-4" /> },
    { key: "trash",   label: "Deleted Items",icon: <Trash2   className="w-4 h-4" /> },
    { key: "starred", label: "Starred",      icon: <Star     className="w-4 h-4" /> },
  ];

  /* Outlook-style static sidebar folders (display order matches Outlook exactly).
     "key" is null for display-only folders that have no API backing.           */
  const ACCOUNT_FOLDERS: { key: Folder | null; label: string; icon: React.ReactNode }[] = [
    { key: "inbox",   label: "Inbox",        icon: <Inbox        className="w-4 h-4" /> },
    { key: null,      label: "Junk",         icon: <Shield       className="w-4 h-4" /> },
    { key: null,      label: "Junk Email",   icon: <ShieldAlert  className="w-4 h-4" /> },
    { key: "draft",   label: "Drafts",       icon: <FileText     className="w-4 h-4" /> },
    { key: "sent",    label: "Sent Items",   icon: <Send         className="w-4 h-4" /> },
    { key: "trash",   label: "Deleted Items",icon: <Trash2       className="w-4 h-4" /> },
    { key: null,      label: "Archive",      icon: <Archive      className="w-4 h-4" /> },
    { key: null,      label: "Outbox",       icon: <RotateCcw    className="w-4 h-4" /> },
  ];

  /* ── Avatar initial ─────────────────────────────────────────────────────── */
  const avatarInitial = (name?: string, addr?: string) =>
    (name ?? addr ?? "?").charAt(0).toUpperCase();

  return (
    <>
      <div
        className="flex flex-col overflow-hidden bg-white"
        style={{ height: "calc(100vh - 120px)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
      >

        {/* ── Outlook Ribbon ─────────────────────────────────────────────── */}
        <OutlookRibbon
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onNewMail={openCompose}
          onSync={() => syncMutation.mutate()}
          syncing={syncMutation.isPending}
          selectedEmail={selectedEmail ?? null}
          onDelete={handleDelete}
          onArchive={handleArchive}
          onReply={() => selectedEmail && handleReply(selectedEmail)}
          onForward={() => selectedEmail && handleForward(selectedEmail)}
          onMarkAllRead={handleMarkAllRead}
          onToggleStar={handleToggleStar}
          onMove={handleMove}
          currentFolder={folder}
          sidebarVisible={sidebarVisible}
          onToggleSidebar={() => setSidebarVisible(v => !v)}
          readingPaneLayout={readingPaneLayout}
          onChangeReadingPane={setReadingPaneLayout}
        />

        {/* ── Sync progress bar ───────────────────────────────────────────── */}
        {syncMutation.isPending && (
          <div style={{ background: "#f3f2f1", borderBottom: "1px solid #e1dfdd", padding: "0 12px", height: 28, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#0078d4" }} />
            <div style={{ flex: 1, height: 4, background: "#e1dfdd", borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%", borderRadius: 2, background: "#0078d4",
                  width: "40%",
                  animation: "sync-slide 1.2s ease-in-out infinite",
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: "#605e5c", whiteSpace: "nowrap" }}>Syncing inbox…</span>
          </div>
        )}
        {!syncMutation.isPending && lastSynced && (
          <div style={{ background: "#f9f8f7", borderBottom: "1px solid #e1dfdd", padding: "0 12px", height: 22, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <RefreshCw className="w-3 h-3" style={{ color: "#8a8886" }} />
            <span style={{ fontSize: 11, color: "#8a8886" }}>
              Last synced: {lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}

        {/* ── Three-pane layout ──────────────────────────────────────────── */}
        <div className={`flex flex-1 overflow-hidden ${readingPaneLayout === "bottom" ? "flex-col" : "flex-row"}`}>

        {/* ════════════════════════════════════════════════════════════════════
            LEFT SIDEBAR — folder tree (Outlook style)
        ════════════════════════════════════════════════════════════════════ */}
        <div
          className="flex flex-col border-r"
          style={{ width: 220, minWidth: 220, background: "#ffffff", borderColor: "#e1dfdd", display: sidebarVisible ? undefined : "none" }}
        >
          {/* New mail button */}
          <div className="px-3 pt-3 pb-2">
            <button
              onClick={openCompose}
              className="flex items-center gap-2 w-full text-[13px] font-semibold rounded px-3 py-2 transition-colors"
              style={{ background: "#0078d4", color: "#fff" }}
            >
              <Plus className="w-4 h-4" />
              New mail
            </button>
          </div>

          {/* Sync button */}
          <div className="px-3 pb-2">
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 w-full text-[12px] rounded px-3 py-1.5 transition-colors border"
              style={{ borderColor: "#e1dfdd", color: "#605e5c" }}
            >
              {syncMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RotateCcw className="w-3.5 h-3.5" />}
              {syncMutation.isPending ? "Syncing…" : "Sync inbox"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* Favorites section */}
            <div className="mb-1">
              <button
                className="flex items-center gap-1 w-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide select-none"
                style={{ color: "#605e5c" }}
                onClick={() => setFavExpanded(s => !s)}
              >
                {favExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Favorites
              </button>
              {favExpanded && (
                <div>
                  {["inbox", "sent", "starred"].map(fk => {
                    const f = FOLDERS.find(x => x.key === fk)!;
                    const count = folderCounts[f.key] ?? 0;
                    const active = folder === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => { setFolder(f.key); setSelectedId(null); setComposing(false); }}
                        className="flex items-center w-full px-5 py-1.5 text-[13px] transition-colors"
                        style={{
                          background: active ? "#dce9f8" : "transparent",
                          color: active ? "#0078d4" : "#323130",
                          fontWeight: active ? 600 : 400,
                          borderRight: active ? "2px solid #0078d4" : "2px solid transparent",
                        }}
                      >
                        <span className="flex-1 text-left truncate">{f.label}</span>
                        {count > 0 && (
                          <span className="text-[11px] font-semibold" style={{ color: active ? "#0078d4" : "#323130" }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Account section */}
            <div>
              {/* Account header — plain email + chevron, no avatar */}
              <button
                className="flex items-center gap-1 w-full px-3 py-1 text-[12px] font-semibold select-none"
                style={{ color: "#323130" }}
                onClick={() => setAccountExpanded(s => !s)}
              >
                {accountExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate">{accountEmail}</span>
                {!isConnected && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" title="Not connected" />
                )}
              </button>

              {/* Folder list — Outlook order, with hover ··· */}
              {accountExpanded && (
                <div>
                  {ACCOUNT_FOLDERS.map(f => {
                    const active = !!f.key && folder === f.key;
                    const count = f.key ? (folderCounts[f.key] ?? 0) : 0;
                    return (
                      <div key={f.label} className="group relative">
                        <button
                          onClick={() => {
                            if (f.key) { setFolder(f.key); setSelectedId(null); setComposing(false); }
                          }}
                          className="flex items-center gap-2 w-full px-6 py-1.5 text-[13px] transition-colors"
                          style={{
                            background: active ? "#dce9f8" : "transparent",
                            color: active ? "#0078d4" : "#323130",
                            fontWeight: active ? 600 : 400,
                            borderRight: active ? "2px solid #0078d4" : "2px solid transparent",
                            cursor: f.key ? "pointer" : "default",
                          }}
                        >
                          <span style={{ color: active ? "#0078d4" : "#605e5c", flexShrink: 0 }}>{f.icon}</span>
                          <span className="flex-1 text-left truncate">{f.label}</span>
                          {count > 0 && (
                            <span className="text-[11px] font-semibold mr-5" style={{ color: active ? "#0078d4" : "#323130" }}>
                              {count}
                            </span>
                          )}
                        </button>
                        {/* ··· hover button */}
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity rounded px-1 py-0.5 hover:bg-[#e8e8e8]"
                          style={{ color: "#605e5c", fontSize: 12 }}
                          onClick={e => e.stopPropagation()}
                        >
                          ···
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom: Add account (matches Outlook) */}
          <div className="border-t px-3 py-2" style={{ borderColor: "#e1dfdd" }}>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 w-full text-[13px] px-2 py-1.5 rounded transition-colors hover:bg-[#f3f2f1]"
              style={{ color: "#0078d4" }}
            >
              <UserPlus className="w-4 h-4" />
              {isConnected ? "Add account" : "Add account"}
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            MIDDLE PANE — email list
        ════════════════════════════════════════════════════════════════════ */}
        <div
          className="flex flex-col border-r flex-shrink-0"
          style={{ width: 320, background: "#ffffff", borderColor: "#e1dfdd" }}
        >
          {/* Header */}
          <div className="px-4 pt-3 pb-0 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-semibold" style={{ color: "#323130" }}>
                  {FOLDERS.find(f => f.key === folder)?.label ?? folder}
                </span>
                {folder === "inbox" && (
                  <button
                    onClick={() => patchMutation.mutate({ id: -1, patch: {} })}
                    className="opacity-40 hover:opacity-100 transition-opacity"
                    title="Mark as favourite"
                  >
                    <Star className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => refetch()}
                  className="p-1.5 rounded transition-colors hover:bg-gray-100"
                  style={{ color: "#605e5c" }}
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 rounded transition-colors hover:bg-gray-100" style={{ color: "#605e5c" }}>
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#605e5c" }} />
              <input
                className="w-full text-[13px] rounded pl-8 pr-3 py-1.5 outline-none border"
                style={{
                  background: "#f3f2f1",
                  borderColor: "transparent",
                  color: "#323130",
                  fontFamily: "'Segoe UI', system-ui, sans-serif",
                }}
                placeholder="Search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={e => (e.target.style.borderColor = "#0078d4")}
                onBlur={e => (e.target.style.borderColor = "transparent")}
              />
            </div>

            {/* Filter row */}
            <div className="flex items-center justify-between pb-1.5">
              <div className="flex items-center gap-0">
                <button className="text-[13px] font-semibold pb-1.5 mr-3 border-b-2" style={{ color: "#0078d4", borderColor: "#0078d4" }}>
                  Focused
                </button>
                <button className="text-[13px] pb-1.5 border-b-2 border-transparent" style={{ color: "#605e5c" }}>
                  Other
                </button>
              </div>
              <div className="flex items-center gap-1 text-[12px]" style={{ color: "#605e5c" }}>
                <button className="hover:text-[#0078d4] p-0.5" title="Filter"><Flag className="w-3.5 h-3.5" /></button>
                <button className="hover:text-[#0078d4] p-0.5" title="Sort"><ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>

          <div className="h-px" style={{ background: "#e1dfdd" }} />

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center h-32 gap-2" style={{ color: "#605e5c" }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[13px]">Loading…</span>
              </div>
            )}

            {!isLoading && displayEmails.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <Mail className="w-10 h-10 opacity-20" style={{ color: "#605e5c" }} />
                <div className="text-center">
                  <p className="text-[13px]" style={{ color: "#323130" }}>No messages</p>
                  {folder === "inbox" && !isConnected && (
                    <button
                      className="text-[12px] mt-1 underline"
                      style={{ color: "#0078d4" }}
                      onClick={() => setShowSettings(true)}
                    >Connect email account</button>
                  )}
                </div>
              </div>
            )}

            {groups.map(({ label, items }) => (
              <div key={label}>
                {/* Date group header */}
                <div
                  className="px-4 py-1 text-[11px] font-semibold sticky top-0 z-10"
                  style={{ background: "#f3f2f1", color: "#605e5c" }}
                >
                  {label}
                </div>

                {items.map(email => {
                  const isSelected = selectedId === email.id;
                  const isUnread = !email.isRead && email.folder === "inbox";
                  const displayName = email.folder === "sent"
                    ? (email.toName ?? email.toAddress)
                    : (email.fromName ?? email.fromAddress);

                  return (
                    <button
                      key={email.id}
                      onClick={() => handleSelect(email)}
                      className="w-full text-left px-4 py-2.5 transition-colors relative"
                      style={{
                        background: isSelected ? "#dce9f8" : "transparent",
                        borderLeft: isSelected ? "3px solid #0078d4" : "3px solid transparent",
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f3f2f1"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <div className="flex items-start gap-2">
                        {/* Unread dot */}
                        <div className="flex-shrink-0 mt-1.5">
                          {isUnread
                            ? <span className="w-2 h-2 rounded-full block" style={{ background: "#0078d4" }} />
                            : <span className="w-2 h-2 block" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Row 1: sender + time */}
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="text-[13px] truncate max-w-[160px]"
                              style={{
                                color: "#323130",
                                fontWeight: isUnread ? 700 : 400,
                              }}
                            >
                              {displayName}
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {email.attachments && (email.attachments as any[]).length > 0 && (
                                <Paperclip className="w-3 h-3" style={{ color: "#605e5c" }} />
                              )}
                              {email.isStarred && <Star className="w-3 h-3 fill-orange-400 text-orange-400" />}
                              <span className="text-[11px]" style={{ color: "#605e5c" }}>
                                {formatDate(email.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Row 2: subject */}
                          <div
                            className="text-[13px] truncate"
                            style={{
                              color: "#323130",
                              fontWeight: isUnread ? 600 : 400,
                            }}
                          >
                            {email.subject || "(no subject)"}
                          </div>

                          {/* Row 3: preview */}
                          <div className="text-[12px] truncate" style={{ color: "#605e5c" }}>
                            {email.body.replace(/\n/g, " ").substring(0, 80)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            RIGHT PANE — compose / reading / empty
        ════════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white" style={{ display: readingPaneLayout !== "off" ? undefined : "none" }}>

          {composing ? (
            /* ── Compose — full Outlook-style ─────────────────────────────── */
            <div className="flex flex-col h-full">

              {/* Send row */}
              <div className="flex items-center px-4 py-2 border-b flex-shrink-0 gap-3" style={{ borderColor: "#e1dfdd" }}>
                {/* Split Send button with working dropdown */}
                <div className="relative flex-shrink-0">
                  <div className="flex items-center rounded overflow-hidden" style={{ border: "1px solid #005a9e" }}>
                    <button
                      onClick={handleSend}
                      disabled={sendMutation.isPending}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold text-white focus:outline-none hover:bg-[#106ebe] active:bg-[#005a9e] transition-colors"
                      style={{ background: "#0078d4" }}
                    >
                      {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2l14 6-14 6V9.5l10-1.5-10-1.5V2z"/></svg>}
                      {sendMutation.isPending ? "Sending…" : "Send"}
                    </button>
                    <button
                      onClick={() => setSendDropdown(s => !s)}
                      className="px-2 py-1.5 text-white border-l focus:outline-none hover:bg-[#106ebe] active:bg-[#005a9e] transition-colors"
                      style={{ background: "#0078d4", borderColor: "rgba(255,255,255,0.3)" }}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Dropdown menu */}
                  {sendDropdown && (
                    <>
                      {/* Click-away backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setSendDropdown(false)} />
                      <div
                        className="absolute left-0 top-full mt-1 z-20 rounded shadow-lg border overflow-hidden"
                        style={{ background: "#ffffff", borderColor: "#e1dfdd", minWidth: 180 }}
                      >
                        <button
                          onClick={() => { setSendDropdown(false); handleSend(); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors"
                          style={{ color: "#323130" }}
                        >
                          <svg className="w-3.5 h-3.5 text-[#0078d4]" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2l14 6-14 6V9.5l10-1.5-10-1.5V2z"/></svg>
                          Send
                        </button>
                        <button
                          onClick={() => { setSendDropdown(false); saveDraftMutation.mutate({ ...compose, folder: "draft", companyId }); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors"
                          style={{ color: "#323130" }}
                        >
                          <FileText className="w-3.5 h-3.5" style={{ color: "#605e5c" }} />
                          Save draft
                        </button>
                        <div className="border-t" style={{ borderColor: "#e1dfdd" }} />
                        <button
                          onClick={() => { setSendDropdown(false); setShowSettings(true); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors"
                          style={{ color: "#323130" }}
                        >
                          <Settings className="w-3.5 h-3.5" style={{ color: "#605e5c" }} />
                          Manage account
                        </button>
                        <div className="border-t" style={{ borderColor: "#e1dfdd" }} />
                        <button
                          onClick={() => { setSendDropdown(false); setComposing(false); setAttachments([]); setDraftSavedAt(null); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] hover:bg-[#f3f2f1] transition-colors"
                          style={{ color: "#a4262c" }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Discard
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[13px]" style={{ color: "#323130" }}>
                  <span style={{ color: "#605e5c" }}>From:</span>
                  <button className="flex items-center gap-1 font-medium hover:text-[#0078d4] transition-colors">
                    {settings?.smtpUser || accountEmail}
                    <ChevronDown className="w-3 h-3" style={{ color: "#605e5c" }} />
                  </button>
                </div>

                <div className="ml-auto flex items-center gap-1">
                  {/* Attach file */}
                  <label className="cursor-pointer p-1.5 rounded transition-colors hover:bg-gray-100" title="Attach file">
                    <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                    <Paperclip className="w-4 h-4" style={{ color: "#605e5c" }} />
                  </label>
                  <button
                    onClick={() => { setComposing(false); setAttachments([]); setDraftSavedAt(null); }}
                    className="p-1.5 rounded transition-colors hover:bg-gray-100"
                    style={{ color: "#605e5c" }}
                    title="Discard"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setComposing(false); setAttachments([]); setDraftSavedAt(null); }}
                    className="p-1.5 rounded transition-colors hover:bg-gray-100"
                    style={{ color: "#605e5c" }}
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* To */}
              <div className="flex items-center px-4 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd", minHeight: 40 }}>
                <button
                  className="flex-shrink-0 text-[12px] font-medium border rounded px-2 py-0.5 mr-2 select-none"
                  style={{ borderColor: "#8a8886", color: "#323130", background: "transparent" }}
                >
                  To
                </button>
                <input
                  type="text"
                  className="flex-1 text-[13px] py-2.5 outline-none bg-transparent"
                  style={{ color: "#323130", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                  value={compose.toAddress}
                  onChange={e => setCompose(p => ({ ...p, toAddress: e.target.value }))}
                />
                <div className="flex items-center gap-3 flex-shrink-0">
                  {!showCc && <button className="text-[13px] font-normal" style={{ color: "#605e5c" }} onClick={() => setShowCc(true)}>Cc</button>}
                  {!showBcc && <button className="text-[13px] font-normal" style={{ color: "#605e5c" }} onClick={() => setShowBcc(true)}>Bcc</button>}
                </div>
              </div>

              {showCc && (
                <div className="flex items-center px-4 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd", minHeight: 40 }}>
                  <span className="text-[13px] w-10 flex-shrink-0" style={{ color: "#605e5c" }}>Cc</span>
                  <input type="text" className="flex-1 text-[13px] py-2.5 outline-none bg-transparent" style={{ color: "#323130", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                    value={compose.ccAddress} onChange={e => setCompose(p => ({ ...p, ccAddress: e.target.value }))} autoFocus />
                  <button onClick={() => { setShowCc(false); setCompose(p => ({ ...p, ccAddress: "" })); }} style={{ color: "#605e5c" }}><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              {showBcc && (
                <div className="flex items-center px-4 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd", minHeight: 40 }}>
                  <span className="text-[13px] w-10 flex-shrink-0" style={{ color: "#605e5c" }}>Bcc</span>
                  <input type="text" className="flex-1 text-[13px] py-2.5 outline-none bg-transparent" style={{ color: "#323130", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                    value={compose.bccAddress} onChange={e => setCompose(p => ({ ...p, bccAddress: e.target.value }))} autoFocus />
                  <button onClick={() => { setShowBcc(false); setCompose(p => ({ ...p, bccAddress: "" })); }} style={{ color: "#605e5c" }}><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {/* Subject */}
              <div className="flex items-center px-4 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd", minHeight: 40 }}>
                <input
                  type="text"
                  className="flex-1 text-[15px] py-2.5 outline-none bg-transparent"
                  style={{ color: "#323130", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                  placeholder="Add a subject"
                  value={compose.subject}
                  onChange={e => { setCompose(p => ({ ...p, subject: e.target.value })); setDraftSavedAt(null); }}
                />
                {draftSavedAt && (
                  <span className="flex-shrink-0 text-[12px] ml-3" style={{ color: "#605e5c" }}>
                    Draft saved at {draftSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="flex-1 px-4 pt-3 overflow-hidden">
                <textarea
                  className="w-full h-full resize-none outline-none bg-transparent text-[13px]"
                  style={{ color: "#323130", fontFamily: "'Segoe UI', system-ui, sans-serif", lineHeight: 1.6 }}
                  placeholder=""
                  value={compose.body}
                  onChange={e => setCompose(p => ({ ...p, body: e.target.value }))}
                />
              </div>

              {/* Attachment chips */}
              {attachments.length > 0 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5 border-t flex-shrink-0" style={{ borderColor: "#e1dfdd" }}>
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 rounded border px-2 py-1 text-[12px]"
                      style={{ borderColor: "#e1dfdd", color: "#323130" }}>
                      <FileIcon className="w-3.5 h-3.5" style={{ color: "#0078d4" }} />
                      <span className="truncate max-w-[140px]">{att.filename}</span>
                      <span style={{ color: "#605e5c" }}>{formatBytes(att.size)}</span>
                      <button onClick={() => removeAttachment(idx)} style={{ color: "#605e5c" }}><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : selectedEmail ? (
            /* ── Reading pane ──────────────────────────────────────────────── */
            <div className="flex flex-col h-full">

              {/* Reading pane toolbar */}
              <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd" }}>
                {selectedEmail.folder !== "sent" && (
                  <button
                    onClick={() => handleReply(selectedEmail)}
                    className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
                    style={{ borderColor: "#e1dfdd", color: "#323130" }}
                  >
                    <Reply className="w-3.5 h-3.5" /> Reply
                  </button>
                )}
                <button
                  className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
                  style={{ borderColor: "#e1dfdd", color: "#323130" }}
                >
                  <Forward className="w-3.5 h-3.5" /> Forward
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => patchMutation.mutate({ id: selectedEmail.id, patch: { isStarred: !selectedEmail.isStarred } })}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: selectedEmail.isStarred ? "#f97316" : "#605e5c" }}
                >
                  <Star className={`w-4 h-4 ${selectedEmail.isStarred ? "fill-orange-400" : ""}`} />
                </button>
                <button
                  onClick={() => patchMutation.mutate({ id: selectedEmail.id, patch: { isRead: !selectedEmail.isRead } })}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: "#605e5c" }}
                  title={selectedEmail.isRead ? "Mark as unread" : "Mark as read"}
                >
                  {selectedEmail.isRead ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(selectedEmail.id)}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: "#a4262c" }}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Subject */}
              <div className="px-5 pt-4 pb-2 flex-shrink-0">
                <h2 className="text-[20px] font-semibold" style={{ color: "#323130" }}>
                  {selectedEmail.subject || "(no subject)"}
                </h2>
              </div>

              {/* Sender info */}
              <div className="px-5 py-3 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[15px] flex-shrink-0"
                      style={{ background: "#0078d4" }}
                    >
                      {avatarInitial(selectedEmail.fromName, selectedEmail.fromAddress)}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold" style={{ color: "#323130" }}>
                        {selectedEmail.fromName ?? selectedEmail.fromAddress}
                      </div>
                      <div className="text-[12px]" style={{ color: "#605e5c" }}>
                        {selectedEmail.fromAddress}
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: "#a19f9d" }}>
                        To: {selectedEmail.toAddress}
                        {selectedEmail.ccAddress && ` · Cc: ${selectedEmail.ccAddress}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[12px]" style={{ color: "#605e5c" }}>
                      {new Date(selectedEmail.createdAt).toLocaleString("en-AE", {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachments on received email */}
              {selectedEmail.attachments && (selectedEmail.attachments as any[]).length > 0 && (
                <div className="px-5 py-2 border-b flex flex-wrap gap-2 flex-shrink-0" style={{ borderColor: "#e1dfdd", background: "#faf9f8" }}>
                  {(selectedEmail.attachments as any[]).map((att, i) => (
                    <a key={i}
                      href={att.content
                        ? `data:${att.contentType};base64,${att.content}`
                        : `${BASE}api/emails/${selectedEmail.id}/attachments/${i}`}
                      download={att.filename}
                      className="flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px] transition-colors hover:bg-blue-50"
                      style={{ borderColor: "#e1dfdd", color: "#323130", textDecoration: "none" }}
                    >
                      <Paperclip className="w-3 h-3" style={{ color: "#605e5c" }} />
                      <span className="truncate max-w-[140px]">{att.filename}</span>
                      <span style={{ color: "#a19f9d" }}>{formatBytes(att.size ?? 0)}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="text-[14px] whitespace-pre-line leading-relaxed" style={{ color: "#323130" }}>
                  {selectedEmail.body}
                </div>
              </div>

              {/* Quick reply */}
              <div className="border-t px-5 py-3 flex-shrink-0" style={{ borderColor: "#e1dfdd", background: "#faf9f8" }}>
                <button
                  onClick={() => handleReply(selectedEmail)}
                  className="flex items-center gap-2 w-full text-[13px] rounded border px-3 py-2 text-left transition-colors hover:bg-white"
                  style={{ borderColor: "#e1dfdd", color: "#605e5c" }}
                >
                  <Reply className="w-3.5 h-3.5" />
                  Reply to {selectedEmail.fromName ?? selectedEmail.fromAddress}…
                </button>
              </div>
            </div>

          ) : (
            /* ── Empty state — Outlook style ───────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <OutlookEnvelope />
              <div className="text-center">
                <p className="text-[16px] font-semibold" style={{ color: "#323130" }}>
                  Select an item to read
                </p>
                <p className="text-[13px] mt-1" style={{ color: "#605e5c" }}>
                  Nothing is selected
                </p>
              </div>
              {!isConnected && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="mt-2 flex items-center gap-2 text-[13px] px-4 py-2 rounded text-white"
                  style={{ background: "#0078d4" }}
                >
                  <Mail className="w-4 h-4" /> Connect Email Account
                </button>
              )}
            </div>
          )}
        </div>
        </div>{/* end three-pane layout */}
      </div>

      <EmailSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        companyId={companyId}
      />
    </>
  );
}
