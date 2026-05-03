import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

// Walk upward from `targetY` looking for a horizontal row whose pixels are all
// (near-)white, so we don't slice through a line of text. Returns the original
// targetY if no clean break is found inside the search window.
function findSafeCutY(canvas: HTMLCanvasElement, targetY: number, windowPx: number): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return targetY;
  const startY = Math.max(0, targetY - windowPx);
  const h = targetY - startY;
  if (h <= 0) return targetY;
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, startY, canvas.width, h).data;
  } catch {
    // Tainted canvas (cross-origin image without CORS) — fall back to hard cut.
    return targetY;
  }
  // Sample every 4th pixel horizontally for speed; threshold tuned for
  // anti-aliased serif text on white.
  const step = 4;
  const whiteThreshold = 245;
  for (let y = h - 1; y >= 0; y--) {
    let rowOk = true;
    const rowStart = y * canvas.width * 4;
    for (let x = 0; x < canvas.width; x += step) {
      const i = rowStart + x * 4;
      if (data[i] < whiteThreshold || data[i + 1] < whiteThreshold || data[i + 2] < whiteThreshold) {
        rowOk = false;
        break;
      }
    }
    if (rowOk) return startY + y;
  }
  return targetY;
}

export async function captureElementToPdfBase64(el: HTMLElement, filename: string): Promise<{ base64: string; filename: string }> {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const ratio = canvas.width / imgWidth;
  const sliceHeightPx = Math.floor(pageHeight * ratio);
  // Search window for a clean cut, ~10% of a page in canvas pixels.
  const cutWindowPx = Math.floor(sliceHeightPx * 0.1);

  let y = 0;
  let pageIndex = 0;
  while (y < canvas.height) {
    let endY = Math.min(y + sliceHeightPx, canvas.height);
    if (endY < canvas.height) {
      const safeEnd = findSafeCutY(canvas, endY, cutWindowPx);
      // Only take the safe cut if it actually advances; otherwise fall back to
      // the hard cut so we never produce an empty/looping slice.
      if (safeEnd > y + sliceHeightPx * 0.5) endY = safeEnd;
    }
    const sliceH = endY - y;
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create slice canvas context");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0, y, sliceCanvas.width, sliceH,
      0, 0, sliceCanvas.width, sliceH,
    );
    const dataUrl = sliceCanvas.toDataURL("image/jpeg", 0.92);
    if (pageIndex > 0) pdf.addPage();
    const sliceHeightPt = sliceH / ratio;
    pdf.addImage(dataUrl, "JPEG", 0, 0, imgWidth, sliceHeightPt, undefined, "FAST");
    pageIndex++;
    y = endY;
  }

  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.split(",")[1] ?? "";
  return { base64, filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf` };
}
