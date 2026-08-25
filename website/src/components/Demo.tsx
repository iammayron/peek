"use client";

import { useEffect, useRef } from "react";
import styles from "./Demo.module.css";

export function Demo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.removeAttribute("autoplay");
      video.loop = false;
      video.controls = true;
      video.pause();
    }
  }, []);

  return (
    <figure className={styles.finder}>
      <div className={styles.frame}>
        <video
          ref={ref}
          className={styles.video}
          poster="/demo-poster.png"
          width={1280}
          height={720}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Stylized demo: a cursor pins a Save changes button in a generic browser, then a terminal pastes the pin and widens the button so the label fits."
        >
          <source src="/demo.mp4" type="video/mp4" />
          Stylized loop of pinning a DOM node and pasting it into an agent.
        </video>
      </div>
      <figcaption>
        Not a screen recording. A cursor pins a node; the terminal pastes the
        pin and works the element.
      </figcaption>
    </figure>
  );
}
