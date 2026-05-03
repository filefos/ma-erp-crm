import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

  const totalSlices = Math.max(1, Math.ceil(canvas.height / sliceHeightPx));
  for (let i = 0; i < totalSlices; i++) {
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.min(sliceHeightPx, canvas.height - i * sliceHeightPx);
    const ctx = sliceCanvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create slice canvas context");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0, i * sliceHeightPx, sliceCanvas.width, sliceCanvas.height,
      0, 0, sliceCanvas.width, sliceCanvas.height,
    );
    const dataUrl = sliceCanvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage();
    const sliceHeightPt = sliceCanvas.height / ratio;
    pdf.addImage(dataUrl, "JPEG", 0, 0, imgWidth, sliceHeightPt, undefined, "FAST");
  }

  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.split(",")[1] ?? "";
  return { base64, filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf` };
}
