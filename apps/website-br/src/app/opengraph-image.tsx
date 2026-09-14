import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Innexar — Agência Digital";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-2px",
            }}
          >
            Innexar
          </div>
          <div
            style={{
              fontSize: 32,
              color: "rgba(255,255,255,0.8)",
              textAlign: "center",
              maxWidth: 800,
            }}
          >
            Sites, Apps e IA para seu Negócio
          </div>
          <div
            style={{
              fontSize: 20,
              color: "rgba(255,255,255,0.5)",
              marginTop: 12,
            }}
          >
            innexar.com.br
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
