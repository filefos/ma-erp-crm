export type SpecTypeKey =
  | "standard_fire_rated"
  | "modified_container"
  | "sandwich_panel"
  | "aluminum_cladding";

export interface SpecTypeOption {
  key: SpecTypeKey;
  label: string;
  template: string;
}

const STANDARD_FIRE_RATED = `STANDARD FIRE RATED PREFAB CABIN — TECHNICAL SPECIFICATION

BASE FRAME
a. Steel base & top frame from MS I-BEAM 120X64, full perimeter beams with central runner and cross members.
b. Lifting eyes provided at intermediate points at the base, welded and painted with 01 coat red oxide primer and 01 coat matt enamel.
c. Base frame painted with 02 coat system (red oxide + rust-free enamel).

FLOOR SYSTEM
a. Floor frame from MS angle 50X50X2.7MM welded into base & top frame (400mm joist spacing). Grit blasted SA2.5 + 02 coat epoxy paint.
b. Floor decking: 18mm cement board, fixed to base & floor frame. Underside coated with bitumen paint.
c. Floor finish (dry area): 1.5mm PVC vinyl sheet (good brand).
d. Floor finish (wet area): 1.5mm PVC vinyl sheet.

WALL SYSTEM (FIRE RATED)
a. External finish: 06mm cement board with heavy texture paint (approved color). Joints covered with 6mm CFB strips.
b. Internal finish (dry area): 12.5mm FIRE-RATED gypsum board with emulsion paint. MDF 50mm / PVC 75mm skirting.
c. Internal finish (wet area): 12mm MR fire-rated gypsum board on cold-formed steel framing. MDF 5cm skirting at joints.
d. Wall framing: LGS GI studs 70x35x0.45 @ 610mm vertical / 1200mm horizontal spacing.
e. Wall insulation: 50mm ROCK-WOOL (non-combustible) 60kg/m³ density — 60 minute fire rating.
f. Paint: dry area emulsion (off-white, National). Wet area enamel (white, National).

ROOFING
a. Roof covering: 0.5mm GI corrugated steel on 0.5mm furry channel purlins.
b. Trusses: MS angle 40x40x2.7mm.

CEILING
a. Dry & wet areas: 12mm fire-rated gypsum board with fine texture paint.

DOORS
a. External door: Aluminum / PVC 900x2100mm. Mortice lockset + cylinder + SS handles.
b. Internal / toilet door: 900 / 700 x 2100mm PVC. Single cylinder thumb-turn for toilets.

WINDOWS
a. External windows: powder-coated aluminum (non-thermal break), 6mm clear glass, hinged 900x900mm.
b. Exhaust window: 400x400mm fixed obscure 6mm glass, powder-coated aluminum.

ELECTRICAL
a. Conduits & wiring by National / Du-cab / RR.
b. 36W LED ceiling tube light by MAX.

FIRE SAFETY (STANDARD)
a. Smoke detector and break-glass call point at entrance.
b. ABC dry powder fire extinguisher (6 kg) provided as standard.
c. Emergency exit signage above each door.`;

