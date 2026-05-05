export interface TechSpecSection {
  title: string;
  points: string[];
}

export type SpecTypeKey =
  | "standard_fire_rated"
  | "modified_container"
  | "sandwich_panel"
  | "aluminum_cladding";

export interface SpecTypeOption {
  key: SpecTypeKey;
  label: string;
  sections: TechSpecSection[];
}

const STANDARD_FIRE_RATED: TechSpecSection[] = [
  {
    title: "BASE FRAME",
    points: [
      "The steel base & Top frame shall be constructed from MS I-BEAM 120X64, full perimeter beams with central runner and cross members.",
      "Lifting eyes are provided at intermediate points at the Base of the cabin welded and painted in 01 coat of red oxide primer and 01 coat with matt enamel paint.",
      "Base frame shall be painted with 02 coat paint, one with red oxide, one with rust free enamel paint.",
      "",
    ],
  },
  {
    title: "FLOOR SYSTEM",
    points: [
      "Floor Frame: The Floor frame shall be constructed from MS angle 50X50X2.7MM welded into the base & top frame, making the floor assembly one integral frame. (400mm joists spacing). Grit blasted to SA2.5 and painted with 02 coat system of epoxy paint.",
      "Floor Decking: One layer of 18mm thick cement board, fixed to the base frame and floor frame. Bottom of the cement board is painted with bitumen paint.",
      "Floor Finish in Dry Area: 1.5mm PVC vinyl sheet from a good brand.",
      "Floor Finish in Wet Area: PVC vinyl sheet 1.5mm thick.",
    ],
  },
  {
    title: "WALL SYSTEM",
    points: [
      "External Finish: 06mm thick cement board finish with heavy texture paint (approved color). External wall joints covered by 6mm thick CFB joint strips.",
      "Internal Finish in Dry Area: 12.5mm thick gypsum board finish with emulsion paint. Floor skirting MDF 50mm / PVC 75MM SKIRTING.",
      "Internal Finish in Wet Area: 12mm thick MR GYPSUM board fixed to cold formed steel wall framing. Joints covered with MDF 5cm skirting.",
      "Wall Framing: LGS profile framing GI studs 70x35x0.45 fixed together by screws at spacing of 610mm vertically & 1200mm horizontally.",
      "Wall Insulation: 50mm thick glass-wool insulation 12kg/m3 density.",
      "Dry Area: Emulsion paint (off-white color) applied to gypsum board. (National). Wet Area: Enamel paint (white color) applied to cement fiber board. (National).",
    ],
  },
  {
    title: "ROOFING",
    points: [
      "Roof Covering: 0.5mm thick GI Corrugated steel fixed on furry channel 0.5mm purlins as per drawing.",
      "Trusses: Truss made of MS Angle 40x40x2.7mm.",
      "",
    ],
  },
  {
    title: "CEILING",
    points: [
      "Ceiling in Dry Area: 12mm gypsum board finish with fine texture paint.",
      "Ceiling in Wet Areas: 12mm gypsum board finish with fine texture paint.",
      "",
    ],
  },
  {
    title: "DOOR",
    points: [
      "External door: Supply and installation of Aluminum/PVC Door accessories. 900x2100\nDoor Accessories:\nDoor Lock system: Mortice lockset with cylinder and SS door handles shall be provided for all internal doors and Single cylinder with thumb turn latch shall be provided for internal toilet doors.",
      "Internal/Toilet NFR Door Size: 900/700x2100mm PVC DOOR\nDoor Accessories:\nDoor Lock system: Mortice lockset with cylinder and SS door handles shall be provided for all internal doors and Single cylinder with thumb turn latch shall be provided for internal toilet doors",
      "",
    ],
  },
  {
    title: "WINDOWS",
    points: [
      "External Windows: Powder coated aluminum frame (non-thermal break), with 6mm thick clear glass externally Hinged window (One shutter hinged & other fixed). 900x900.",
      "Exhaust window: Powder coated aluminum frame (non-thermal break), fixed Exhaust window with 6mm thick Single obscure glass. Size: 400x400mm",
      "",
    ],
  },
  {
    title: "ELECTRICAL",
    points: [
      "Electrical Supply: conduits and wiring by National/Du-cab/RR.",
      "Tube light 36w ceiling light by MAX.",
      "",
    ],
  },
];

