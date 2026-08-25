import Link from "next/link";
import { CopyCommand } from "@/components/CopyCommand";
import { Demo } from "@/components/Demo";
import { GITHUB_URL, HOME_URL, PIZZA_URL, STORE_URL } from "@/lib/site";
import styles from "./page.module.css";

function PeekMark({ size }: { size: number }) {
  return (
    <img
      src="/peek-mark.png"
      alt=""
      width={size}
      height={size}
      className={styles.mark}
    />
  );
}

function PinShortcut() {
  return (
    <span className={styles.keys}>
      <kbd>Alt</kbd>
      <span className={styles.or}>or</span>
      <kbd>Opt</kbd>
      <span className={styles.plus}>+</span>
      <kbd>Shift</kbd>
      <span className={styles.plus}>+</span>
      <kbd>P</kbd>
    </span>
  );
}

export default function Home() {
  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/demo-poster.png"
        fetchPriority="high"
      />

      <header className={styles.masthead}>
        <div className={styles.bar}>
          <a className={styles.back} href={HOME_URL}>
            ‹ mayronalves.com
          </a>
          <Link className={styles.brand} href="/">
            <PeekMark size={28} />
            Peek.
          </Link>
          <a className={styles.gh} href={GITHUB_URL}>
            GitHub
          </a>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <h1 className={styles.lockup}>
            <PeekMark size={72} />
            Peek.
          </h1>
          <p className={styles.lede}>
            You point at a node. The agent gets the&nbsp;node.
          </p>
          <div className={styles.install} id="install">
            <p className={styles.need}>
              You need both: the Chrome extension and the local daemon.
            </p>
            <ol className={styles.setup}>
              <li>
                <p className={styles.stepLabel}>1. Chrome extension</p>
                <a className={styles.store} href={STORE_URL}>
                  Install from Chrome Web Store
                </a>
              </li>
              <li>
                <p className={styles.stepLabel}>2. Local daemon</p>
                <CopyCommand />
              </li>
            </ol>
            <p className={styles.fine}>
              Then press <PinShortcut />
            </p>
          </div>
          <Demo />
        </section>

        <section className={styles.block} aria-labelledby="loop-heading">
          <h2 id="loop-heading">Arm, pin, look.</h2>
          <p className={styles.lead}>
            Chrome extension plus a local Go daemon. Not a browser-driving
            agent. You stay in the page you already have open.
          </p>
          <ol className={styles.cards}>
            <li className={styles.card}>
              <h3>Arm</h3>
              <p>
                Press <PinShortcut /> or click the toolbar icon. A crosshair
                covers the page you are already in.
              </p>
            </li>
            <li className={styles.card}>
              <h3>Pin</h3>
              <p>
                Click a node. Peek writes the strongest selector it can find, a
                slice of HTML, and a cropped screenshot of that element.
              </p>
            </li>
            <li className={styles.card}>
              <h3>Look</h3>
              <p>
                Paste the pin into the agent, or let it read{" "}
                <code>~/.peek/</code>. Works with Grok Build, Claude Code,
                Codex, and Cursor.
              </p>
            </li>
          </ol>
        </section>

        <section className={styles.block} aria-labelledby="gets-heading">
          <h2 id="gets-heading">What the agent gets</h2>
          <p className={styles.lead}>
            One pin is three artifacts. The model can see the node, not guess
            at a screenshot of the whole page.
          </p>
          <ul className={styles.cards}>
            <li className={styles.card}>
              <h3>Selector</h3>
              <p>
                Prefer <code>data-testid</code>, then <code>id</code>, then a
                path. The agent targets the same node you clicked.
              </p>
              <code className={styles.sample}>[data-testid=&quot;save&quot;]</code>
            </li>
            <li className={styles.card}>
              <h3>HTML slice</h3>
              <p>
                A cropped <code>outerHTML</code> of that element, not the whole
                document. Enough structure to edit it.
              </p>
              <code className={styles.sample}>
                {`<button type="submit">
  Save changes
</button>`}
              </code>
            </li>
            <li className={styles.card}>
              <h3>Screenshot</h3>
              <p>
                A PNG crop of the node, with a little padding. Lands at{" "}
                <code>~/.peek/latest.png</code>.
              </p>
              <code className={styles.sample}>~/.peek/latest.png</code>
            </li>
          </ul>
        </section>

        <section className={styles.block} aria-labelledby="local-heading">
          <h2 id="local-heading">Your DOM never leaves the machine.</h2>
          <p className={styles.lead}>
            The extension talks to a helper on localhost. Nothing is measured
            or sent home.
          </p>
          <ul className={styles.cards}>
            <li className={styles.card}>
              <h3>Localhost only</h3>
              <p>
                The daemon binds <code>127.0.0.1</code>. No account. No
                sign-in.
              </p>
            </li>
            <li className={styles.card}>
              <h3>Owner-only files</h3>
              <p>
                Pins live in <code>~/.peek/</code> with mode <code>0600</code>.
                Delete the directory and they are gone.
              </p>
            </li>
            <li className={styles.card}>
              <h3>No telemetry</h3>
              <p>
                The daemon only answers the extension you installed. That is
                the whole network.
              </p>
            </li>
          </ul>
        </section>

        <section className={styles.block} aria-labelledby="dev-heading">
          <h2 id="dev-heading">About the developer</h2>
          <div className={styles.blurb}>
            <p>
              I am Mayron. Peek is free, MIT licensed, and stays on your
              machine. I ship other tools the same way.
            </p>
            <p>
              If this saved you a round trip, a pizza helps me keep building
              free apps.
            </p>
          </div>
          <div className={styles.actions}>
            <a className={styles.ghost} href={HOME_URL}>
              mayronalves.com
            </a>
            <a className={styles.pizza} href={PIZZA_URL}>
              Buy me a pizza
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Peek. MIT licensed.</span>
        <a href={HOME_URL}>mayronalves.com</a>
        <a href={GITHUB_URL}>github.com/iammayron/peek</a>
      </footer>
    </>
  );
}
