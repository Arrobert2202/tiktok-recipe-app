"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Film, Check, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/use-language";

interface VideoDropzoneProps {
  onTranscriptReady: (transcript: string) => void;
  disabled?: boolean;
}

export function VideoDropzone({ onTranscriptReady, disabled }: VideoDropzoneProps) {
  const { t } = useLanguage();
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "transcribing" | "done" | "error">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    // Matches MAX_UPLOAD_BYTES in app/api/transcribe/route.ts — Vercel caps
    // route handler request bodies at ~4.5MB, well under the 25MB Whisper
    // itself accepts.
    if (file.size > 4 * 1024 * 1024) {
      setError(t("recipeView.dropzone.tooLarge"));
      setStatus("error");
      return;
    }

    setFileName(file.name);
    setError(null);
    setStatus("transcribing");

    try {
      const formData = new FormData();
      formData.append("video", file);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("recipeView.dropzone.transcriptionFailed"));
      }

      const { transcript } = await res.json();
      setStatus("done");
      onTranscriptReady(transcript);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : t("recipeView.dropzone.uploadFailed"));
    }
  }, [onTranscriptReady, t]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-4"
    >
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed transition-all p-6 text-center cursor-pointer ${
          isDragOver
            ? "border-purple-500/60 bg-purple-500/10"
            : status === "done"
              ? "border-green-500/40 bg-green-500/5"
              : status === "error"
                ? "border-red-500/40 bg-red-500/5"
                : "border-white/10 bg-white/5 hover:border-white/20"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input
          type="file"
          accept="video/mp4,video/webm,video/mpeg,audio/mpeg,audio/mp4,audio/wav"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled || status === "transcribing"}
          aria-label={t("recipeView.dropzone.uploadAria")}
        />

        {status === "idle" && (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-white/30" />
            <p className="text-sm text-white/50">
              <span className="text-purple-400 font-medium">
                {t("recipeView.dropzone.uploadVideo")}
              </span>{" "}
              {t("recipeView.dropzone.forBetterAccuracy")}
            </p>
            <p className="text-xs text-white/30">{t("recipeView.dropzone.hint")}</p>
          </div>
        )}

        {status === "transcribing" && (
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            <p className="text-sm text-white/70">{t("recipeView.dropzone.transcribing")}</p>
          </div>
        )}

        {status === "done" && (
          <div className="flex items-center justify-center gap-3">
            <Check className="w-5 h-5 text-green-400" />
            <p className="text-sm text-green-400 font-medium">
              {t("recipeView.dropzone.transcribedWithFile", { fileName: fileName ?? "" })}
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-2">
            <Film className="w-6 h-6 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <p className="text-xs text-white/30">{t("recipeView.dropzone.tryAgainHint")}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
