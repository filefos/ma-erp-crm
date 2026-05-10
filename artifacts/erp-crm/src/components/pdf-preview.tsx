import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPreviewProps {
  apiUrl: string;
  width?: number;
  className?: string;
}

export function PdfPreview({ apiUrl, width = 560, className }: PdfPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [fetchError, setFetchError] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const token = localStorage.getItem("erp_token") ?? "";

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setFetchError(false);
    setRenderError(false);
    setBlobUrl(null);
    setPage(1);
    setNumPages(0);

    fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setFetchError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiUrl, token]);

  if (fetchError || renderError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-xs text-muted-foreground bg-muted/20">
        <span>PDF preview unavailable.</span>
        <a
          href={`${apiUrl}?token=${encodeURIComponent(token)}`}
          target="_blank"
          rel="noreferrer"
          className="text-[#1e6ab0] hover:underline"
        >
          Open in new tab
        </a>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground bg-muted/20">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading preview…
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="overflow-auto bg-muted/20 flex justify-center p-2">
        <Document
          file={blobUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          onLoadError={() => setRenderError(true)}
          loading={
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Rendering…
            </div>
          }
        >
          <Page
            pageNumber={page}
            width={width}
            renderAnnotationLayer={true}
            renderTextLayer={true}
          />
        </Document>
      </div>
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span>Page {page} of {numPages}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={page >= numPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
