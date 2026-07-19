"use client";

import { motion } from "framer-motion";
import { Briefcase, Layers, Plus, Sparkles, Target } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { TOPICS, TopicId } from "@/lib/questions";
import { SocialIcon } from "@/components/ui/SocialIcons";

const TOPIC_ICON: Record<TopicId, React.ReactNode> = {
  projects: <Layers size={13} />,
  skills: <Sparkles size={13} />,
  experience: <Briefcase size={13} />,
  jd_match: <Target size={13} />,
};

interface Props {
  onAsk: (q: string) => void;
  onNewChat: () => void;
  busy: boolean;
}

export default function ChatSidebar({ onAsk, onNewChat, busy }: Props) {
  const { profile, links } = useProfile();

  return (
    <motion.aside
      className="chat-sidebar"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Identity */}
      <div className="sidebar-identity">
        <div className="sidebar-avatar">
          R
          <span className="sidebar-avatar-dot" />
        </div>
        <div>
          <p className="sidebar-name">R.AI</p>
          <p className="sidebar-role">{profile?.headline ?? "Senior AI Platform Engineer"}</p>
        </div>
      </div>

      {/* Topics */}
      <div className="sidebar-scroll">
        {TOPICS.map((topic) => (
          <div key={topic.id} className="sidebar-topic">
            <p className="sidebar-topic-label">
              {TOPIC_ICON[topic.id]}
              {topic.label}
            </p>
            {topic.questions.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => onAsk(q)}
                className="sidebar-topic-chip"
              >
                {q}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <button type="button" onClick={onNewChat} className="sidebar-newchat">
          <Plus size={14} />
          New chat
        </button>
        <div className="sidebar-socials">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target={link.download ? undefined : "_blank"}
              rel={link.download ? undefined : "noopener noreferrer"}
              download={link.download || undefined}
              className="sidebar-social"
              aria-label={link.label}
              title={link.label}
            >
              <SocialIcon id={link.id} size={15} />
            </a>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
