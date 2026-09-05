"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { Camera, Paperclip, X } from "lucide-react";
import { validateProofFile } from "@miniros/contracts";
import { Button } from "@/components/ui/button";

export function ProofUpload({
  label,
  file,
  onChange,
  photoOnly = false,
  required = false,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  photoOnly?: boolean;
  required?: boolean;
}) {
  const id = useId();
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    if (!file?.type.startsWith("image/")) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function select(file: File | undefined) {
    if (!file) return;
    const failure = validateProofFile(file, photoOnly);
    setError(failure ?? undefined);
    if (!failure) onChange(file);
  }
  return (
    <div className="space-y-2" role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="text-sm font-medium">
        {label} ({required ? "required" : "optional"})
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => upload.current?.click()}
        >
          <Paperclip aria-hidden="true" />
          {file ? "Replace file" : "Upload image"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => camera.current?.click()}
        >
          <Camera aria-hidden="true" />
          Take photo
        </Button>
      </div>
      <input
        ref={upload}
        className="sr-only"
        type="file"
        aria-label={`Upload ${label}`}
        accept={`image/jpeg,image/png,image/webp${photoOnly ? "" : ",application/pdf"}`}
        onChange={(event) => {
          select(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={camera}
        className="sr-only"
        type="file"
        aria-label={`Take ${label}`}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => {
          select(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {preview ? (
        <Image
          src={preview}
          alt={`${label} preview`}
          width={320}
          height={180}
          unoptimized
          className="max-h-40 w-full rounded-lg border object-contain"
        />
      ) : null}
      {file ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${label}`}
            onClick={() => {
              onChange(null);
              setError(undefined);
            }}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, WebP{photoOnly ? "" : " or PDF"} · Up to 3.5 MB
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
