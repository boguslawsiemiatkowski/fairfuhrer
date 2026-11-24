// ✅ Server-only protection - prevents accidental client-side imports
import "server-only";

export interface PayPalConfig {
  client_id: string;
  client_secret: string;
  mode: "sandbox" | "production";
}

const requiredEnvVars = {
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
  PAYPAL_MODE: process.env.PAYPAL_MODE,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`❌ Missing environment variable: ${key}`);
    console.error(
      "Available PayPal env vars:",
      Object.keys(process.env).filter((k) => k.startsWith("PAYPAL"))
    );
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const paypalConfig: PayPalConfig = {
  client_id: process.env.PAYPAL_CLIENT_ID!,
  client_secret: process.env.PAYPAL_CLIENT_SECRET!,
  mode: (process.env.PAYPAL_MODE as "sandbox" | "production") || "sandbox",
};
