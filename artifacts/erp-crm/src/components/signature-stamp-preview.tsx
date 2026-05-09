import { PenLine, Stamp } from "lucide-react";

interface SignatureStampPreviewProps {
  signatureUrl?: string;
  stampUrl?: string;
  /**
   * Max width of each image as a percentage of the document page width.
   * Mirrors the `stampWidthPct` option in print-to-pdf.ts (default 30).
   */
  stampWidthPct?: number | null;
}

/**
 * Renders a small "Document Preview" panel showing how the signature and
 * stamp will appear at the bottom of the downloaded PDF.
 *
 * Layout matches the PDF stamping logic in print-to-pdf.ts:
 *   – Both present → signature at ~35% width, stamp at ~65% width.
 *   – Only one → centred.
 *   – stampWidthPct controls relative max-width of each image (default 30%).
 * Hidden during printing via the .no-print class.
 */
export function SignatureStampPreview({
  signatureUrl,
  stampUrl,
  stampWidthPct,
}: SignatureStampPreviewProps) {
  const hasSig = !!signatureUrl;
  const hasStamp = !!stampUrl;
  const hasBoth = hasSig && hasStamp;

  // Mirror the relative size from print-to-pdf.ts.
  // Default stamp width in the PDF is 30% of page width.
  // We translate that proportionally into a max-width for each preview image.
  const widthPct = stampWidthPct != null ? stampWidthPct : 30;
  // PDF uses widthFraction for both sig and stamp; scale to the preview container.
  // The preview box is ~100% of the card content width, so we use widthPct directly.
  const imgMaxWidth = `${Math.min(widthPct * 2, 90)}%`;

  return (
    <div className="no-print rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4 space-y-2">
      <div className="flex items-center gap-1.5">
        <PenLine className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Document Preview — Signature &amp; Stamp
        </span>
      </div>

      {!hasSig && !hasStamp ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-muted-foreground/60">
          <div className="flex gap-3">
            <PenLine className="w-5 h-5" />
            <Stamp className="w-5 h-5" />
          </div>
          <p className="text-xs text-center">
            No signature or stamp configured. Upload your signature on the{" "}
            <a href="/profile#signature" className="underline underline-offset-2 text-[#1e6ab0]">
              Profile page
            </a>{" "}
            to see a preview here.
          </p>
        </div>
      ) : (
        <div className="relative flex items-end bg-white border border-gray-100 rounded-md overflow-hidden min-h-[80px] px-4 py-3">
          {/* Mimics the bottom-of-document stamp area */}
          <div
            className={`w-full flex items-end gap-4 ${
              hasBoth ? "justify-between" : "justify-center"
            }`}
          >
            {hasSig && (
              <div
                className="flex flex-col items-center gap-1"
                style={{ width: hasBoth ? "42%" : "44%" }}
              >
                <img
                  src={signatureUrl}
                  alt="Signature"
                  style={{ maxHeight: 64, maxWidth: imgMaxWidth, opacity: 0.85, objectFit: "contain" }}
                />
                <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">
                  Signature
                </span>
              </div>
            )}

            {hasStamp && (
              <div
                className="flex flex-col items-center gap-1"
                style={{ width: hasBoth ? "42%" : "44%" }}
              >
                <img
                  src={stampUrl}
                  alt="Company Stamp"
                  style={{ maxHeight: 64, maxWidth: imgMaxWidth, opacity: 0.85, objectFit: "contain" }}
                />
                <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">
                  Company Stamp
                </span>
              </div>
            )}
          </div>

          <span className="absolute bottom-1.5 right-3 text-[9px] text-muted-foreground/40 italic">
            as it appears in the PDF
          </span>
        </div>
      )}
    </div>
  );
}
