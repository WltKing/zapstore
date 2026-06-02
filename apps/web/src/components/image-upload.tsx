"use client";

import { useRef, useState } from "react";

/** Campo de imagem com upload nativo (envia pro /api/upload e devolve a URL). */
export function ImageUpload({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no upload.");
      onChange(data.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700">{label}</label>
      <div className="mt-1 flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-14 w-14 rounded-lg object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            disabled={uploading}
            className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-800"
          />
          {uploading && <p className="mt-1 text-xs text-neutral-500">Enviando...</p>}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          {value && !uploading && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="mt-1 text-xs text-neutral-500 hover:text-red-600"
            >
              Remover
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
