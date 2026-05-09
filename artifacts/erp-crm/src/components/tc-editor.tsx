import { Plus, Trash2, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TCSection {
  title: string;
  items: string[];
}

export function parseTCString(text: string): TCSection[] {
  const lines = text.split("\n").map(l => l.trim());
  const sections: TCSection[] = [];
  let current: TCSection | null = null;
  for (const line of lines) {
    if (!line) continue;
    const isHeader = /^\d+\.\s+[A-Z][A-Z0-9\s&]+$/.test(line);
    if (isHeader) {
      if (current) sections.push(current);
      current = { title: line, items: [] };
    } else if (current) {
      current.items.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

export function serializeTCSections(sections: TCSection[]): string {
  return sections
    .map((sec, si) => {
      const headerNum = si + 1;
      const titleBody = sec.title.replace(/^\d+\.\s*/, "");
      const header = `${headerNum}. ${titleBody.toUpperCase()}`;
      const items = sec.items.map((item, ii) => {
        const body = item.replace(/^\d+\.\s*/, "");
        return `${ii + 1}. ${body}`;
      });
      return [header, ...items].join("\n");
    })
    .join("\n\n");
}

interface Props {
  sections: TCSection[];
  onChange: (sections: TCSection[]) => void;
  onReset?: () => void;
}

export function TCEditor({ sections, onChange, onReset }: Props) {
  const updateTitle = (si: number, title: string) =>
    onChange(sections.map((s, i) => i === si ? { ...s, title: title.toUpperCase() } : s));

  const updateItem = (si: number, ii: number, val: string) =>
    onChange(sections.map((s, i) =>
      i === si ? { ...s, items: s.items.map((it, j) => j === ii ? val : it) } : s
    ));

  const addItem = (si: number) =>
    onChange(sections.map((s, i) => i === si ? { ...s, items: [...s.items, ""] } : s));

  const removeItem = (si: number, ii: number) =>
    onChange(sections.map((s, i) =>
      i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s
    ));

  const removeSection = (si: number) =>
    onChange(sections.filter((_, i) => i !== si));

  const addSection = () =>
    onChange([...sections, { title: "NEW SECTION", items: [""] }]);

  const moveSection = (si: number, dir: -1 | 1) => {
    const next = [...sections];
    const swap = si + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[si], next[swap]] = [next[swap], next[si]];
    onChange(next);
  };

  return (
    <div className="border border-gray-300 rounded overflow-hidden text-sm">
      {sections.map((sec, si) => {
        const headerNum = si + 1;
        const titleBody = sec.title.replace(/^\d+\.\s*/, "");
        return (
          <div key={si} className="mb-0">
            {/* Section header bar */}
            <div
              className="flex items-center gap-1 px-2 py-1"
              style={{ backgroundColor: "#1e3a6e" } as React.CSSProperties}
            >
              <span className="text-white font-bold text-sm shrink-0">{headerNum}.</span>
              <input
                className="flex-1 text-white font-bold text-sm uppercase bg-transparent border-0 outline-none placeholder-white/40 tracking-wide"
                value={titleBody}
                placeholder="SECTION TITLE"
                onChange={e => updateTitle(si, `${headerNum}. ${e.target.value}`)}
              />
              <button type="button" onClick={() => moveSection(si, -1)} className="text-white/60 hover:text-white" title="Move up">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => moveSection(si, 1)} className="text-white/60 hover:text-white" title="Move down">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => addItem(si)} className="text-white/60 hover:text-white" title="Add item">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => removeSection(si)} className="text-red-300/70 hover:text-red-300" title="Delete section">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Items */}
            <table className="w-full border-collapse">
              <tbody>
                {sec.items.length === 0 ? (
                  <tr>
                    <td className="border border-gray-200 px-3 py-1.5 text-gray-400 italic text-sm">
                      No items — click + above to add one
                    </td>
                  </tr>
                ) : (
                  sec.items.map((item, ii) => {
                    const body = item.replace(/^\d+\.\s*/, "");
                    const isCheque = /cheque(s)?\s+shall\s+be\s+prepared\s+in\s+fav/i.test(item);
                    return (
                      <tr
                        key={ii}
                        style={{ backgroundColor: ii % 2 === 0 ? "#f8fafc" : "#ffffff" } as React.CSSProperties}
                      >
                        <td className="border border-gray-200 px-2 py-1 text-center font-semibold text-gray-500 align-top shrink-0 text-sm" style={{ width: 32 }}>
                          {ii + 1}.
                        </td>
                        <td className={`border border-gray-200 px-2 py-1 align-top ${isCheque ? "bg-blue-50" : ""}`}>
                          <textarea
                            className={`w-full resize-none border-0 outline-none bg-transparent leading-relaxed text-base ${isCheque ? "font-semibold text-[#0f2d5a]" : ""}`}
                            value={body}
                            rows={Math.max(2, Math.ceil((body.length || 1) / 60))}
                            placeholder="Enter item text..."
                            onChange={e => updateItem(si, ii, `${ii + 1}. ${e.target.value}`)}
                          />
                        </td>
                        <td className="border border-gray-200 p-1 text-center align-top" style={{ width: 32 }}>
                          <button
                            type="button"
                            onClick={() => removeItem(si, ii)}
                            className="text-red-400 hover:text-red-600"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        );
      })}

      <div className="p-2 border-t border-gray-200 bg-gray-50 flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={addSection}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Section
        </Button>
        {onReset && (
          <Button type="button" size="sm" variant="ghost" onClick={onReset} className="text-muted-foreground">
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset to Default
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          Editable T&amp;C — changes saved with the quotation
        </span>
      </div>
    </div>
  );
}
