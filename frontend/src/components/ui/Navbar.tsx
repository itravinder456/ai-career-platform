"use client";

import { motion } from "framer-motion";
import { AppState } from "@/types/chat";
import { useProfile } from "@/hooks/useProfile";
import { SocialIcon } from "@/components/ui/SocialIcons";

export default function Navbar({ state }: { state: AppState }) {
  const inChat = state === "chat";
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
        background: inChat ? "rgba(6,6,16,0.85)" : "transparent",
        borderBottom: `1px solid ${inChat ? "rgba(255,255,255,0.08)" : "transparent"}`,
        backdropFilter: inChat ? "blur(20px) saturate(1.5)" : "none",
        WebkitBackdropFilter: inChat ? "blur(20px) saturate(1.5)" : "none",
        transition: "background 0.4s ease, border-color 0.4s ease",
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
        {/* Logo — rendered as one string to avoid any gap */}
        <motion.a
          href="/"
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
