import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#16140F",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 118,
            height: 118,
            display: "flex",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              width: 28,
              height: 28,
              borderTop: "8px solid #C8FF4D",
              borderLeft: "8px solid #C8FF4D",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderTop: "8px solid #C8FF4D",
              borderRight: "8px solid #C8FF4D",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              width: 28,
              height: 28,
              borderBottom: "8px solid #C8FF4D",
              borderLeft: "8px solid #C8FF4D",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              width: 28,
              height: 28,
              borderBottom: "8px solid #C8FF4D",
              borderRight: "8px solid #C8FF4D",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 44,
              left: 18,
              width: 82,
              height: 30,
              border: "8px solid #C8FF4D",
              borderRadius: 40,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 50,
              left: 51,
              width: 16,
              height: 16,
              background: "#C8FF4D",
              borderRadius: 99,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
