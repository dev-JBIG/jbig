import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Sparkles, Trophy, ExternalLink } from "lucide-react";
import "./MemberQuickLinks.css";

// 다음 학기 Arena 운영을 재개할 때 true로 변경합니다.
const SHOW_ARENA_LINK = false;

interface MemberQuickLinksProps {
    isLogin: boolean;
    onOpen?: () => void;
}

const MemberQuickLinks: React.FC<MemberQuickLinksProps> = ({ isLogin, onOpen }) => {
    if (!isLogin) return null;

    return (
        <div className="member-quick-links">
            {SHOW_ARENA_LINK && (
                <Link className="member-quick-link" to="/arena" onClick={onOpen}>
                    <Trophy size={15} aria-hidden="true" />
                    <span>JBIG Big Data Arena</span>
                </Link>
            )}
            <a
                className="member-quick-link member-quick-link-news"
                href="https://docs.google.com/forms/d/e/1FAIpQLSeayAi-rqN96kMX2sZb9pI_5pKvbC4XTijO5fM5RW6NeXCGew/viewform"
                target="_blank"
                rel="noopener noreferrer"
                onClick={onOpen}
            >
                <Sparkles size={15} className="member-quick-link-icon" aria-hidden="true" />
                <span className="member-quick-link-text">좋은 소식 나누기</span>
                <ExternalLink size={12} className="member-quick-link-ext" aria-hidden="true" />
            </a>
            <a
                className="member-quick-link member-quick-link-study"
                href="/note"
                target="_blank"
                rel="noopener noreferrer"
                onClick={onOpen}
            >
                <BookOpen size={15} className="member-quick-link-icon" aria-hidden="true" />
                <span className="member-quick-link-text">학습 자료</span>
                <ExternalLink size={12} className="member-quick-link-ext" aria-hidden="true" />
            </a>
        </div>
    );
};

export default MemberQuickLinks;
