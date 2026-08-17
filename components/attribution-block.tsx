"use client";

import { BadgeCheck } from "lucide-react";

interface AttributionBlockProps {
  creatorHandle: string;
  creatorProfileUrl: string;
  creatorDisplayName?: string | null;
}

export function AttributionBlock({
  creatorHandle,
  creatorProfileUrl,
  creatorDisplayName,
}: AttributionBlockProps) {
  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold text-sm">
          {creatorHandle.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col">
          {creatorDisplayName && (
            <span className="text-sm font-semibold text-white flex items-center gap-1.5">
              {creatorDisplayName}
              <BadgeCheck className="w-4 h-4 text-purple-400" />
            </span>
          )}
          <a
            href={creatorProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            @{creatorHandle}
          </a>
        </div>
      </div>
    </div>
  );
}
