// components/MediaComponents.tsx
"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { getAudioUrl, getOptimizedImagePath } from "../lib/supabase";
import styles from "./MediaComponents.module.css";
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "./AudioIcons";

const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2] as const;
type SpeedOption = (typeof SPEED_OPTIONS)[number];

interface AudioPlayerProps {
  placeId: number;
  filename: string;
  className?: string;
}

interface BaseAudioPlayerProps {
  src: string;
  className?: string;
}

function BaseAudioPlayer({ src, className = "" }: BaseAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, audioRef.current.currentTime - 5);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    const newTime = Math.min(duration, audioRef.current.currentTime + 5);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSpeedChange = (speed: SpeedOption) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`${styles.audioPlayer} ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        preload="metadata"
      />

      <div className={styles.audioControls}>
        <button
          type="button"
          className={styles.skipButton}
          onClick={skipBackward}
          title="5 Sekunden zurück"
        >
          <SkipBackIcon size={32} />
        </button>

        <button
          type="button"
          className={`${styles.playButton} ${isPlaying ? styles.playing : ""}`}
          onClick={togglePlay}
          title={isPlaying ? "Pause" : "Abspielen"}
        >
          {isPlaying ? <PauseIcon size={40} /> : <PlayIcon size={40} />}
        </button>

        <button
          type="button"
          className={styles.skipButton}
          onClick={skipForward}
          title="5 Sekunden vor"
        >
          <SkipForwardIcon size={32} />
        </button>
      </div>

      <div className={styles.progressContainer}>
        <span className={styles.currentTime}>{formatTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className={styles.progressBar}
          aria-label="Audio-Fortschrittsbalken"
          title="Ziehen, um die Position in der Aufnahme zu verschieben"
        />
        <span className={styles.duration}>{formatTime(duration)}</span>
      </div>

      <div className={styles.speedControl}>
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            type="button"
            className={`${styles.speedButton} ${playbackSpeed === speed ? styles.speedButtonActive : ""}`}
            onClick={() => handleSpeedChange(speed)}
            aria-pressed={playbackSpeed === speed}
            title={`Wiedergabegeschwindigkeit: ${speed}x`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}

export function AudioPlayer({
  placeId,
  filename,
  className = "",
}: AudioPlayerProps) {
  const src = getAudioUrl(placeId, filename);
  return <BaseAudioPlayer src={src} className={className} />;
}

// ImageGallery und DirectusImageGallery sind entfallen: das Panel verwendet
// jetzt PlaceGallery, dieselbe Galerie wie die Detailseite. Sie unterschieden
// sich nur in der Bildquelle — galleryUrls() in lib/orte-shared.ts führt beide
// zusammen, statt sich für eine zu entscheiden.

interface PlaceImageProps {
  placeId: number;
  filename: string;
  alt: string;
  type?: "main" | "gallery";
  className?: string;
  width?: number;
  height?: number;
}

export function PlaceImage({
  placeId,
  filename,
  alt,
  type = "main",
  className = "",
  width = 400,
  height = 300,
}: PlaceImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (imageError) return null;

  return (
    <div className={`${styles.imageContainer} ${className}`}>
      {!imageLoaded && <div className={styles.imagePlaceholder}>Laden...</div>}
      <Image
        src={getOptimizedImagePath(placeId, filename, type)} // ✅ ZOPTYMALIZOWANE
        alt={alt}
        className={`${styles.placeImage} ${imageLoaded ? styles.loaded : ""}`}
        width={width}
        height={height}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
        loading={type === "main" ? "eager" : "lazy"}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        priority={type === "main"} // ✅ Priority dla głównych obrazków
      />
    </div>
  );
}

interface DirectusAudioPlayerProps {
  uuid: string;
  className?: string;
}

export function DirectusAudioPlayer({ uuid, className = "" }: DirectusAudioPlayerProps) {
  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL!;
  const src = `${directusUrl}/assets/${uuid}`;
  return <BaseAudioPlayer src={src} className={className} />;
}

interface DirectusImageProps {
  uuid: string;
  alt: string;
  className?: string;
}

export function DirectusImage({
  uuid,
  alt,
  className = "",
}: DirectusImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL!;
  const src = `${directusUrl}/assets/${uuid}`;

  if (imageError) return null;

  return (
    <div className={`${styles.imageContainer} ${className}`}>
      {!imageLoaded && <div className={styles.imagePlaceholder}>Laden...</div>}
      <Image
        src={src}
        alt={alt}
        className={`${styles.placeImage} ${imageLoaded ? styles.loaded : ""}`}
        width={400}
        height={300}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </div>
  );
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface GalleryMixedProps {
  placeId: number;
  items: string[];
  onImageClickAction?: (imagePath: string, index: number) => void;
}

export function GalleryMixed({ placeId, items, onImageClickAction }: GalleryMixedProps) {
  if (!items || items.length === 0) return null;

  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL!;

  return (
    <div className={styles.gallery}>
      {items.map((item, index) => {
        const isUuid = UUID_REGEX.test(item);
        const src = isUuid
          ? `${directusUrl}/assets/${item}`
          : getOptimizedImagePath(placeId, item, "gallery");

        return (
          <div key={index} className={styles.galleryItem}>
            <button
              type="button"
              className={styles.galleryButton}
              onClick={() => onImageClickAction?.(src, index)}
              aria-label={`Bild ${index + 1} powiększ`}
            >
              <Image
                src={src}
                alt={`Bild ${index + 1}`}
                className={styles.galleryImage}
                width={300}
                height={200}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
                sizes="(max-width: 768px) 50vw, 300px"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// EmbeddedMap - usunięte bo nie jest używane
