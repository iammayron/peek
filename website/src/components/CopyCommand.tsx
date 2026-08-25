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
      <pre>
        <code>{INSTALL_CMD_DISPLAY}</code>
      </pre>
      <button type="button" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
