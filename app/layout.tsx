import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import Script from "next/script";
import "../styles/reset.css";
import "../styles/ios-safari-fixes.css";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ScrollToTop from "../components/ScrollToTop";
import { PayPalProvider } from "../components/PayPalProvider";
import { CookieProvider } from "../context/CookieContext";
import { AuthProvider } from "../context/AuthContext";
import CookieBanner from "../components/CookieBanner";
import AppPromoModal from "../components/AppPromoModal";
import { WebVitals } from "./_components/web-vitals";
import { AnalyticsTracker } from "./_components/analytics-tracker";
import { anton, firaSansCondensed } from "./fonts";
import { Suspense } from "react";

// Environment Variables
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID ?? null;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fairfuehrer.guide"),
  title: {
    default: "FAIRFÜHRER",
    template: "%s | FAIRFÜHRER",
  },
  description:
    "Der Reiseführer für nachhaltiges Leben & Reisen Am Bodensee Und Im Allgäu",
  keywords: [
    "nachhaltiges reisen",
    "Bodensee",
    "Allgäu",
    "öko tourismus",
    "nachhaltiger tourismus",
    "umweltfreundlich reisen",
    "Bayern",
    "Baden-Württemberg",
  ],
  authors: [{ name: "Seenergien GmbH" }],
  creator: "Bogusław Siemiątkowski",
  publisher: "Seenergien GmbH",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" data-scroll-behavior="smooth">
      <body
        className={`
          ${anton.variable}
          ${firaSansCondensed.variable}
        `}
      >
        {/* GA Consent Mode - domyślnie denied, zaktualizowane po zgodzie użytkownika */}
        <Script
          id="ga-consent-default"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                functionality_storage: 'denied',
                personalization_storage: 'denied',
                wait_for_update: 2000
              });
            `,
          }}
        />
        <CookieProvider>
          {/* Web Vitals monitoring - sends Core Web Vitals to Google Analytics */}
          <WebVitals />

          {/* SPA pageview tracking for client-side navigation */}
          {GA_MEASUREMENT_ID && (
            <Suspense fallback={null}>
              <AnalyticsTracker gaId={GA_MEASUREMENT_ID} />
            </Suspense>
          )}

          <AuthProvider>
            <PayPalProvider>
              <Header />
              <main>{children}</main>
              <Footer />
              <ScrollToTop />
            </PayPalProvider>
          </AuthProvider>

          <CookieBanner />

          {/* App-Hinweis für Tablet/Mobile - läuft erst an,
              wenn der Cookie-Banner weg ist. */}
          <AppPromoModal />
        </CookieProvider>

        {/* Structured Data für Organisation */}
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "FairFührer Guide",
              description: "Der Reiseführer für nachhaltiges Leben & Reisen",
              url: "https://www.fairfuehrer.guide",
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer service",
                availableLanguage: "German",
              },
            }),
          }}
        />

        {/* Enhanced viewport height fix for iPhone Safari */}
        <Script
          id="viewport-fix"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              function setRealViewportHeight() {
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', vh + 'px');
              }
              
              // Initial set
              setRealViewportHeight();
              
              // Enhanced event listeners for iPhone Safari
              window.addEventListener('resize', setRealViewportHeight);
              window.addEventListener('orientationchange', function() {
                setTimeout(setRealViewportHeight, 100);
              });
              
              // Additional iPhone Safari specific events
              window.addEventListener('load', setRealViewportHeight);
              if (window.screen && window.screen.orientation) {
                window.screen.orientation.addEventListener('change', function() {
                  setTimeout(setRealViewportHeight, 150);
                });
              }
            `,
          }}
        />

        {/* iPhone Safari audio context enabler */}
        <Script
          id="ios-audio-fix"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // Enable audio context on iOS after user interaction
              function enableIOSAudio() {
                try {
                  const AudioContext = window.AudioContext || window.webkitAudioContext;
                  if (AudioContext) {
                    const audioContext = new AudioContext();
                    if (audioContext.state === 'suspended') {
                      audioContext.resume();
                    }
                  }
                } catch (e) {
                  console.log('Audio context not available');
                }
              }
              
              const events = ['touchstart', 'touchend', 'mousedown', 'keydown'];
              const onFirstInteraction = () => {
                enableIOSAudio();
                events.forEach(event => {
                  document.removeEventListener(event, onFirstInteraction);
                });
              };
              
              events.forEach(event => {
                document.addEventListener(event, onFirstInteraction, { once: true });
              });
            `,
          }}
        />
      </body>
      {GA_MEASUREMENT_ID && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
    </html>
  );
}
