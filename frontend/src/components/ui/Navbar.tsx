"use client";

import { motion } from "framer-motion";
import { AppState } from "@/types/chat";
import { useProfile } from "@/hooks/useProfile";
import { SocialIcon } from "@/components/ui/SocialIcons";

export default function Navbar({
  state,
  onGoHome,
  scrolled = false,
}: {
  state: AppState;
  onGoHome?: () => void;
  // Hero scrolls internally (its own overflow-y-auto), independent of this fixed
  // header — on landing the header is deliberately transparent at rest, but once
  // Hero's content scrolls even slightly it slides up underneath and visually
  // collides with the logo/links. Solidify the header the moment that happens.
  scrolled?: boolean;
}) {
  const inChat = state === "chat";
  const solid = inChat || scrolled;
  const { links } = useProfile();

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 56,
        display: "flex",
        alignItems: "center",
        background: solid ? "rgba(16,15,12,0.82)" : "transparent",
        borderBottom: `1px solid ${solid ? "var(--hero-line-bright)" : "transparent"}`,
        backdropFilter: solid ? "blur(20px) saturate(1.5)" : "none",
        WebkitBackdropFilter: solid ? "blur(20px) saturate(1.5)" : "none",
        transition: "background 0.3s ease, border-color 0.3s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo — rendered as one string to avoid any gap. In chat, this is an
            in-app "go home" action (setState, cross-fades via AnimatePresence in
            page.tsx) rather than a real navigation — a full href="/" reload would
            hard-cut straight past that transition. */}
        <motion.a
          href="/"
          onClick={(e) => {
            if (inChat && onGoHome) {
              e.preventDefault();
              onGoHome();
            }
          }}
          whileHover={{ opacity: 0.8 }}
          transition={{ duration: 0.15 }}
          style={{ textDecoration: "none", userSelect: "none", lineHeight: 1 }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            RV
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              background: "linear-gradient(135deg, var(--copper-bright), var(--copper))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            .AI
          </span>
        </motion.a>

        {/* Nav links */}
        <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {links.map(({ id, href, label, download }, i) => (
            <motion.a
              key={label}
              href={href}
              target={download ? undefined : "_blank"}
              rel={download ? undefined : "noopener noreferrer"}
              download={download || undefined}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 + 0.1, duration: 0.35 }}
              whileHover={{ scale: 1.02 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-muted)",
                textDecoration: "none",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,255,255,0.06)";
                el.style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "transparent";
                el.style.color = "var(--text-muted)";
              }}
            >
              <SocialIcon id={id} size={15} />
              {label}
            </motion.a>
          ))}
        </nav>
      </div>
    </header>
  );
}
