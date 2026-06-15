'use client';

import { useCallback, useState, useRef } from 'react';
import { useUploadThing } from '@/utils/uploadthing';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface UploadedFile {
  name: string;
  status: 'uploading' | 'indexing' | 'done' | 'error';
  error?: string;
}

interface KnowledgeUploadProps {
  chatbotId: string;
  pageCount: number;
  pageLimit: number;
  onIndexed: () => void;
}

/**
 * KnowledgeUpload Component
 * 
 * Handles multi-file uploads (PDF, TXT, MD) and coordinates with the backend
 * to trigger semantic indexing (embedding generation).
 * 
 * Process:
 * 1. User drops/selects files
 * 2. Component validates file types and workspace limits
 * 3. Files are uploaded to cloud storage via UploadThing
 * 4. On success, the backend is notified to pull the file and start vector indexing
 * 5. Component tracks and displays per-file progress (Uploading -> Indexing -> Done)
 */
export default function KnowledgeUpload({
  chatbotId,
  pageCount,
  pageLimit,
  onIndexed,
}: KnowledgeUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Calculate if the chatbot has reached its knowledge source limit
  const atLimit = pageCount >= pageLimit;

  /**
   * Helper to notify the Express backend to begin indexing a cloud-hosted file.
   */
  const indexOnBackend = useCallback(
    async (fileUrl: string, fileName: string, mimeType: string) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/api/chatbots/${chatbotId}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileUrl, fileName, mimeType }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to queue document');
      }
    },
    [chatbotId]
  );

  // Initialize the UploadThing hook
  const { startUpload, isUploading } = useUploadThing('knowledgeUploader', {
    onClientUploadComplete: async (uploaded) => {
      // 3. Once cloud upload finishes, we start the backend indexing phase
      for (const file of uploaded) {
        setFiles(prev =>
          prev.map(f =>
            f.name === file.name ? { ...f, status: 'indexing' as const } : f
          )
        );
        try {
          // Tell backend to process the new file URL
          await indexOnBackend(file.url, file.name, file.type || 'application/octet-stream');
          
          setFiles(prev =>
            prev.map(f =>
              f.name === file.name ? { ...f, status: 'done' as const } : f
            )
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Indexing failed';
          setFiles(prev =>
            prev.map(f =>
              f.name === file.name ? { ...f, status: 'error' as const, error: message } : f
            )
          );
        }
      }
      // Refresh parent data (page lists, stats)
      onIndexed();
    },
    onUploadError: (error) => {
      console.error('[Upload] Cloud upload failed:', error.message);
      setFiles(prev =>
        prev.map(f =>
          f.status === 'uploading'
            ? { ...f, status: 'error' as const, error: `Cloud: ${error.message}` }
            : f
        )
      );
    },
  });

  /**
   * Validates and prepares files for upload.
   */
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    
    if (atLimit) {
      alert(`Knowledge limit reached (${pageLimit} sources). Please remove existing sources first.`);
      return;
    }

    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    const toUpload: File[] = [];

    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const valid =
        allowed.includes(file.type) ||
        ['pdf', 'txt', 'md', 'markdown'].includes(ext || '');

      if (valid) {
        toUpload.push(file);
      } else {
        console.warn(`[Upload] Skipping unsupported file type: ${file.name}`);
      }
    }

    if (!toUpload.length) {
      alert('No valid files selected. Please use PDF, TXT, or Markdown.');
      return;
    }

    // Update local state to show "Uploading..." for selected files
    setFiles(prev => [
      ...toUpload.map(f => ({ name: f.name, status: 'uploading' as const })),
      ...prev,
    ]);

    // Start the actual upload process
    await startUpload(toUpload);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const usagePercent = Math.min((pageCount / pageLimit) * 100, 100);
  const isNearLimit = usagePercent >= 80;

  return (
    <div className="space-y-4 animate-fade-up">
      {/* 1. Knowledge Capacity Meter */}
      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.03] animate-grid-pulse pointer-events-none" />
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[12px] font-medium text-[var(--text-secondary)]">Knowledge capacity</p>
            <p className="text-[20px] font-semibold text-[var(--text)] tabular-nums mt-0.5">
              {pageCount}
              <span className="text-[14px] font-normal text-[var(--text-muted)]"> / {pageLimit}</span>
            </p>
          </div>
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              isNearLimit
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {isNearLimit ? 'Near limit' : 'Available'}
          </div>
        </div>
        <div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isNearLimit ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      {/* 2. Interactive Drop Zone */}
      <div
        onDragOver={e => {
          e.preventDefault();
          if (!atLimit) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !atLimit && inputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 group overflow-hidden ${
          atLimit
            ? 'border-[var(--border)] opacity-50 cursor-not-allowed'
            : isDragging
              ? 'border-[var(--text)] bg-[var(--surface-hover)] scale-[1.01] shadow-lg shadow-white/5'
              : 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)]/50'
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div
          className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 ${
            isDragging ? 'scale-110 animate-float' : 'group-hover:scale-105'
          } bg-[var(--surface)] border border-[var(--border)]`}
        >
          <svg className="w-6 h-6 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-[14px] font-medium text-[var(--text)]">
          {atLimit ? 'Page limit reached' : 'Drop files here or click to browse'}
        </p>
        <p className="text-[12px] text-[var(--text-muted)] mt-1">
          PDF, TXT, Markdown — up to 32MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.markdown,text/plain,text/markdown,application/pdf"
          className="hidden"
          disabled={atLimit}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* 3. Live Progress Feed */}
      {(files.length > 0 || isUploading) && (
        <div className="space-y-2 animate-scale-in">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="shrink-0">
                {file.status === 'uploading' && (
                  <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--text)] rounded-full animate-spin" />
                )}
                {file.status === 'indexing' && (
                  <div className="w-5 h-5 relative">
                    <div className="absolute inset-0 rounded-full border-2 border-blue-400/30" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 animate-spin" />
                  </div>
                )}
                {file.status === 'done' && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center animate-scale-in">
                    <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {file.status === 'error' && (
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[var(--text)] truncate">{file.name}</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {file.status === 'uploading' && 'Uploading to cloud…'}
                  {file.status === 'indexing' && 'Extracting text & building vectors…'}
                  {file.status === 'done' && 'Indexed successfully'}
                  {file.status === 'error' && (file.error || 'Failed')}
                </p>
              </div>
              {/* Animated wave bars for the indexing phase */}
              {file.status === 'indexing' && (
                <div className="flex gap-0.5">
                  {[0, 1, 2].map(j => (
                    <div
                      key={j}
                      className="w-1 h-3 rounded-full bg-blue-400 audio-wave-bar"
                      style={{ animationDelay: `${j * 0.15}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
