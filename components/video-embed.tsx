"use client";

import { useEffect, useRef, useState } from "react";

interface VideoEmbedProps {
  sourceUrl: string;
}

export function VideoEmbed({ sourceUrl }: VideoEmbedProps) {
  const [showFallback, setShowFallback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Set a 10s timeout for the embed to load
    timerRef.current = setTimeout(() => {
      setShowFallback(true);
    }, 10_000);

    // Load TikTok embed script
    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;

    script.onload = () => {
      // Give the embed a moment to render after script loads
      const checkInterval = setInterval(() => {
        if (containerRef.current) {
          const iframe = containerRef.current.querySelector("iframe");
          if (iframe) {
            if (timerRef.current) clearTimeout(timerRef.current);
            clearInterval(checkInterval);
            setShowFallback(false);
          }
        }
      }, 500);

      // Stop checking after 10s regardless
      setTimeout(() => clearInterval(checkInterval), 10_000);
    };

    script.onerror = () => {
      setShowFallback(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    document.body.appendChild(script);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Clean up script if still in DOM
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  if (showFallback) {
    return (
      <div className="w-full rounded-lg bg-gray-100 p-6 text-center">
        <p className="text-gray-600 mb-3">
          The TikTok embed could not be loaded.
        </p>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-gray-800 transition-colors"
        >
          Watch on TikTok
        </a>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <blockquote
        className="tiktok-embed"
        cite={sourceUrl}
        data-video-id={extractVideoId(sourceUrl)}
        style={{ maxWidth: "100%" }}
      >
        <section>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Watch on TikTok
          </a>
        </section>
      </blockquote>
    </div>
  );
}

function extractVideoId(url: string): string {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : "";
}
