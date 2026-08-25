"use client";

import { useState } from "react";
import { INSTALL_CMD, INSTALL_CMD_DISPLAY } from "@/lib/site";
import styles from "./CopyCommand.module.css";

export function CopyCommand() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.cmd}>
      <pre tabIndex={0}>
        <code>{INSTALL_CMD_DISPLAY}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy install command"}
        aria-live="polite"
        data-copied={copied || undefined}
      >
        {copied ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect
              x="9"
              y="9"
              width="13"
              height="13"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
            />
          </svg>
        )}
        <span className={styles.tip} hidden={!copied} aria-hidden="true">
          Copied
        </span>
      </button>
    </div>
  );
}
