import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const INK = "#14120e";
const PAPER = "#f4f1ea";
const LIME = "#c8ff4d";
const MUTED = "#6f6a5c";
const CARD = "#fffefb";
const TERM = "#0f0e0b";
const CREAM = "#e7e3d6";
const DIM = "#8d8776";
const HAIR = "#2a2620";

const PIN_MARKDOWN = `# Pinned element
- URL: http://localhost:3000/billing
- Selector (data-testid): [data-testid="save"]
- Tag: button
- Screenshot: ~/.peek/latest.png

\`\`\`html
<button class="primary" type="submit" data-testid="save">Save changes</button>
\`\`\``;

const AGENT_REPLY = `The save label is clipped.
Giving the button min-width so the
text fits.`;

function clamp(frame: number, from: number, to: number, start: number, end: number) {
  return interpolate(frame, [from, to], [start, end], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function typed(text: string, frame: number, from: number, cps: number) {
  const n = Math.floor(clamp(frame, from, from + text.length / cps, 0, text.length));
  return text.slice(0, n);
}

const Cursor: React.FC<{ x: number; y: number; pressed: number }> = ({
  x,
  y,
  pressed,
}) => {
  const scale = 1 - pressed * 0.18;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-2px, -2px) scale(${scale})`,
        zIndex: 40,
      }}
    >
      <svg width="22" height="28" viewBox="0 0 18 24" aria-hidden="true">
        <path
          d="M1.2 1.2 L1.2 18.4 L6.1 14.2 L9.6 22.1 L12.6 20.9 L9.1 13 L15.6 13 Z"
          fill={INK}
          stroke={LIME}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

const Caret: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    style={{
      display: "inline-block",
      width: 7,
      height: 14,
      background: LIME,
      verticalAlign: -2,
      opacity: on ? 1 : 0,
      marginLeft: 1,
    }}
  />
);

export const PeekDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cursorX = clamp(frame, 18, 88, 560, 198);
  const cursorY = clamp(frame, 18, 88, 430, 268);

  const highlight = clamp(frame, 78, 108, 0, 1);
  const click = spring({
    frame: frame - 128,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.4 },
    durationInFrames: 18,
  });
  const pressed = frame >= 128 && frame < 140 ? 1 : 0;
  const pill = spring({
    frame: frame - 138,
    fps,
    config: { damping: 16, stiffness: 140 },
  });
  const fixed = clamp(frame, 385, 420, 0, 1);
  const pasteReveal = clamp(frame, 175, 250, 0, 1);
  const replyText = typed(AGENT_REPLY, frame, 300, 0.9);
  const showReply = frame >= 300;
  const caretOn = frame % 22 < 12;

  const buttonMinWidth = 132 + fixed * 86;
  const buttonPadX = 10 + fixed * 10;

  return (
    <AbsoluteFill style={{ background: "#0a0908", fontFamily: 'ui-monospace, "IBM Plex Mono", Menlo, monospace' }}>
      <AbsoluteFill
        style={{
          inset: 18,
          display: "flex",
          flexDirection: "row",
          border: `1px solid ${HAIR}`,
          background: INK,
        }}
      >
        <div
          style={{
            flex: 1.62,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            borderRight: `1px solid ${HAIR}`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              background: "#1b1815",
              borderBottom: `1px solid ${HAIR}`,
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 99,
                    background: "#3a352c",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                flex: 1,
                background: TERM,
                border: `1px solid ${HAIR}`,
                padding: "5px 10px",
                fontSize: 12,
                color: DIM,
              }}
            >
              localhost:3000/billing
            </div>
          </div>

          <div
            style={{
              flex: 1,
              background: PAPER,
              color: INK,
              position: "relative",
              fontFamily: 'ui-sans-serif, "IBM Plex Sans", Helvetica, sans-serif',
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 22px",
                borderBottom: `1px solid ${INK}`,
                fontFamily: 'ui-monospace, "IBM Plex Mono", Menlo, monospace',
                fontSize: 12,
                letterSpacing: "0.08em",
              }}
            >
              <strong>NORTHWIND</strong>
              <span style={{ color: MUTED }}>billing · team</span>
            </div>

            <div style={{ padding: 22, maxWidth: 420 }}>
              <div
                style={{
                  background: CARD,
                  border: `1px solid ${INK}`,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: MUTED,
                    fontFamily: 'ui-monospace, "IBM Plex Mono", Menlo, monospace',
                    marginBottom: 8,
                  }}
                >
                  Billing
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 650,
                    letterSpacing: "-0.02em",
                    marginBottom: 12,
                  }}
                >
                  Plan details
                </div>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: MUTED,
                    marginBottom: 4,
                  }}
                >
                  Company
                </div>
                <div
                  style={{
                    border: `1px solid ${INK}`,
                    background: PAPER,
                    padding: "7px 10px",
                    fontSize: 14,
                    marginBottom: 10,
                  }}
                >
                  Example Co
                </div>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: MUTED,
                    marginBottom: 4,
                  }}
                >
                  Plan
                </div>
                <div
                  style={{
                    border: `1px solid ${INK}`,
                    background: PAPER,
                    padding: "7px 10px",
                    fontSize: 14,
                    marginBottom: 14,
                  }}
                >
                  Pro — annual
                </div>

                <div style={{ position: "relative", display: "inline-block" }}>
                  <div
                    style={{
                      background: INK,
                      color: LIME,
                      padding: `8px ${buttonPadX}px`,
                      minWidth: buttonMinWidth,
                      fontSize: 14,
                      fontFamily: 'ui-sans-serif, "IBM Plex Sans", Helvetica, sans-serif',
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      boxShadow: `0 0 0 ${2 + click * 4}px ${LIME}${Math.round(highlight * 70).toString(16).padStart(2, "0")}`,
                    }}
                  >
                    Save changes
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      inset: -3,
                      border: `1.5px solid ${LIME}`,
                      background: "rgba(200, 255, 77, 0.18)",
                      opacity: highlight,
                      pointerEvents: "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: -22,
                      background: INK,
                      color: LIME,
                      fontSize: 11,
                      padding: "3px 6px",
                      fontFamily: 'ui-monospace, "IBM Plex Mono", Menlo, monospace',
                      opacity: highlight,
                      whiteSpace: "nowrap",
                    }}
                  >
                    [data-testid=&quot;save&quot;]
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 16,
                    width: 210,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    border: `1px dashed ${INK}`,
                    padding: "7px 8px",
                    fontSize: 12,
                    color: MUTED,
                    opacity: 1 - fixed * 0.35,
                  }}
                >
                  The monthly invoice preview overflows this box on purpose.
                </div>
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                right: 14,
                bottom: 14,
                width: 188,
                background: INK,
                border: `1px solid ${INK}`,
                padding: 10,
                color: LIME,
                fontFamily: 'ui-monospace, "IBM Plex Mono", Menlo, monospace',
                boxShadow: "5px 5px 0 rgba(200,255,77,0.22)",
                opacity: Math.min(1, pill),
                transform: `translateY(${(1 - Math.min(1, pill)) * 10}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: DIM,
                  marginBottom: 8,
                }}
              >
                Pinned
              </div>
              <div
                style={{
                  display: "inline-flex",
                  border: `1px solid ${LIME}`,
                  padding: "3px 6px",
                  fontSize: 11,
                  maxWidth: "100%",
                }}
              >
                button.primary
              </div>
            </div>

            <Cursor x={cursorX} y={cursorY} pressed={pressed} />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            background: TERM,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            color: CREAM,
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: 8,
              background: "#151310",
              borderBottom: `1px solid ${HAIR}`,
              fontSize: 11,
              color: DIM,
              letterSpacing: "0.08em",
            }}
          >
            zsh — agent
          </div>
          <div
            style={{
              flex: 1,
              padding: "14px 16px",
              fontSize: 12.5,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <span style={{ color: LIME, fontWeight: 500 }}>~/northwind ❯ </span>
            {pasteReveal < 0.02 ? (
              <Caret on={caretOn} />
            ) : (
              <>
                <span>look at this</span>
                {"\n\n"}
                <div
                  style={{
                    maxHeight: pasteReveal * 240,
                    overflow: "hidden",
                    color: LIME,
                  }}
                >
                  {PIN_MARKDOWN}
                </div>
                {showReply ? (
                  <>
                    {"\n"}
                    <span style={{ color: DIM }}>{replyText}</span>
                    {replyText.length < AGENT_REPLY.length ? (
                      <Caret on={caretOn} />
                    ) : null}
                  </>
                ) : (
                  <>
                    {"\n"}
                    <Caret on={caretOn && pasteReveal > 0.95} />
                  </>
                )}
                {fixed > 0.8 ? (
                  <>
                    {"\n\n"}
                    <span style={{ color: LIME }}>✓ button.primary min-width</span>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