const MODIFIED_CONTAINER: TechSpecSection[] = [
  {
    title: "BASE STRUCTURE",
    points: [
      "Used / new ISO shipping container (20ft / 40ft, standard or high-cube as ordered).",
      "Container chassis sandblasted (SA2.5) and re-painted: 01 coat zinc primer + 02 coats marine-grade enamel.",
      "Existing container floor reinforced where openings are cut; new C-channel framing welded around all cut-outs.",
      "",
    ],
  },
  {
    title: "FLOOR SYSTEM",
    points: [
      "Original 28mm marine plywood floor retained where intact; damaged sections replaced with 18mm cement board on steel joists.",
      "Floor finish: 1.5mm PVC vinyl sheet (homogeneous) over 12mm cement board overlay.",
      "Underside of container coated with bitumen + 50mm rock-wool insulation under raised floor cavity.",
      "",
    ],
  },
  {
    title: "WALL SYSTEM",
    points: [
      "External: original corrugated container steel skin retained, sanded and painted with 02 coats marine enamel (approved RAL color).",
      "Internal stud wall: 50mm GI C-stud framing with 50mm glass-wool / rock-wool insulation.",
      "Internal lining (dry area): 12.5mm gypsum board with emulsion paint.",
      "Internal lining (wet area): 12mm MR gypsum or 6mm cement board with enamel finish.",
      "Vapor barrier: foil-faced membrane between container skin and insulation.",
    ],
  },
  {
    title: "ROOFING",
    points: [
      "Existing container roof retained, with 50mm rock-wool insulation in concealed ceiling cavity.",
      "Anti-condensation coating applied to underside of container roof.",
      "",
    ],
  },
  {
    title: "CEILING",
    points: [
      "12mm gypsum board suspended ceiling with concealed grid, 50mm thermal insulation above.",
      "",
    ],
  },
  {
    title: "OPENINGS",
    points: [
      "All openings cut with plasma + reinforced with welded RHS frame (50x50x3mm).",
      "Door: 900x2000mm steel security door OR powder-coated aluminum door with 6mm tinted glass.",
      "Windows: powder-coated aluminum sliding 1200x1000mm with 6mm tinted glass + insect screen.",
      "All openings sealed with EPDM gasket + silicone weather seal.",
    ],
  },
  {
    title: "ELECTRICAL",
    points: [
      "32A external IP-65 socket inlet with internal MCB / RCBO consumer unit (ABB / Schneider).",
      "Internal wiring by National / Du-cab in concealed PVC conduit.",
      "LED panel lights 24W, recessed in ceiling.",
      "Split AC point with concealed copper piping and condensate drain.",
    ],
  },
];

const SANDWICH_PANEL: TechSpecSection[] = [
  {
    title: "BASE FRAME",
    points: [
      "Hot-dip galvanized steel base chassis from C-channel 200x80x4mm with cross beams @ 600mm centers.",
      "Corner ISO castings provided for stacking & lifting (4 nos).",
      "Base frame primed with 02 coat zinc-rich primer.",
      "",
    ],
  },
  {
    title: "FLOOR SYSTEM",
    points: [
      "18mm WBP plywood OR 18mm cement board fixed to base frame.",
      "Floor finish: 1.5mm PVC vinyl OR 4mm SPC click-lock flooring.",
      "Underside: bitumen coating + 50mm sandwich-panel underlay.",
      "",
    ],
  },
  {
    title: "WALL SYSTEM",
    points: [
      "EPS / PUR / Rock-wool sandwich panel — 50mm or 75mm thickness as specified.",
      "Skin: 0.5mm pre-painted galvanized steel (PPGI) both sides, RAL approved color.",
      "Panel core: EPS (economy) / PUR-PIR (high thermal) / Rock-wool (fire rated EI-30/EI-60).",
      "Panels joined with tongue-and-groove cam-lock system, sealed with PU foam + silicone.",
      "Internal corner trims: powder-coated aluminum profiles.",
    ],
  },
  {
    title: "ROOFING",
    points: [
      "Roof sandwich panel: 75mm or 100mm with 0.5mm PPGI top + bottom skin.",
      "Slope 3-5° for water runoff.",
      "Ridge cap, gutter and downpipe in matching PPGI color.",
      "",
    ],
  },
  {
    title: "CEILING",
    points: [
      "Underside of roof sandwich panel acts as finished ceiling.",
      "Optional 12mm gypsum suspended ceiling with LED panels.",
      "",
    ],
  },
  {
    title: "DOORS",
    points: [
      "External: insulated steel door 900x2000mm OR powder-coated aluminum framed door with double glazing.",
      "Internal: 35mm sandwich panel sliding/swing door with PVC trim.",
      "",
    ],
  },
  {
    title: "WINDOWS",
    points: [
      "UPVC OR powder-coated aluminum frames, double-glazed 6+9+6mm.",
      "Standard size 1000x1000mm sliding with insect screen.",
      "",
    ],
  },
  {
    title: "ELECTRICAL",
    points: [
      "Pre-wired distribution board with MCBs (ABB / Schneider).",
      "LED ceiling panels 36W, surface mounted.",
      "Switch + socket on every wall (BS standard, MK / Legrand).",
      "Provision for split AC (copper pipe sleeve + drain).",
    ],
  },
];

