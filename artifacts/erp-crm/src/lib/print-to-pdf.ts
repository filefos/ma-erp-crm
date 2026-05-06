import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

// Walk upward from `targetY` looking for the lowest horizontal row whose
// pixels are all (near-)white inside the search window. Returns the original
// targetY if no clean break is found, or the canvas is tainted.
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
    return targetY;
  }
  const step = 2;
  const whiteThreshold = 248;
  // Walk from the bottom of the window up — first clean row wins, so we get
  // the cut closest to the page boundary (largest possible page).
  for (let y = h - 1; y >= 0; y--) {
    let rowOk = true;
    const rowOffset = y * canvas.width * 4;
    for (let x = 0; x < canvas.width; x += step) {
      const i = rowOffset + x * 4;
      if (data[i] < whiteThreshold || data[i + 1] < whiteThreshold || data[i + 2] < whiteThreshold) {
        rowOk = false;
        break;
      }
    }
    if (rowOk) return startY + y;
  }
  return targetY;
}

// Find the last row of the canvas that contains any non-white pixels. Used
// to trim trailing whitespace so a fixed-height A4 element with internal
// padding doesn't render as a blank second PDF page.
function findLastContentY(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.height;
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return canvas.height;
  }
  const step = 4;
  const whiteThreshold = 248;
  for (let y = canvas.height - 1; y >= 0; y--) {
    const rowOffset = y * canvas.width * 4;
    for (let x = 0; x < canvas.width; x += step) {
      const i = rowOffset + x * 4;
      if (data[i] < whiteThreshold || data[i + 1] < whiteThreshold || data[i + 2] < whiteThreshold) {
        return y + 1;
      }
    }
  }
  return canvas.height;
}

export async function captureElementToPdfBase64(el: HTMLElement, filename: string): Promise<{ base64: string; filename: string }> {
  const rawCanvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  // Trim trailing whitespace from the rendered canvas. Without this an A4
  // element with bottom padding can render a near-blank second page.
  const lastY = findLastContentY(rawCanvas);
  let canvas: HTMLCanvasElement = rawCanvas;
  if (lastY > 0 && lastY < rawCanvas.height) {
    const trimmed = document.createElement("canvas");
    trimmed.width = rawCanvas.width;
    trimmed.height = lastY;
    const tctx = trimmed.getContext("2d");
    if (tctx) {
      tctx.fillStyle = "#ffffff";
      tctx.fillRect(0, 0, trimmed.width, trimmed.height);
      tctx.drawImage(rawCanvas, 0, 0, rawCanvas.width, lastY, 0, 0, rawCanvas.width, lastY);
      canvas = trimmed;
    }
  }

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const ratio = canvas.width / imgWidth;
  const sliceHeightPx = Math.floor(pageHeight * ratio);
  // If content fits in a single page (with up to 2% slack), render it as one
  // page scaled exactly to its height — no slicing, no risk of blank pages.
  if (canvas.height <= sliceHeightPx * 1.02) {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const drawHeight = Math.min(pageHeight, canvas.height / ratio);
    pdf.addImage(dataUrl, "JPEG", 0, 0, imgWidth, drawHeight, undefined, "FAST");
    const dataUri = pdf.output("datauristring");
    const base64 = dataUri.split(",")[1] ?? "";
    return { base64, filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf` };
  }
  // Search up to 35% of a page above the target boundary for a clean cut.
  // A wider window means we almost always find whitespace rather than slicing
  // through text, even on dense pages like the offer letter rules list.
  const cutWindowPx = Math.floor(sliceHeightPx * 0.35);
  // Minimum advance per page so we never produce zero-height slices or get
  // stuck in a loop. 5% of a page is enough to make forward progress while
  // still allowing very short final pages.
  const minAdvancePx = Math.floor(sliceHeightPx * 0.05);

  let y = 0;
  let pageIndex = 0;
  while (y < canvas.height) {
    let endY = Math.min(y + sliceHeightPx, canvas.height);
    if (endY < canvas.height) {
      const safeEnd = findSafeCutY(canvas, endY, cutWindowPx);
      // Accept any safe cut that meaningfully advances. We prefer a slightly
      // shorter page over a hard cut through text.
      if (safeEnd > y + minAdvancePx) endY = safeEnd;
    }
    const sliceH = endY - y;
    if (sliceH <= 0) break;
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
