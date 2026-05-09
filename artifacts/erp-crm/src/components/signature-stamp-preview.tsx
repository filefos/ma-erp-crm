import { PenLine, Stamp } from "lucide-react";

interface SignatureStampPreviewProps {
  signatureUrl?: string;
  stampUrl?: string;
  stampWidthPct?: number | null;
}

export function SignatureStampPreview({
  signatureUrl,
  stampUrl,
}: SignatureStampPreviewProps) {
  const hasSig = !!signatureUrl;
  const hasStamp = !!stampUrl;

  if (!hasSig && !hasStamp) return null;

  return (
    <div className="no-print flex gap-4">
      {/* Signature slot */}
      <div className="flex-1 flex flex-col items-center justify-end gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 py-3 px-4 min-h-[80px]">
        {hasSig ? (
          <img
            src={signatureUrl}
            alt="Signature"
            className="max-h-14 max-w-[160px] object-contain opacity-85"
          />
        ) : (
          <PenLine className="w-6 h-6 text-gray-300" />
        )}
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          Signature
        </span>
      </div>

      {/* Stamp slot */}
      <div className="flex-1 flex flex-col items-center justify-end gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 py-3 px-4 min-h-[80px]">
        {hasStamp ? (
          <img
            src={stampUrl}
            alt="Company Stamp"
            className="max-h-14 max-w-[160px] object-contain opacity-85"
          />
        ) : (
          <Stamp className="w-6 h-6 text-gray-300" />
        )}
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          Stamp
        </span>
      </div>
    </div>
  );
}
