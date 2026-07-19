"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { FEATURED_QUESTIONS } from "@/lib/questions";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface Props {
  text: string;
  streaming: boolean;
  showChips: boolean;
  onPick: (q: string) => void;
}

// The empty-state greeting, framed as a real "arrival" moment instead of a
// plain chat bubble floating in a void — reuses the landing Hero's visual
// signature (chamfered portrait, mono eyebrow, copper/wire glow) so the chat
// reads as a continuation of the same identity, not a different product.
export default function WelcomeCard({ text, streaming, showChips, onPick }: Props) {
  return (
    <motion.div
      className="welcome-wrap"
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="welcome-glow" aria-hidden />
      <div className="welcome-card">
        <div className="welcome-portrait">
          <Image src="/ravinder.jpg" alt="Ravinder Varikuppala" fill sizes="72px" style={{ objectFit: "cover" }} />
        </div>

        <div className="welcome-eyebrow">
          <span className="dot" />
          LIVE · TRAINED ON REAL EXPERIENCE
        </div>

        <p className="welcome-headline">
          {text}
          {streaming && <span className="welcome-caret" />}
        </p>

        {showChips && (
          <div className="welcome-chips">
            {FEATURED_QUESTIONS.map((q) => (
              <motion.button
                key={q}
                type="button"
                className="welcome-chip"
                onClick={() => onPick(q)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
              >
                {q}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
