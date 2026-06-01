"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const SPLINE_LOAD_MSG = "apple-juice-spline-loaded";

type LazySplineProps = {
  sceneUrl: string;
  className?: string;
  /** Optional static poster (blurred) — defaults to CSS mesh */
  posterSrc?: string;
};

/**
 * Defers Spline iframe injection until near-viewport, shows a lightweight
 * placeholder until the viewer fires its internal load event (postMessage).
 */
export function LazySpline({ sceneUrl, className = "", posterSrc }: LazySplineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [shouldMount, setShouldMount] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldMount(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onSplineMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type !== SPLINE_LOAD_MSG) return;
    if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    window.addEventListener("message", onSplineMessage);
    return () => window.removeEventListener("message", onSplineMessage);
  }, [onSplineMessage]);

  const escapedUrl = sceneUrl.replace(/"/g, "&quot;");
  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}
spline-viewer{width:100%;height:100%;display:block;opacity:0;transition:opacity .45s ease}
spline-viewer.ready{opacity:1}
</style><script type="module" src="https://unpkg.com/@splinetool/viewer@1.12.94/build/spline-viewer.js"><\/script></head><body>
<spline-viewer url="${escapedUrl}" events-target="none"></spline-viewer>
<script>
(function(){
  var v=document.querySelector('spline-viewer');
  if(!v)return;
  function notify(){ v.classList.add('ready'); parent.postMessage({type:'${SPLINE_LOAD_MSG}'},'*'); }
  v.addEventListener('load',notify);
  if(v.loaded) notify();
  else setTimeout(function(){ if(!v.classList.contains('ready')) notify(); },12000);
})();
<\/script></body></html>`;

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Lightweight placeholder — no iframe until intersecting */}
      <div
        className="absolute inset-0 transition-opacity duration-500 ease-out"
        style={{ opacity: isLoaded ? 0 : 1, pointerEvents: isLoaded ? "none" : "auto" }}
        aria-hidden={isLoaded}
      >
        {posterSrc ? (
          <img
            src={posterSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover scale-105 blur-2xl saturate-150 opacity-70"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className="absolute inset-0 scale-110 blur-3xl opacity-80"
            style={{
              background: `
                radial-gradient(ellipse 70% 60% at 30% 40%, rgba(204,255,0,0.18), transparent 55%),
                radial-gradient(ellipse 60% 50% at 75% 55%, rgba(139,92,246,0.22), transparent 50%),
                radial-gradient(ellipse 50% 45% at 50% 80%, rgba(59,130,246,0.15), transparent 55%),
                linear-gradient(160deg, #0a0a10 0%, #12121a 45%, #08080d 100%)
              `,
            }}
          />
        )}
        <div className="absolute inset-0 bg-[#050508]/40 backdrop-blur-md" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-9 w-9 rounded-full border border-white/10 border-t-white/40 animate-spin" />
        </div>
      </div>

      {shouldMount ? (
        <iframe
          ref={iframeRef}
          title="3D scene"
          srcDoc={srcDoc}
          loading="lazy"
          className="absolute inset-0 h-full w-full border-0 bg-transparent pointer-events-none select-none transition-opacity duration-500"
          style={{
            opacity: isLoaded ? 1 : 0,
            willChange: isLoaded ? "auto" : "opacity",
          }}
        />
      ) : null}
    </div>
  );
}
