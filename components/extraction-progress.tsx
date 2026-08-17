"use client";

import { useEffect, useRef, useState } from "react";
import type { ExtractionStage, ExtractionStatus } from "@/lib/types";

interface ExtractionProgressProps {
  jobId: string;
  onComplete: (recipeId: string) => void;
  onError: (message: string) => void;
}

interface JobStatus {
  status: ExtractionStatus;
  currentStage: ExtractionStage | null;
  resultRecipeId: string | null;
  error: {
    code: string;
    message: string;
    strategiesAttempted?: Array<{
      strategy: string;
      success: boolean;
      durationMs: number;
      error?: string;
    }>;
  } | null;
}

const STAGES: { key: ExtractionStage; label: string }[] = [
  { key: "cache_lookup", label: "Cache Lookup" },
  { key: "oembed", label: "oEmbed" },
  { key: "caption_parse", label: "Caption Parse" },
  { key: "native_captions", label: "Native Captions" },
  { key: "asr", label: "ASR Transcription" },
  { key: "llm_parse", label: "LLM Parse" },
  { key: "complete", label: "Complete" },
];

function getStageIndex(stage: ExtractionStage | null): number {
  if (!stage) return -1;
  return STAGES.findIndex((s) => s.key === stage);
}

export function ExtractionProgress({
  jobId,
  onComplete,
  onError,
}: ExtractionProgressProps) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/extraction/status/${jobId}`);
        if (!res.ok) {
          if (res.status === 401) {
            setPollError("Session expired. Please sign in again.");
            return;
          }
          setPollError("Failed to fetch extraction status.");
          return;
        }

        const data: JobStatus = await res.json();
        if (cancelled) return;

        setJobStatus(data);
        setPollError(null);

        if (data.status === "completed" && data.resultRecipeId) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onComplete(data.resultRecipeId);
        } else if (data.status === "failed") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          const msg =
            data.error?.message ?? "Extraction failed. Please try again.";
          onError(msg);
        } else if (data.status === "timed_out") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onError(
            "Extraction timed out. The video may be too long or unavailable."
          );
        }
      } catch {
        if (!cancelled) {
          setPollError("Network error. Retrying...");
        }
      }
    }

    // Poll immediately, then every 5 seconds
    poll();
    intervalRef.current = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId, onComplete, onError]);

  const currentStageIndex = getStageIndex(jobStatus?.currentStage ?? null);

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">
        Extracting Recipe...
      </h3>

      {pollError && (
        <p className="mb-4 text-sm text-amber-600" role="alert">
          {pollError}
        </p>
      )}

      <div className="space-y-3">
        {STAGES.map((stage, index) => {
          let stageState: "completed" | "active" | "pending";
          if (index < currentStageIndex) {
            stageState = "completed";
          } else if (index === currentStageIndex) {
            stageState =
              jobStatus?.status === "completed" ? "completed" : "active";
          } else {
            stageState = "pending";
          }

          return (
            <div key={stage.key} className="flex items-center gap-3">
              <StageIndicator state={stageState} />
              <span
                className={`text-sm ${
                  stageState === "completed"
                    ? "text-green-700 font-medium"
                    : stageState === "active"
                      ? "text-purple-700 font-medium"
                      : "text-gray-400"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {jobStatus?.status === "failed" && jobStatus.error && (
        <div className="mt-4 rounded-md bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">
            {jobStatus.error.message}
          </p>
          {jobStatus.error.strategiesAttempted &&
            jobStatus.error.strategiesAttempted.length > 0 && (
              <ul className="mt-2 text-xs text-red-600 space-y-1">
                {jobStatus.error.strategiesAttempted.map((attempt, i) => (
                  <li key={i}>
                    {attempt.strategy}:{" "}
                    {attempt.error ?? (attempt.success ? "success" : "failed")} (
                    {attempt.durationMs}ms)
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}

      {jobStatus?.status === "timed_out" && (
        <div className="mt-4 rounded-md bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">
            Extraction timed out. The video may be too long or unavailable.
            Please try again later.
          </p>
        </div>
      )}
    </div>
  );
}

function StageIndicator({ state }: { state: "completed" | "active" | "pending" }) {
  if (state === "completed") {
    return (
      <svg
        className="h-5 w-5 text-green-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-label="Completed"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
        />
      </svg>
    );
  }

  if (state === "active") {
    return (
      <svg
        className="h-5 w-5 animate-spin text-purple-600"
        viewBox="0 0 24 24"
        fill="none"
        aria-label="In progress"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );
  }

  return (
    <div
      className="h-5 w-5 rounded-full border-2 border-gray-300"
      aria-label="Pending"
    />
  );
}
