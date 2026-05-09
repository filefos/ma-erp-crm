import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TechSpecSection } from "@/lib/tech-spec-templates";

interface Props {
  sections: TechSpecSection[];
  onChange: (sections: TechSpecSection[]) => void;
}

export function TechSpecEditor({ sections, onChange }: Props) {
  const updateTitle = (si: number, title: string) =>
    onChange(sections.map((s, i) => i === si ? { ...s, title: title.toUpperCase() } : s));

  const updatePoint = (si: number, pi: number, val: string) =>
    onChange(sections.map((s, i) =>
      i === si ? { ...s, points: s.points.map((p, j) => j === pi ? val : p) } : s
    ));

  const addPoint = (si: number) =>
    onChange(sections.map((s, i) => i === si ? { ...s, points: [...s.points, ""] } : s));

  const removePoint = (si: number, pi: number) =>
    onChange(sections.map((s, i) =>
      i === si ? { ...s, points: s.points.filter((_, j) => j !== pi) } : s
    ));

  const removeSection = (si: number) =>
    onChange(sections.filter((_, i) => i !== si));

  const addSection = () =>
    onChange([...sections, { title: "NEW SECTION", points: [""] }]);

  const moveSection = (si: number, dir: -1 | 1) => {
    const next = [...sections];
    const swap = si + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[si], next[swap]] = [next[swap], next[si]];
    onChange(next);
  };

  return (
    <div className="border border-gray-300 rounded overflow-hidden text-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ backgroundColor: "#0f2d5a" } as React.CSSProperties}>
            <th className="border border-gray-500 px-1 py-2 text-white text-sm font-bold text-center" style={{ width: 100 }}>
              Section
            </th>
            <th className="border border-gray-500 px-1 py-2 text-white text-sm font-bold text-center" style={{ width: 32 }}>
              Pt.
            </th>
            <th className="border border-gray-500 px-2 py-2 text-white text-sm font-bold text-left">
              Description
            </th>
            <th className="border border-gray-500 px-1 py-2 text-white text-sm font-bold text-center" style={{ width: 72 }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section, si) => {
            const rowCount = Math.max(section.points.length, 1);
            return section.points.length === 0 ? (
              <tr key={`${si}-empty`}>
                <td
                  className="border border-gray-400 p-1 text-center align-middle"
                  style={{ backgroundColor: "#1e3a6e" } as React.CSSProperties}
                >
                  <input
                    className="w-full text-center text-white text-sm font-bold uppercase bg-transparent border-0 outline-none placeholder-white/40"
                    value={section.title}
                    placeholder="SECTION NAME"
                    onChange={e => updateTitle(si, e.target.value)}
                  />
                  <div className="flex justify-center gap-0.5 mt-1">
                    <button type="button" onClick={() => moveSection(si, -1)} className="text-white/60 hover:text-white"><ChevronUp className="w-3 h-3" /></button>
                    <button type="button" onClick={() => moveSection(si, 1)} className="text-white/60 hover:text-white"><ChevronDown className="w-3 h-3" /></button>
                  </div>
                </td>
                <td className="border border-gray-400 text-center text-gray-400">—</td>
                <td className="border border-gray-400 px-2 text-gray-400 italic">No points — add one</td>
                <td className="border border-gray-400 p-1 text-center">
                  <div className="flex gap-0.5 justify-center">
                    <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => addPoint(si)} title="Add point">
                      <Plus className="w-3.5 h-3.5 text-blue-600" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeSection(si)} title="Delete section">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              section.points.map((point, pi) => (
                <tr key={`${si}-${pi}`} style={{ backgroundColor: pi % 2 === 0 ? "#ffffff" : "#f5f8fc" } as React.CSSProperties}>
                  {pi === 0 && (
                    <td
                      rowSpan={rowCount}
                      className="border border-gray-400 p-1 text-center align-middle"
                      style={{ backgroundColor: "#1e3a6e", width: 100, verticalAlign: "middle" } as React.CSSProperties}
                    >
                      <input
                        className="w-full text-center text-white text-sm font-bold uppercase bg-transparent border-0 outline-none placeholder-white/40 leading-tight"
                        value={section.title}
                        placeholder="SECTION"
                        onChange={e => updateTitle(si, e.target.value)}
                      />
                      <div className="flex justify-center gap-0.5 mt-1">
                        <button type="button" onClick={() => moveSection(si, -1)} className="text-white/60 hover:text-white" title="Move up">
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => moveSection(si, 1)} className="text-white/60 hover:text-white" title="Move down">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex justify-center gap-0.5 mt-0.5">
                        <button type="button" onClick={() => addPoint(si)} className="text-white/60 hover:text-white" title="Add point">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => removeSection(si)} className="text-red-300/70 hover:text-red-300" title="Delete section">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  )}
                  <td className="border border-gray-400 px-1 py-1 text-center font-semibold text-gray-600 align-top text-sm">
                    {String.fromCharCode(97 + pi)}
                  </td>
                  <td className="border border-gray-400 px-2 py-1 align-top">
                    <textarea
                      className="w-full resize-none text-base border-0 outline-none bg-transparent leading-relaxed"
                      value={point}
                      rows={Math.max(2, Math.ceil((point.length || 1) / 60))}
                      placeholder={point === "" ? "(empty row — leave blank for print spacing)" : ""}
                      onChange={e => updatePoint(si, pi, e.target.value)}
                    />
                  </td>
                  <td className="border border-gray-400 p-1 text-center align-top">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => removePoint(si, pi)}
                      title="Remove this point"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  </td>
                </tr>
              ))
            );
          })}
        </tbody>
      </table>
      <div className="p-2 border-t border-gray-200 bg-gray-50 flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={addSection}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Section
        </Button>
        <span className="text-xs text-muted-foreground">
          Blank point rows print as empty lines for handwritten additions.
        </span>
      </div>
    </div>
  );
}
