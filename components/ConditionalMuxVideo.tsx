// fairfuhrer/components/ConditionalMuxVideo.tsx
"use client";

import React from "react";
import { useCookies } from "../context/CookieContext";

interface ConditionalMuxVideoProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const noticeBoxStyle: React.CSSProperties = {
  padding: "2rem 1.5rem",
  backgroundColor: "#f8f8ff",
  border: "2px solid #18222f",
  boxShadow: "4px 4px 0 #18222f",
  textAlign: "center",
  color: "#18222f",
  fontFamily: "var(--font-fira)",
};

const settingsButtonStyle: React.CSSProperties = {
  marginTop: "0.85rem",
  padding: "0.65rem 1.25rem",
  backgroundColor: "#18222f",
  color: "#fc6c14",
  border: "2px solid #18222f",
  boxShadow: "3px 3px 0 #fc6c14",
  fontFamily: "var(--font-fira)",
  fontSize: "0.88rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  cursor: "pointer",
};

function CookieSettingsButton() {
  const { showSettings } = useCookies();

  return (
    <button
      type="button"
      onClick={showSettings}
      style={settingsButtonStyle}
    >
      Cookie-Einstellungen ändern
    </button>
  );
}

export function ConditionalMuxVideo({
  children,
  fallback,
}: ConditionalMuxVideoProps) {
  const { preferences, hasConsented, showBanner } = useCookies();

  // Podczas pierwszej klatki hydratacji (zanim useEffect w CookieContext odczyta
  // zapisaną zgodę z ciasteczek/localStorage) zarówno hasConsented, jak i showBanner
  // mają wartość false. Renderujemy wtedy cichy placeholder o zachowanym wymiarze,
  // aby u użytkowników z aktywną zgodą nie mrugał komunikat o braku zgody.
  if (!hasConsented && !showBanner) {
    return (
      <div
        style={{
          ...noticeBoxStyle,
          minHeight: "220px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-busy="true"
      />
    );
  }

  if (!hasConsented) {
    return (
      fallback || (
        <div style={noticeBoxStyle}>
          <p style={{ margin: 0 }}>
            Video wird geladen, nachdem Sie den Cookie-Einstellungen zugestimmt
            haben.
          </p>
        </div>
      )
    );
  }

  if (preferences.functional) {
    return <>{children}</>;
  }

  return (
    fallback || (
      <div style={noticeBoxStyle}>
        <p style={{ margin: 0 }}>
          Für die Videowiedergabe müssen funktionale Cookies aktiviert werden.
        </p>
        <CookieSettingsButton />
      </div>
    )
  );
}