const MODIFIED_CONTAINER = `MODIFIED ISO CONTAINER CABIN — TECHNICAL SPECIFICATION

BASE STRUCTURE
a. Used / new ISO shipping container (20ft / 40ft, standard or high-cube as ordered).
b. Container chassis sandblasted (SA2.5) and re-painted: 01 coat zinc primer + 02 coats marine-grade enamel.
c. Existing container floor reinforced where openings are cut; new C-channel framing welded around all cut-outs.

FLOOR SYSTEM
a. Original 28mm marine plywood floor retained where intact; damaged sections replaced with 18mm cement board on steel joists.
b. Floor finish: 1.5mm PVC vinyl sheet (homogeneous) over 12mm cement board overlay.
c. Underside of container coated with bitumen + 50mm rock-wool insulation under raised floor cavity.

WALL SYSTEM
a. External: original corrugated container steel skin retained, sanded and painted with 02 coats marine enamel (approved RAL color).
b. Internal stud wall: 50mm GI C-stud framing with 50mm glass-wool / rock-wool insulation.
c. Internal lining (dry area): 12.5mm gypsum board with emulsion paint.
d. Internal lining (wet area): 12mm MR gypsum or 6mm cement board with enamel finish.
e. Vapor barrier: foil-faced membrane between container skin and insulation.

ROOFING
a. Existing container roof retained, with 50mm rock-wool insulation in concealed ceiling cavity.
b. Anti-condensation coating applied to underside of container roof.

CEILING
a. 12mm gypsum board suspended ceiling with concealed grid, 50mm thermal insulation above.

OPENINGS (CUT INTO CONTAINER)
a. All openings cut with plasma + reinforced with welded RHS frame (50x50x3mm).
b. Door: 900x2000mm steel security door OR powder-coated aluminum door with 6mm tinted glass.
c. Windows: powder-coated aluminum sliding 1200x1000mm with 6mm tinted glass + insect screen.
d. All openings sealed with EPDM gasket + silicone weather seal.

ELECTRICAL
a. 32A external IP-65 socket inlet with internal MCB / RCBO consumer unit (ABB / Schneider).
b. Internal wiring by National / Du-cab in concealed PVC conduit.
c. LED panel lights 24W, recessed in ceiling.
d. Split AC point with concealed copper piping and condensate drain.

PLUMBING (IF APPLICABLE)
a. PPR hot/cold water lines, concealed in wall cavity.
b. PVC waste lines with floor traps; external GI drain stub.

FINISHING
a. External: 02 coats marine enamel (approved color) over zinc primer.
b. Optional cladding upgrade available (see Aluminum Cladding spec).`;

const SANDWICH_PANEL = `SANDWICH PANEL TYPE CONTAINER / CABIN — TECHNICAL SPECIFICATION

BASE FRAME
a. Hot-dip galvanized steel base chassis from C-channel 200x80x4mm with cross beams @ 600mm centers.
b. Corner ISO castings provided for stacking & lifting (4 nos).
c. Base frame primed with 02 coat zinc-rich primer.

FLOOR SYSTEM
a. 18mm WBP plywood OR 18mm cement board fixed to base frame.
b. Floor finish: 1.5mm PVC vinyl OR 4mm SPC click-lock flooring.
c. Underside: bitumen coating + 50mm sandwich-panel underlay.

WALL SYSTEM (SANDWICH PANEL)
a. EPS / PUR / Rock-wool sandwich panel — 50mm or 75mm thickness as specified.
b. Skin: 0.5mm pre-painted galvanized steel (PPGI) both sides, RAL approved color.
c. Panel core options:
   - EPS (Expanded Polystyrene) — 14 kg/m³ — economy.
   - PUR / PIR (Polyurethane) — 40 kg/m³ — high thermal performance.
   - Rock-wool — 100 kg/m³ — fire rating EI-30 / EI-60.
d. Panels joined with tongue-and-groove cam-lock system, sealed with PU foam + silicone.
e. Internal corner trims: powder-coated aluminum profiles.

ROOFING
a. Roof sandwich panel: 75mm or 100mm with 0.5mm PPGI top + bottom skin.
b. Slope 3-5° for water runoff.
c. Ridge cap, gutter and downpipe in matching PPGI color.

CEILING
a. Underside of roof sandwich panel acts as finished ceiling.
b. Optional 12mm gypsum suspended ceiling with LED panels.

DOORS
a. External: insulated steel door 900x2000mm OR powder-coated aluminum framed door with double glazing.
b. Internal: 35mm sandwich panel sliding/swing door with PVC trim.

WINDOWS
a. UPVC OR powder-coated aluminum frames, double-glazed 6+9+6mm.
b. Standard size 1000x1000mm sliding with insect screen.

ELECTRICAL
a. Pre-wired distribution board with MCBs (ABB / Schneider).
b. LED ceiling panels 36W, surface mounted.
c. Switch + socket on every wall (BS standard, MK / Legrand).
d. Provision for split AC (copper pipe sleeve + drain).

THERMAL & ACOUSTIC
a. U-value: ≤ 0.4 W/m²K (with 75mm PUR core).
b. Sound reduction: Rw ≥ 25 dB (50mm panel).

ASSEMBLY
a. Flat-pack ready — 01 x 40ft container can ship up to 4 units.
b. Site assembly time: ~4 hours per unit for skilled team of 4.`;

