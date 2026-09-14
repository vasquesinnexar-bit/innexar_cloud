import { ImageResponse } from "next/og";

export function createServiceOgImage(title: string, subtitle: string, path: string) {
  return function Image() {
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
            background:
              "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                fontSize: 28,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "4px",
                textTransform: "uppercase" as const,
              }}
            >
              Innexar
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                background:
                  "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)",
                backgroundClip: "text",
                color: "transparent",
                textAlign: "center",
                maxWidth: 900,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 24,
                color: "rgba(255,255,255,0.7)",
                textAlign: "center",
                maxWidth: 700,
              }}
            >
              {subtitle}
            </div>
            <div
              style={{
                fontSize: 18,
                color: "rgba(255,255,255,0.4)",
                marginTop: 8,
              }}
            >
              innexar.com.br{path}
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  };
}
