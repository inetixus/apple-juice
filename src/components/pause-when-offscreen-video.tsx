"use client";

import {
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

type PauseWhenOffscreenVideoProps = React.VideoHTMLAttributes<HTMLVideoElement> & {
  /** Element whose intersection gates playback (e.g. `#pricing` section). */
  observeRef?: RefObject<Element | null>;
  /** IntersectionObserver threshold (fraction visible). */
  visibilityThreshold?: number;
  /** IO rootMargin — keep tight so playback does not start on unrelated sections. */
  visibilityRootMargin?: string;
};

/** Plays only while `observeRef` (or self) is in view; pauses off-screen. */
export function PauseWhenOffscreenVideo({
  className,
  style,
  observeRef,
  visibilityThreshold = 0.12,
  visibilityRootMargin = "0px",
  ...props
}: PauseWhenOffscreenVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isVisible) return;
    void video.play().catch(() => {});
  }, [isVisible]);

  useLayoutEffect(() => {
    const target = observeRef?.current ?? videoRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: visibilityThreshold, rootMargin: visibilityRootMargin },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [observeRef, visibilityThreshold, visibilityRootMargin]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!isVisible) {
      video.pause();
      return;
    }
    tryPlay();
  }, [isVisible, tryPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onCanPlay = () => tryPlay();
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadeddata", onCanPlay);
    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadeddata", onCanPlay);
    };
  }, [tryPlay]);

  return (
    <video
      ref={videoRef}
      className={className}
      style={style}
      muted
      playsInline
      loop
      preload="metadata"
      {...props}
    />
  );
}
