"use client";

import { motion } from "framer-motion";
import { CornerDownRight } from "lucide-react";

interface Props {
  questions: string[];
  onPick: (q: string) => void;
  disabled?: boolean;
}

export default function FollowUpChips({ questions, onPick, disabled }: Props) {
  if (questions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 7, paddingLeft: 42 }}
    >
      {questions.map((q, i) => (
        <motion.button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onPick(q)}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12 + i * 0.05 }}
          whileHover={disabled ? {} : { scale: 1.03 }}
          whileTap={disabled ? {} : { scale: 0.97 }}
          className="followup-chip"
        >
          <CornerDownRight size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
          {q}
        </motion.button>
      ))}
    </motion.div>
  );
}
