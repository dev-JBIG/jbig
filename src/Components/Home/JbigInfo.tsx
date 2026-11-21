import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { Label } from "@primer/react";
import { BookOpen, CalendarDays, Mail } from "lucide-react";
import "./JbigInfo.css";
import { fetchSiteSettings, SiteSettings } from "../../API/req";

interface JbigInfoProps {
    calendarSlot?: ReactNode;
    calendarAction?: ReactNode;
}

const ACTIVITIES = ["데이터 사이언스", "딥러닝", "머신러닝", "AI"];

const JbigInfo: React.FC<JbigInfoProps> = ({ calendarSlot, calendarAction }) => {
    const [settings, setSettings] = useState<SiteSettings>({
        notion_page_id: '',
        quiz_url: '',
        jbig_description: '',
        jbig_president: '',
        jbig_president_dept: '',
        jbig_vice_president: '',
        jbig_vice_president_dept: '',
        jbig_email: '',
        jbig_advisor: '',
        jbig_advisor_dept: ''
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const data = await fetchSiteSettings();
                setSettings(data);
            } catch (error) {
                console.error('Failed to load site settings:', error);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, []);

    const highlightedDescription = useMemo(() => {
        const text = settings.jbig_description || "";
        const tokenRegex =
            /(JBIG|JBNU|Big Data|AI|Group|데이터 사이언스|딥러닝|머신러닝)/g;

        return text.split(tokenRegex).filter(Boolean).map((part, idx) => {
            const className =
                part === "JBIG"
                    ? "jbig-highlight-brand"
                    : part === "JBNU" || part === "Big Data" || part === "AI" || part === "Group"
                        ? "jbig-highlight-acronym"
                        : part === "데이터 사이언스" || part === "딥러닝" || part === "머신러닝"
                            ? "jbig-highlight-topic"
                            : undefined;

            if (!className) return <React.Fragment key={idx}>{part}</React.Fragment>;
            return (
                <span key={idx} className={className}>
                    {part}
                </span>
            );
        });
    }, [settings.jbig_description]);

    if (loading) {
        return (
            <div className="jbig-info-container">
                <span className="sr-only" role="status">JBIG 소개를 불러오는 중입니다.</span>
                <div className="jbig-cover jbig-cover-skeleton" aria-hidden="true">
                    <div className="jbig-skeleton-bar jbig-skeleton-kicker" />
                    <div className="jbig-skeleton-bar jbig-skeleton-title" />
                    <div className="jbig-skeleton-bar jbig-skeleton-desc" />
                    <div className="jbig-skeleton-grid">
                        <div className="jbig-skeleton-box" />
                        <div className="jbig-skeleton-box" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="jbig-info-container">
            <section className="jbig-cover" aria-label="JBIG 대문">
                <div className="jbig-cover-header-bar">
                    <div className="jbig-cover-header-left">
                        <BookOpen size={15} className="jbig-cover-header-icon" aria-hidden="true" />
                        <span className="jbig-cover-kicker">JBNU Big Data &amp; AI Group</span>
                    </div>
                    <div className="jbig-cover-topics" role="list" aria-label="주요 활동 분야">
                        {ACTIVITIES.map((topic) => (
                            <Label key={topic} variant="accent" size="small" role="listitem">
                                {topic}
                            </Label>
                        ))}
                    </div>
                </div>

                <div className="jbig-cover-main">
                    <div className="jbig-cover-hero">
                        <h2 className="jbig-cover-title">JBIG</h2>
                        {settings.jbig_description && (
                            <p className="jbig-cover-description">
                                {highlightedDescription}
                            </p>
                        )}
                    </div>

                    <div className="jbig-cover-content-grid">
                        <div className="jbig-cover-info-stack">
                            <div className="jbig-cover-section">
                                <h3><span>JBIG</span>는 무엇의 약자인가요?</h3>
                                <div className="jbig-cover-acronym" role="list">
                                    <div role="listitem"><strong>J</strong><span>JBNU</span></div>
                                    <div role="listitem"><strong>B</strong><span>Big Data</span></div>
                                    <div role="listitem"><strong>I</strong><span>AI</span></div>
                                    <div role="listitem"><strong>G</strong><span>Group</span></div>
                                </div>
                            </div>

                            <div className="jbig-cover-section">
                                <h3>운영진</h3>
                                <div className="jbig-cover-leaders">
                                    <div className="jbig-cover-leader jbig-cover-leader-advisor">
                                        <span>지도 교수</span>
                                        <strong>{settings.jbig_advisor}</strong>
                                        <em>{settings.jbig_advisor_dept}</em>
                                    </div>
                                    <div className="jbig-cover-leader">
                                        <span>회장</span>
                                        <strong>{settings.jbig_president}</strong>
                                        <em>{settings.jbig_president_dept}</em>
                                    </div>
                                    <div className="jbig-cover-leader">
                                        <span>부회장</span>
                                        <strong>{settings.jbig_vice_president}</strong>
                                        <em>{settings.jbig_vice_president_dept}</em>
                                    </div>
                                </div>
                            </div>

                            <div className="jbig-cover-contact">
                                <div className="jbig-cover-contact-label">
                                    <Mail size={14} aria-hidden="true" />
                                    <span>Contact</span>
                                </div>
                                <div className="jbig-cover-contact-body">
                                    <strong>회장 {settings.jbig_president}</strong>
                                    {settings.jbig_email ? (
                                        <a href={`mailto:${settings.jbig_email}`} className="jbig-cover-contact-email">
                                            {settings.jbig_email}
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {calendarSlot && (
                            <div className="jbig-cover-calendar">
                                <div className="jbig-cover-calendar-header">
                                    <div className="jbig-cover-calendar-title">
                                        <CalendarDays size={15} aria-hidden="true" />
                                        <span>Calendar</span>
                                    </div>
                                    {calendarAction}
                                </div>
                                {calendarSlot}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default JbigInfo;
