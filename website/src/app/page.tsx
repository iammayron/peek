import Link from "next/link";
import { CopyCommand } from "@/components/CopyCommand";
import { Demo } from "@/components/Demo";
import { GITHUB_URL } from "@/lib/site";
import styles from "./page.module.css";

function PeekMark() {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="26"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M156 96 L96 96 L96 156" />
        <path d="M356 96 L416 96 L416 156" />
        <path d="M96 356 L96 416 L156 416" />
        <path d="M416 356 L416 416 L356 416" />
      </g>
      <path
        d="M128 256 Q256 140 384 256 Q256 372 128 256 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="26"
        strokeLinejoin="round"
      />
      <circle cx="256" cy="256" r="40" fill="#c8ff4d" stroke="currentColor" strokeWidth="14" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <header className={styles.masthead}>
        <Link className={styles.brand} href="/">
          <PeekMark />
          Peek
        </Link>
        <nav>
          <a href="#install">Install</a>
          <a href="#local">Local</a>
          <a href={GITHUB_URL}>GitHub</a>
        </nav>
      </header>

      <section className={styles.band}>
        <div className={`${styles.wrap} ${styles.hero}`}>
          <h1 className={styles.lede}>
            You point at a DOM node; your coding agent gets the selector, a slice
            of HTML, and a cropped screenshot.
          </h1>
          <Demo />
          <div className={styles.install} id="install">
            <CopyCommand />
            <p className={styles.fine}>
              Then load the unpacked extension from the path{" "}
              <code>peek install --dev</code> prints. Press{" "}
              <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> to pin. Also{" "}
              <code>make install</code> or{" "}
              <a href={`${GITHUB_URL}/blob/main/install.sh`}>install.sh</a>.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.band}>
        <div className={styles.wrap}>
          <div className={styles.eyebrow}>The loop</div>
          <h2>Chrome extension plus a local Go daemon. Not a browser-driving agent.</h2>
          <div className={styles.steps}>
            <article className={styles.step}>
              <div className={styles["step-n"]}>01</div>
              <h3>Arm</h3>
              <p>
                Press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> or click the
                toolbar icon. A crosshair covers the page you are already in.
              </p>
            </article>
            <article className={styles.step}>
              <div className={styles["step-n"]}>02</div>
              <h3>Pin</h3>
              <p>Click a node. Peek writes the selector, HTML slice, and a crop of that element.</p>
            </article>
            <article className={styles.step}>
              <div className={styles["step-n"]}>03</div>
              <h3>Look</h3>
              <p>
                Paste into the agent, or let it read <code>~/.peek/</code>. You pick.
                The model looks.
              </p>
            </article>
          </div>
          <pre className={styles.payload} aria-label="Example pin payload">
            <span className={styles.c}># Pinned element</span>
            {"\n\n"}
            - Selector (<span className={styles.k}>data-testid</span>):{" "}
            <span className={styles.k}>[data-testid=&quot;save&quot;]</span>
            {"\n"}
            - Tag: <span className={styles.k}>button</span>
            {"\n"}
            - Screenshot: ~/.peek/latest.png
            {"\n\n"}
            <span className={styles.c}>```html</span>
            {"\n"}
            &lt;button class=&quot;primary&quot; type=&quot;submit&quot; data-testid=&quot;save&quot;&gt;Save
            changes&lt;/button&gt;
            {"\n"}
            <span className={styles.c}>```</span>
          </pre>
        </div>
      </section>

      <section className={styles.band} id="local">
        <div className={styles.wrap}>
          <div className={styles.eyebrow}>Local by default</div>
          <h2>Your DOM never leaves the machine.</h2>
          <div className={styles.facts}>
            <div className={styles.fact}>
              <b>Localhost only</b>
              <p>
                The extension talks to a helper on <code>127.0.0.1</code>. No
                account. No sign-in.
              </p>
            </div>
            <div className={styles.fact}>
              <b>Owner-only files</b>
              <p>
                Pins live in <code>~/.peek/</code> with mode <code>0600</code>.
                Delete the directory and they are gone.
              </p>
            </div>
            <div className={styles.fact}>
              <b>No telemetry</b>
              <p>Nothing is measured or sent home. The daemon only answers the extension you installed.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Peek — pin a live DOM node for coding agents. MIT licensed.</span>
        <a href={GITHUB_URL}>github.com/iammayron/peek</a>
      </footer>
    </>
  );
}
