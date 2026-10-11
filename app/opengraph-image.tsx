import { ImageResponse } from "next/og";

export const alt = "DUGOUT 사회인야구 통합 기록";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#f3f0e7",
        color: "#132425",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(120deg, #f7f4ec 0%, #f7f4ec 58%, #dfe8e1 100%)" }} />
      <div style={{ position: "absolute", width: 520, height: 520, border: "2px solid #bfd0c7", borderRadius: "50%", right: -80, top: 54, display: "flex" }} />
      <div style={{ position: "absolute", width: 380, height: 380, border: "2px solid #cad8d1", borderRadius: "50%", right: -10, top: 124, display: "flex" }} />
      <div style={{ position: "absolute", width: 270, height: 270, background: "#163532", transform: "rotate(45deg)", right: 92, top: 180, borderRadius: 30, display: "flex", boxShadow: "0 24px 70px rgba(19,36,37,.2)" }} />
      <div style={{ position: "absolute", width: 118, height: 118, background: "#f3f0e7", transform: "rotate(45deg)", right: 168, top: 256, borderRadius: 16, display: "flex" }} />
      <div style={{ position: "absolute", width: 46, height: 46, background: "#ff6040", transform: "rotate(45deg)", right: 204, top: 292, borderRadius: 8, display: "flex" }} />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 78px", width: 760 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#159d80", fontSize: 20, fontWeight: 700, letterSpacing: 3 }}>
          <span style={{ width: 42, height: 5, borderRadius: 10, background: "#ff6040", display: "flex" }} />
          SOCIAL BASEBALL RECORDS
        </div>
        <div style={{ display: "flex", fontSize: 96, lineHeight: 1, fontWeight: 900, letterSpacing: -5, marginTop: 28 }}>DUGOUT</div>
        <div style={{ display: "flex", fontSize: 31, fontWeight: 700, marginTop: 22, letterSpacing: 1 }}>INTEGRATED BASEBALL RECORDS</div>
        <div style={{ display: "flex", fontSize: 21, color: "#61716d", marginTop: 17 }}>SUNBALL · RED PONIES</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 17, color: "#71807c", marginTop: 48 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#20b894", display: "flex" }} />
          PLAYER STATS · TEAM RANKINGS · FOUR SOURCES
        </div>
      </div>
    </div>,
    size,
  );
}
