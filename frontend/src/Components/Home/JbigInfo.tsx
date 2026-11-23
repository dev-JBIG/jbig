import React, { ReactNode, useEffect, useMemo, useState } from "react";
import "./JbigInfo.css";
import { fetchSiteSettings, SiteSettings } from "../../API/req";
import { sanitizeMailto } from "../Utils/safeUrl";

interface JbigInfoProps {
    calendarSlot?: ReactNode;
    calendarAction?: ReactNode;
}

const FOCUS_AREAS = ["데이터 사이언스", "딥러닝", "머신러닝", "AI"];

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

    const formattedDescription = useMemo(() => {
        const text = settings.jbig_description || "";
        if (!text) return null;
        return text.split(/(JBIG)/g).filter(Boolean).map((part, idx) =>
            part === "JBIG" ? (
                <strong key={idx} className="jbig-prose-brand">JBIG</strong>
            ) : (
                <React.Fragment key={idx}>{part}</React.Fragment>
            )
        );
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

    const safeMailto = sanitizeMailto(settings.jbig_email);
    const hasContact = Boolean(settings.jbig_email);
    const leaders = [
        { role: "지도교수", name: settings.jbig_advisor, dept: settings.jbig_advisor_dept },
        { role: "회장", name: settings.jbig_president, dept: settings.jbig_president_dept },
        { role: "부회장", name: settings.jbig_vice_president, dept: settings.jbig_vice_president_dept },
    ].filter((item) => item.name || item.dept);

    return (
        <div className="jbig-info-container">
            <section className="jbig-cover" aria-label="JBIG 대문">
                <div className={`jbig-cover-layout${calendarSlot ? " has-calendar" : ""}`}>
                    <div className="jbig-cover-body">
                        <div className="jbig-cover-masthead">
                            <p className="jbig-cover-eyebrow">전북대학교 빅데이터·AI 학회</p>
                            <div className="jbig-cover-title-row">
                                <h2 className="jbig-cover-title">JBIG</h2>
                                <span className="jbig-cover-acronym-inline" aria-label="JBNU Big Data AI Group">
                                    <strong>J</strong>BNU · <strong>B</strong>ig Data · A<strong>I</strong> · <strong>G</strong>roup
                                </span>
                            </div>
                            {formattedDescription && (
                                <p className="jbig-cover-description">
                                    {formattedDescription}
                                </p>
                            )}
                            <p className="jbig-cover-focus" aria-label="주요 활동 분야">
                                {FOCUS_AREAS.join(" · ")}
                            </p>
                        </div>

                        {(leaders.length > 0 || hasContact) && (
                            <dl className="jbig-meta-list" aria-label="운영진 및 문의">
                                {leaders.map((leader) => (
                                    <div key={leader.role} className="jbig-meta-row">
                                        <dt>{leader.role}</dt>
                                        <dd>
                                            <span className="jbig-meta-primary">{leader.name}</span>
                                            {leader.dept && (
                                                <span className="jbig-meta-secondary">{leader.dept}</span>
                                            )}
                                        </dd>
                                    </div>
                                ))}
                                {hasContact && (
                                    <div className="jbig-meta-row">
                                        <dt>문의</dt>
                                        <dd>
                                            {safeMailto ? (
                                                <a href={safeMailto} className="jbig-cover-contact-email">
                                                    {settings.jbig_email}
                                                </a>
                                            ) : (
                                                <span className="jbig-cover-contact-email">{settings.jbig_email}</span>
                                            )}
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        )}
                    </div>

                    {calendarSlot && (
                        <div className="jbig-cover-calendar-pane">
                            {calendarAction && (
                                <div className="jbig-cover-calendar-bar">
                                    <span className="jbig-cover-calendar-label">학회 일정</span>
                                    {calendarAction}
                                </div>
                            )}
                            {calendarSlot}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default JbigInfo;
