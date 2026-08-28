import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "STRIDE — Correr es la excusa para socializar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

/** Tarjeta social sobria, renderizada en HTML/CSS por Next.js. */
export default async function OpenGraphImage() {
  const logoData = await readFile(join(process.cwd(), "public", "stride_logo_clean.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#080808",
          color: "#ffffff",
          display: "flex",
          height: "100%",
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at 32% 28%, #d9fbff 0%, #00e5ff 16%, #6366f1 48%, #7c3aed 72%, #16072f 100%)",
            border: "2px solid rgba(255,255,255,0.7)",
            borderRadius: 999,
            boxShadow: "0 0 75px rgba(99,102,241,0.35)",
            display: "flex",
            height: 270,
            position: "absolute",
            right: 105,
            top: 180,
            width: 270,
          }}
        />

        <div
          style={{
            background: "linear-gradient(90deg, #00e5ff, #6366f1, #7c3aed)",
            bottom: 0,
            display: "flex",
            height: 8,
            left: 0,
            position: "absolute",
            right: 0,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 72px 74px",
            position: "relative",
            width: 790,
          }}
        >
          <img
            alt="STRIDE"
            height="86"
            src={logoSrc}
            style={{ objectFit: "contain", objectPosition: "left center", width: 250 }}
            width="250"
          />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                background: "linear-gradient(90deg, #00e5ff, #6366f1, #7c3aed)",
                display: "flex",
                height: 4,
                marginBottom: 28,
                width: 74,
              }}
            />
            <div
              style={{
                display: "flex",
                fontFamily: "sans-serif",
                fontSize: 66,
                fontWeight: 750,
                letterSpacing: "-2.5px",
                lineHeight: 1.04,
                maxWidth: 680,
              }}
            >
              Correr es la excusa para socializar.
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
