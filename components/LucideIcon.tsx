// components/LucideIcon.tsx
// Rendert ein Lucide-Icon anhand seines Namens (kebab-case, wie im Directus
// gespeichert, z.B. "map-pin"). Nur die tatsächlich verwendeten Icons werden
// importiert — kein dynamischer Import, voll RSC-kompatibel.

import {
  AudioLines,
  BadgeCheck,
  Binoculars,
  Compass,
  Euro,
  Heart,
  Images,
  Leaf,
  MapPin,
  Mic,
  Search,
  Send,
  Shield,
  Sparkles,
  Users,
  type LucideIcon as LucideIconType,
} from "lucide-react";

// Directus liefert kebab-case Namen (lucide.dev/icons). Hier auf die
// PascalCase-Komponenten mappen. Neue Icons einfach oben importieren + eintragen.
//
// Der Partner-Abschnitt der Startseite speichert die Namen in PascalCase,
// weil dort ein Auswahlfeld mit festen Werten steht. Deshalb unten eine
// Normalisierung: beide Schreibweisen finden dasselbe Symbol.
const ICON_MAP: Record<string, LucideIconType> = {
  binoculars: Binoculars,
  send: Send,
  search: Search,
  "map-pin": MapPin,
  leaf: Leaf,
  users: Users,
  heart: Heart,
  "audio-lines": AudioLines,
  mic: Mic,
  images: Images,
  "badge-check": BadgeCheck,
  compass: Compass,
  shield: Shield,
  euro: Euro,
};

// "AudioLines" und "audio-lines" sollen dasselbe Symbol finden.
function toKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

interface LucideIconProps {
  name?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  "aria-hidden"?: boolean;
}

export default function LucideIcon({
  name,
  size = 24,
  strokeWidth = 1.75,
  color,
  className,
  "aria-hidden": ariaHidden = true,
}: LucideIconProps) {
  // Unbekannter/leerer Name → neutrales Fallback-Icon, damit das Layout hält.
  const Icon = (name && ICON_MAP[toKebab(name)]) || Sparkles;
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      className={className}
      aria-hidden={ariaHidden}
    />
  );
}
