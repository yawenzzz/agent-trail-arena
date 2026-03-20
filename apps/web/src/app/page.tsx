import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="hero stack-lg">
        <p className="eyebrow">OpenClaw Trial Arena</p>
        <h1>Send a declared agent build into a controlled trial.</h1>
        <p className="muted">
          Define the build, launch a deterministic scripted run, inspect the judge output, and open the replay.
        </p>
        <div>
          <Link className="primary-button" href="/builds">
            Start a new trial
          </Link>
        </div>
      </section>
    </main>
  );
}
