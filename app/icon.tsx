import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

/** Esfera de marca para favicon, pestañas y resultados de búsqueda. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0a0a0a",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at 30% 24%, #ffffff 0%, #7ef4ff 8%, #00e5ff 25%, #6366f1 58%, #7c3aed 82%, #32106e 100%)",
            border: "2px solid rgba(255,255,255,0.75)",
            borderRadius: "999px",
            boxShadow: "0 0 12px rgba(0,229,255,0.75), 0 0 18px rgba(124,58,237,0.7)",
            display: "flex",
            height: "46px",
            width: "46px",
          }}
        />
      </div>
    ),
    size
  );
}
