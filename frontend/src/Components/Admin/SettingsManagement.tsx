/** 관리자: 사이트 설정(소개, 운영진, 문의, 노션, 퀴즈) */
import React, { useState, useEffect } from "react";
import { Button } from "@primer/react";
import { sanitizeHttpUrl } from "../Utils/safeUrl";
import { fetchSiteSettings, updateSiteSettings } from "../../API/req";
import "./Admin.css";

// 관리 화면(설정, 게시판, 팝업)은 관리자 화면(Admin)이 로그인한 운영진에게만 그리므로 토큰을 받지 않는다.
// 토큰은 API 함수가 지금 세션에서 직접 읽는다
function SettingsManagement() {
    const [notionPageId, setNotionPageId] = useState("");
    const [quizUrl, setQuizUrl] = useState("");
    const [jbigDescription, setJbigDescription] = useState("");
    const [jbigPresident, setJbigPresident] = useState("");
    const [jbigPresidentDept, setJbigPresidentDept] = useState("");
    const [jbigVicePresident, setJbigVicePresident] = useState("");
    const [jbigVicePresidentDept, setJbigVicePresidentDept] = useState("");
    const [jbigEmail, setJbigEmail] = useState("");
    const [jbigAdvisor, setJbigAdvisor] = useState("");
    const [jbigAdvisorDept, setJbigAdvisorDept] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadedSettingsRef = React.useRef(false);

    useEffect(() => {
        if (loadedSettingsRef.current) return;
        let cancelled = false;
        const load = async () => {
            try {
                const settings = await fetchSiteSettings();
                if (cancelled) return;
                loadedSettingsRef.current = true;
                setNotionPageId(settings.notion_page_id || "");
                setQuizUrl(settings.quiz_url || "");
                setJbigDescription(settings.jbig_description || "");
                setJbigPresident(settings.jbig_president || "");
                setJbigPresidentDept(settings.jbig_president_dept || "");
                setJbigVicePresident(settings.jbig_vice_president || "");
                setJbigVicePresidentDept(settings.jbig_vice_president_dept || "");
                setJbigEmail(settings.jbig_email || "");
                setJbigAdvisor(settings.jbig_advisor || "");
                setJbigAdvisorDept(settings.jbig_advisor_dept || "");
            } catch {
                if (!cancelled) {
                    setMessage({ type: 'error', text: '설정을 불러오는데 실패했습니다.' });
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleSave = async () => {
        const trimmedQuiz = quizUrl.trim();
        if (trimmedQuiz && !sanitizeHttpUrl(trimmedQuiz)) {
            setMessage({ type: 'error', text: '퀴즈 URL은 http:// 또는 https:// 주소여야 합니다.' });
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            await updateSiteSettings({
                notion_page_id: notionPageId,
                quiz_url: trimmedQuiz ? sanitizeHttpUrl(trimmedQuiz) || "" : "",
                jbig_description: jbigDescription,
                jbig_president: jbigPresident,
                jbig_president_dept: jbigPresidentDept,
                jbig_vice_president: jbigVicePresident,
                jbig_vice_president_dept: jbigVicePresidentDept,
                jbig_email: jbigEmail,
                jbig_advisor: jbigAdvisor,
                jbig_advisor_dept: jbigAdvisorDept
            });
            setMessage({ type: 'success', text: '설정이 저장되었습니다.' });
        } catch {
            setMessage({ type: 'error', text: '설정 저장에 실패했습니다.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <>
                <h2 className="admin-content-header">사이트 설정</h2>
                <div className="admin-card">
                    <p className="admin-muted-text">로딩 중...</p>
                </div>
            </>
        );
    }

    return (
        <>
            <h2 className="admin-content-header">사이트 설정</h2>
            <div className="admin-card">
                <h3 className="card-title">주요 설정</h3>
                {message && (
                    <div className={`admin-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>
                        {message.text}
                    </div>
                )}
                <div className="admin-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="admin-notion-id">Notion 페이지 ID</label>
                        <input
                            id="admin-notion-id"
                            className="admin-input"
                            type="text"
                            value={notionPageId}
                            onChange={(e) => setNotionPageId(e.target.value)}
                            placeholder="예: 1ad4d7781cdc803a9a5ef553af7782fe"
                        />
                        <p className="form-hint">교안 페이지의 기본 Notion 페이지 ID입니다.</p>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="admin-quiz-url">퀴즈 URL</label>
                        <input
                            id="admin-quiz-url"
                            className="admin-input"
                            type="url"
                            value={quizUrl}
                            onChange={(e) => setQuizUrl(e.target.value)}
                            placeholder="예: https://forms.gle/..."
                        />
                        <p className="form-hint">사이드바에 표시되는 퀴즈 링크입니다.</p>
                    </div>

                    <h3 className="card-title admin-section-divider-title">JBIG 정보</h3>

                    <div className="form-group">
                        <label className="form-label" htmlFor="admin-jbig-desc">JBIG 소개</label>
                        <textarea
                            id="admin-jbig-desc"
                            className="admin-input admin-textarea"
                            value={jbigDescription}
                            onChange={(e) => setJbigDescription(e.target.value)}
                            placeholder="예: 'JBIG'(JBNU Big Data & AI Group)은..."
                            rows={3}
                        />
                        <p className="form-hint">홈페이지 상단에 표시되는 JBIG 학회 소개 문구입니다.</p>
                    </div>

                    <div className="admin-grid-2">
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-president">회장 이름</label>
                            <input
                                id="admin-president"
                                className="admin-input"
                                type="text"
                                value={jbigPresident}
                                onChange={(e) => setJbigPresident(e.target.value)}
                                placeholder="예: 박성현"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-president-dept">회장 소속</label>
                            <input
                                id="admin-president-dept"
                                className="admin-input"
                                type="text"
                                value={jbigPresidentDept}
                                onChange={(e) => setJbigPresidentDept(e.target.value)}
                                placeholder="예: 전자공학부"
                            />
                        </div>
                    </div>

                    <div className="admin-grid-2">
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-vp">부회장 이름</label>
                            <input
                                id="admin-vp"
                                className="admin-input"
                                type="text"
                                value={jbigVicePresident}
                                onChange={(e) => setJbigVicePresident(e.target.value)}
                                placeholder="예: 국환"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-vp-dept">부회장 소속</label>
                            <input
                                id="admin-vp-dept"
                                className="admin-input"
                                type="text"
                                value={jbigVicePresidentDept}
                                onChange={(e) => setJbigVicePresidentDept(e.target.value)}
                                placeholder="예: 사회학과"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="admin-email">이메일</label>
                        <input
                            id="admin-email"
                            className="admin-input"
                            type="email"
                            value={jbigEmail}
                            onChange={(e) => setJbigEmail(e.target.value)}
                            placeholder="예: green031234@naver.com"
                        />
                    </div>

                    <div className="admin-grid-2">
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-advisor">지도 교수</label>
                            <input
                                id="admin-advisor"
                                className="admin-input"
                                type="text"
                                value={jbigAdvisor}
                                onChange={(e) => setJbigAdvisor(e.target.value)}
                                placeholder="예: 최규빈 교수님"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-advisor-dept">지도 교수 소속</label>
                            <input
                                id="admin-advisor-dept"
                                className="admin-input"
                                type="text"
                                value={jbigAdvisorDept}
                                onChange={(e) => setJbigAdvisorDept(e.target.value)}
                                placeholder="예: 통계학과"
                            />
                        </div>
                    </div>

                    <div className="admin-form-actions">
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? "저장 중..." : "설정 저장"}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}

export default SettingsManagement;