const ALUMINUM_CLADDING = `ALUMINUM CLADDING TYPE PREFAB CABIN — TECHNICAL SPECIFICATION

BASE FRAME
a. MS I-BEAM 150X75 base + top frame, full perimeter with cross members @ 400mm.
b. Lifting points (4 nos) welded with 12mm gusset plates.
c. Base frame: grit blast SA2.5 + 02 coats epoxy zinc primer + 01 coat polyurethane top coat.

FLOOR SYSTEM
a. MS angle 50x50x3mm joists @ 400mm spacing.
b. Decking: 18mm cement board + 12mm marine plywood overlay.
c. Floor finish: 1.5mm PVC vinyl OR 8mm engineered laminate flooring.
d. Underside bitumen coated with rock-wool insulation 50mm.

WALL SYSTEM
a. Internal wall: 50mm sandwich panel (EPS / rock-wool core) with PPGI skin.
b. External cladding: 4mm ALUMINUM COMPOSITE PANEL (ACP) — fire-retardant grade (FR / A2).
   - Premium brands: Alpolic / Reynobond / Alubond / ALUCOIL.
   - Standard color from manufacturer chart; custom RAL on request.
c. Sub-frame: powder-coated aluminum vertical mullions 50x50mm + horizontal 40x40mm @ 600mm grid.
d. Cavity ventilation: 25mm rear ventilated cavity behind ACP for thermal performance.
e. Joint detail: open or closed joint with EPDM gasket; corner profiles in matching color.

ROOFING
a. Roof sandwich panel 100mm rock-wool core with PPGI skins.
b. Optional ACP fascia and parapet cap in matching wall color.
c. Slope 3-5° to internal/external gutter; PVC downpipe.

CEILING
a. 12mm gypsum board suspended ceiling with concealed grid.
b. LED recessed panel lights 36W, 600x600mm.

DOORS
a. External main door: powder-coated aluminum framed with 6mm tempered tinted glass — 1000x2100mm.
b. Internal doors: powder-coated aluminum or laminated MDF.

WINDOWS
a. Powder-coated aluminum thermal-break frames, double-glazed 6+12+6mm Low-E glass.
b. Side-hung or sliding configuration; standard 1500x1200mm.
c. Insect screen + window blind track included.

ELECTRICAL
a. Concealed conduits within sandwich panel + ceiling void.
b. Distribution board with MCB / RCBO (Schneider / ABB / Legrand).
c. LED panel lights, downlights and emergency exit fittings.
d. Split AC provision with concealed copper + drain.

EXTERIOR FEATURES
a. ACP fascia signage band ready for customer logo.
b. Optional uplighters / wall washers integrated into ACP joints.
c. External powder-coated aluminum canopy at entrance (1500x900mm) included.

THERMAL PERFORMANCE
a. U-value ≤ 0.35 W/m²K with rock-wool core + ventilated cavity.
b. Recommended for premium offices, sales kiosks, security cabins, executive site offices.`;

export const SPEC_TYPE_OPTIONS: SpecTypeOption[] = [
  { key: "standard_fire_rated", label: "Standard Fire Rated Prefab Cabin", template: STANDARD_FIRE_RATED },
  { key: "modified_container", label: "Modified Container", template: MODIFIED_CONTAINER },
  { key: "sandwich_panel", label: "Sandwich Panel Type Container", template: SANDWICH_PANEL },
  { key: "aluminum_cladding", label: "Aluminum Cladding Type Cabin", template: ALUMINUM_CLADDING },
];

export const DEFAULT_SPEC_TYPE: SpecTypeKey = "standard_fire_rated";

export const getSpecTemplate = (key: SpecTypeKey): string => {
  return SPEC_TYPE_OPTIONS.find((o) => o.key === key)?.template ?? STANDARD_FIRE_RATED;
};
