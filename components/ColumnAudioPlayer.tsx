"use client";

// components/ColumnAudioPlayer.tsx
//
// Audioguide für die linke Spalte der Audiopin-Seite. Er sitzt dort im
// farbigen Bereich der Kategorie und soll sich einfügen statt aufzufallen:
// keine eigene Fläche, kein Rahmen, keine Glasoptik — nur Knöpfe,
// Fortschritt und Zeiten in Weiß.
//
// Eigene Umsetzung statt der MediaComponents: die bringen Kartenoptik mit,
// die hier gerade nicht gewollt ist.
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ColumnAudioPlayer.module.css";

interface ColumnAudioPlayerProps {
  src: string;
  /** Für Screenreader: um welchen Ort es geht. */
  title: string;
}

const SPEEDS = [1, 1.25, 1.5] as const;
const SKIP_SECONDS = 10;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ColumnAudioPlayer({
  src,
  title,
}: ColumnAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.min(Math.max(0, seconds), el.duration || 0);
  }, []);

  const skip = useCallback(
    (delta: number) => seekTo((audioRef.current?.currentTime ?? 0) + delta),
    [seekTo],
  );

  const cycleSpeed = useCallback(() => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  }, [speedIndex]);

  // Leertaste und Pfeiltasten steuern den Guide — aber nur, wenn der Fokus
  // nicht in einem Eingabefeld steht.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.code === "ArrowLeft") {
        skip(-SKIP_SECONDS);
      } else if (e.code === "ArrowRight") {
        skip(SKIP_SECONDS);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, skip]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.player}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.skip}
          onClick={() => skip(-SKIP_SECONDS)}
          aria-label={`${SKIP_SECONDS} Sekunden zurück`}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M12.5 8V5l-5 4 5 4v-3a5 5 0 1 1-5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          className={styles.play}
          onClick={toggle}
          aria-label={
            playing
              ? `Audioguide pausieren: ${title}`
              : `Audioguide abspielen: ${title}`
          }
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" fill="currentColor" />
              <rect x="14" y="5" width="4" height="14" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              {/* Leicht nach rechts versetzt, damit das Dreieck im Kreis
                  optisch mittig sitzt. */}
              <polygon points="8,4 20,12 8,20" fill="currentColor" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={styles.skip}
          onClick={() => skip(SKIP_SECONDS)}
          aria-label={`${SKIP_SECONDS} Sekunden vor`}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M11.5 8V5l5 4-5 4v-3a5 5 0 1 0 5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className={styles.progressRow}>
        <span className={styles.time}>{formatTime(currentTime)}</span>
        <input
          type="range"
          className={styles.slider}
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => seekTo(Number(e.target.value))}
          aria-label="Position im Audioguide"
          style={{ "--progress": `${progress}%` } as React.CSSProperties}
        />
        <span className={styles.time}>{formatTime(duration)}</span>
      </div>

      <button
        type="button"
        className={styles.speed}
        onClick={cycleSpeed}
        aria-label={`Abspielgeschwindigkeit: ${SPEEDS[speedIndex]}-fach`}
      >
        {SPEEDS[speedIndex]}×
      </button>
    </div>
  );
}
