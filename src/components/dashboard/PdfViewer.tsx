"use client";

import { useMemo, useState } from "react";

interface PdfViewerProps {
  projectId: string;
  filePath: string;
}

function fileName(filePath: string): string {
  return filePath.split("/").filter(Boolean).pop() || filePath || "PDF";
}

export default function PdfViewer({ projectId, filePath }: PdfViewerProps) {
  const [version, setVersion] = useState(0);
  const src = useMemo(() => {
    const query = new URLSearchParams({ path: filePath, v: String(version) });
    return `/api/projects/${projectId}/files/view?${query.toString()}`;
  }, [filePath, projectId, version]);
  const downloadHref = useMemo(() => {
    const query = new URLSearchParams({ path: filePath });
    return `/api/projects/${projectId}/files/download?${query.toString()}`;
  }, [filePath, projectId]);

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-neutral-950">
      <div className="flex min-h-10 items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-3 text-xs">
        <span className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-semibold text-red-200">
          PDF
        </span>
        <span className="min-w-0 flex-1 truncate text-neutral-200">
          {fileName(filePath)}
        </span>
        <button
          type="button"
          onClick={() => setVersion((value) => value + 1)}
          className="rounded border border-neutral-700 px-2 py-1 text-neutral-300 hover:bg-neutral-800"
        >
          Reload
        </button>
        <a
          href={downloadHref}
          className="rounded border border-neutral-700 px-2 py-1 text-neutral-300 hover:bg-neutral-800"
        >
          Download
        </a>
      </div>
      <iframe
        key={src}
        src={src}
        title={fileName(filePath)}
        className="min-h-0 flex-1 bg-neutral-900"
      />
    </div>
  );
}