const ALUMINUM_CLADDING: TechSpecSection[] = [
  {
    title: "BASE FRAME",
    points: [
      "MS I-BEAM 150X75 base + top frame, full perimeter with cross members @ 400mm.",
      "Lifting points (4 nos) welded with 12mm gusset plates.",
      "Base frame: grit blast SA2.5 + 02 coats epoxy zinc primer + 01 coat polyurethane top coat.",
      "",
    ],
  },
  {
    title: "FLOOR SYSTEM",
    points: [
      "MS angle 50x50x3mm joists @ 400mm spacing.",
      "Decking: 18mm cement board + 12mm marine plywood overlay.",
      "Floor finish: 1.5mm PVC vinyl OR 8mm engineered laminate flooring.",
      "Underside bitumen coated with rock-wool insulation 50mm.",
    ],
  },
  {
    title: "WALL SYSTEM",
    points: [
      "Internal wall: 50mm sandwich panel (EPS / rock-wool core) with PPGI skin.",
      "External cladding: 4mm ALUMINUM COMPOSITE PANEL (ACP) — fire-retardant grade (FR / A2). Premium brands: Alpolic / Reynobond / Alubond / ALUCOIL.",
      "Sub-frame: powder-coated aluminum vertical mullions 50x50mm + horizontal 40x40mm @ 600mm grid.",
      "Cavity ventilation: 25mm rear ventilated cavity behind ACP for thermal performance.",
      "Joint detail: open or closed joint with EPDM gasket; corner profiles in matching color.",
    ],
  },
  {
    title: "ROOFING",
    points: [
      "Roof sandwich panel 100mm rock-wool core with PPGI skins.",
      "Optional ACP fascia and parapet cap in matching wall color.",
      "Slope 3-5° to internal/external gutter; PVC downpipe.",
      "",
    ],
  },
  {
    title: "CEILING",
    points: [
      "12mm gypsum board suspended ceiling with concealed grid.",
      "LED recessed panel lights 36W, 600x600mm.",
      "",
    ],
  },
  {
    title: "DOORS",
    points: [
      "External main door: powder-coated aluminum framed with 6mm tempered tinted glass — 1000x2100mm.",
      "Internal doors: powder-coated aluminum or laminated MDF.",
      "",
    ],
  },
  {
    title: "WINDOWS",
    points: [
      "Powder-coated aluminum thermal-break frames, double-glazed 6+12+6mm Low-E glass.",
      "Side-hung or sliding configuration; standard 1500x1200mm.",
      "Insect screen + window blind track included.",
    ],
  },
  {
    title: "ELECTRICAL",
    points: [
      "Concealed conduits within sandwich panel + ceiling void.",
      "Distribution board with MCB / RCBO (Schneider / ABB / Legrand).",
      "LED panel lights, downlights and emergency exit fittings.",
      "Split AC provision with concealed copper + drain.",
    ],
  },
];

export const SPEC_TYPE_OPTIONS: SpecTypeOption[] = [
  { key: "standard_fire_rated", label: "Standard Fire Rated Prefab Cabin", sections: STANDARD_FIRE_RATED },
  { key: "modified_container", label: "Modified Container", sections: MODIFIED_CONTAINER },
  { key: "sandwich_panel", label: "Sandwich Panel Type Container", sections: SANDWICH_PANEL },
  { key: "aluminum_cladding", label: "Aluminum Cladding Type Cabin", sections: ALUMINUM_CLADDING },
];

export const DEFAULT_SPEC_TYPE: SpecTypeKey = "standard_fire_rated";

export const getSpecTemplateSections = (key: SpecTypeKey): TechSpecSection[] =>
  SPEC_TYPE_OPTIONS.find((o) => o.key === key)?.sections ?? STANDARD_FIRE_RATED;

export const getSpecTemplate = (key: SpecTypeKey): string =>
  JSON.stringify(getSpecTemplateSections(key));

export function parseTechSpecs(str: string): TechSpecSection[] {
  if (!str) return getSpecTemplateSections(DEFAULT_SPEC_TYPE);
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as TechSpecSection[];
  } catch {}
  return parsePlainTextSpec(str);
}

function parsePlainTextSpec(text: string): TechSpecSection[] {
  const sections: TechSpecSection[] = [];
  let current: TechSpecSection | null = null;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const pointMatch = trimmed.match(/^[a-z]\.\s*(.*)/i);
    if (pointMatch && current) {
      current.points.push(pointMatch[1] ?? "");
    } else {
      if (current) sections.push(current);
      current = { title: trimmed.toUpperCase(), points: [] };
    }
  }
  if (current) sections.push(current);
  return sections.length > 0 ? sections : getSpecTemplateSections(DEFAULT_SPEC_TYPE);
}

export function serializeTechSpecs(sections: TechSpecSection[]): string {
  return JSON.stringify(sections);
}
