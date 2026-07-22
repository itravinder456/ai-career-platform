"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { AppState } from "@/types/chat";
import { useProfile } from "@/hooks/useProfile";
import { SocialIcon } from "@/components/ui/SocialIcons";

// motion.create, not a plain <motion.a>: these are internal routes, so they
// need next/link's client-side navigation to keep the app (and the
// QueryClientProvider/query cache with it) mounted across the click — a
// plain <a> does a full page reload and wipes the cache every time.
const MotionLink = motion.create(Link);

const linkPillStyle = (muted: boolean): React.CSSProperties => ({
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: muted ? 500 : 600,
  // Copper, not wire — "Ask Ravinder" is the same primary action as Hero's
  // copper CTA button, so it should carry the same accent, not a second one.
  color: muted ? "var(--text-muted)" : "var(--copper-bright)",
  textDecoration: "none",
  transition: "background 0.15s ease, color 0.15s ease",
  whiteSpace: "nowrap",
  flexShrink: 0,
});

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
  const [menuOpen, setMenuOpen] = useState(false);

  const pageLinks = [
    { href: "/projects", label: "Projects" },
    { href: "/experience", label: "Experience" },
    { href: "/skills", label: "Skills" },
  ];

  // The logo already goes home, but that's not obviously clickable from
  // Projects/Experience/Skills — this is the explicit way back. "Ask
  // Ravinder", not "Home": the destination is the chat, matching Hero's own
  // CTA, not a generic landing page. Same onGoHome intercept as the logo,
  // for the same reason (a real navigation would hard-cut past the
  // landing<->chat cross-fade instead of playing it).
  const goHome = (e: React.MouseEvent) => {
    if (inChat && onGoHome) {
      e.preventDefault();
      onGoHome();
    }
    setMenuOpen(false);
  };

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
        background: solid || menuOpen ? "rgba(16,15,12,0.82)" : "transparent",
        borderBottom: `1px solid ${solid || menuOpen ? "var(--hero-line-bright)" : "transparent"}`,
        backdropFilter: solid || menuOpen ? "blur(20px) saturate(1.5)" : "none",
        WebkitBackdropFilter: solid || menuOpen ? "blur(20px) saturate(1.5)" : "none",
        transition: "background 0.3s ease, border-color 0.3s ease",
      }}
    >
      <div
        className="navbar-inner"
        style={{
          width: "100%",
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* Logo — rendered as one string to avoid any gap. */}
        <motion.a
          href="/"
          onClick={goHome}
          whileHover={{ opacity: 0.8 }}
          transition={{ duration: 0.15 }}
          style={{ textDecoration: "none", userSelect: "none", lineHeight: 1, flexShrink: 0 }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
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

        {/* Desktop nav — hidden below 640px (see globals.css); the mobile
            toggle + dropdown below replaces it rather than trying to cram
            "Ask Ravinder" + 3 page links + up to 3 social links into a
            horizontal scroll strip, which tested badly: nothing signaled
            there was more to scroll to, so Skills and the social links were
            effectively invisible on a real phone. */}
        <nav className="navbar-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <MotionLink
            href="/"
            onClick={goHome}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            whileHover={{ scale: 1.02 }}
            style={linkPillStyle(false)}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            Ask Ravinder
          </MotionLink>
          <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 6px", flexShrink: 0 }} />
          {pageLinks.map(({ href, label }, i) => (
            <MotionLink
              key={href}
              href={href}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
              whileHover={{ scale: 1.02 }}
              style={linkPillStyle(true)}
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
              {label}
            </MotionLink>
          ))}
          <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 6px", flexShrink: 0 }} />
          {links.map(({ id, href, label, download }, i) => (
            <motion.a
              key={label}
              href={href}
              target={download ? undefined : "_blank"}
              rel={download ? undefined : "noopener noreferrer"}
              download={download || undefined}
              aria-label={label}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 + 0.1, duration: 0.35 }}
              whileHover={{ scale: 1.02 }}
              style={{ display: "flex", alignItems: "center", gap: 6, ...linkPillStyle(true) }}
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

        {/* Mobile hamburger toggle — only rendered visible below 640px */}
        <button
          type="button"
          className="navbar-mobile-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-primary)",
            cursor: "pointer",
            padding: 6,
          }}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown — full labels, generous tap targets, closes itself
          on any link click via goHome/onClick below. */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="navbar-mobile-menu"
            style={{
              // Absolute, not a normal flex sibling of .navbar-inner: the
              // header itself is `display:flex`, so a plain sibling div gets
              // laid out *beside* the inner row instead of below it — this
              // takes it out of that flow entirely and anchors it under the
              // fixed 56px header regardless of the header's own layout.
              position: "absolute",
              top: 56,
              left: 0,
              right: 0,
              overflow: "hidden",
              background: "rgba(16,15,12,0.96)",
              backdropFilter: "blur(20px) saturate(1.5)",
              WebkitBackdropFilter: "blur(20px) saturate(1.5)",
              borderBottom: "1px solid var(--hero-line-bright)",
            }}
          >
            <div style={{ padding: "8px 16px 16px", display: "flex", flexDirection: "column" }}>
              <Link
                href="/"
                onClick={goHome}
                style={{ padding: "12px 8px", fontSize: 14, fontWeight: 600, color: "var(--copper-bright)", textDecoration: "none" }}
              >
                Ask Ravinder
              </Link>
              {pageLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  style={{ padding: "12px 8px", fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}
                >
                  {label}
                </Link>
              ))}
              <div style={{ height: 1, background: "var(--border)", margin: "8px 8px" }} />
              {links.map(({ id, href, label, download }) => (
                <a
                  key={label}
                  href={href}
                  target={download ? undefined : "_blank"}
                  rel={download ? undefined : "noopener noreferrer"}
                  download={download || undefined}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 8px",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  <SocialIcon id={id} size={16} />
                  {label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
