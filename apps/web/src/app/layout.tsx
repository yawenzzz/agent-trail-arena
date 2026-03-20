import React from "react";
import type { ReactNode } from "react";

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        {children}
        <style>{`
          :root {
            color-scheme: light;
            --bg: #f3efe6;
            --panel: rgba(255, 251, 244, 0.88);
            --ink: #1f2230;
            --muted: #6f7280;
            --accent: #b7542a;
            --accent-2: #1d6f72;
            --line: rgba(31, 34, 48, 0.12);
            --shadow: 0 24px 60px rgba(31, 34, 48, 0.12);
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            color: var(--ink);
            background:
              radial-gradient(circle at top left, rgba(183, 84, 42, 0.18), transparent 30%),
              radial-gradient(circle at top right, rgba(29, 111, 114, 0.2), transparent 28%),
              linear-gradient(180deg, #f7f1e7 0%, var(--bg) 100%);
            font-family: Georgia, "Times New Roman", serif;
          }
          a { color: inherit; text-decoration: none; }
          main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 56px; }
          h1, h2, h3, p { margin: 0; }
          .hero { padding: 72px 0 32px; }
          .eyebrow { text-transform: uppercase; letter-spacing: 0.16em; font-size: 12px; color: var(--accent-2); }
          .muted { color: var(--muted); }
          .stack-sm { display: grid; gap: 8px; }
          .stack-md { display: grid; gap: 14px; }
          .stack-lg { display: grid; gap: 20px; }
          .panel {
            background: var(--panel);
            backdrop-filter: blur(10px);
            border: 1px solid var(--line);
            border-radius: 24px;
            padding: 24px;
            box-shadow: var(--shadow);
          }
          .primary-button, .secondary-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 44px;
            padding: 0 18px;
            border-radius: 999px;
            border: 1px solid transparent;
            font: inherit;
            cursor: pointer;
          }
          .primary-button { background: var(--ink); color: white; }
          .secondary-link { border-color: var(--line); background: white; }
          .field { display: grid; gap: 8px; }
          .field span { font-size: 14px; }
          .field input, .field select {
            width: 100%;
            min-height: 44px;
            border-radius: 14px;
            border: 1px solid var(--line);
            background: white;
            padding: 0 14px;
            font: inherit;
          }
          .attribute-grid, .arena-layout, .summary-grid { display: grid; gap: 16px; }
          .attribute-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
          .arena-layout { grid-template-columns: 1.1fr 1.2fr 1fr; align-items: start; }
          .summary-grid { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
          .meta-list, .timeline, .finding-list, .chip-row, .actions { display: grid; gap: 12px; }
          .meta-list div { display: grid; gap: 4px; padding-top: 10px; border-top: 1px solid var(--line); }
          .meta-list dt { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
          .timeline-item { padding: 12px 14px; border-radius: 16px; background: rgba(255,255,255,0.72); border: 1px solid var(--line); }
          .event-type { font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--accent); margin-bottom: 6px; }
          .chip-row { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
          .chip { padding: 10px 12px; border-radius: 999px; background: rgba(29,111,114,0.08); border: 1px solid rgba(29,111,114,0.14); }
          .error-text { color: #a1261d; }
          @media (max-width: 960px) {
            .arena-layout { grid-template-columns: 1fr; }
          }
        `}</style>
      </body>
    </html>
  );
}
