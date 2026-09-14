import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Planos e Preços | Innexar";
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
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            Innexar
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "white",
              textAlign: "center",
            }}
          >
            Planos e Preços
          </div>
          <div
            style={{
              display: "flex",
              gap: "24px",
              marginTop: 20,
            }}
          >
            {["R$ 299/mês", "R$ 499/mês", "R$ 799/mês"].map((price) => (
              <div
                key={price}
                style={{
                  padding: "12px 24px",
                  borderRadius: 12,
                  background: "rgba(99, 102, 241, 0.2)",
                  border: "1px solid rgba(99, 102, 241, 0.4)",
                  color: "#a78bfa",
                  fontSize: 22,
                  fontWeight: 600,
                }}
              >
                {price}
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.4)",
              marginTop: 8,
            }}
          >
            innexar.com.br/planos
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
