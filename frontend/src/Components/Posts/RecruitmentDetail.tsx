import React, { useState, useCallback } from 'react';
import { Button, Label } from '@primer/react';
import { RecruitmentDetail as RecruitmentDetailType, ApplicationItem } from '../Utils/interfaces';
import {
    applyToRecruitment, withdrawApplication, changeRecruitmentStatus,
    fetchApplications, updateApplicationStatus
} from '../../API/req';
import { useUser } from '../Utils/UserContext';
import { useAlert } from '../Utils/AlertContext';
import Dialog from '../Utils/Dialog';

interface RecruitmentDetailProps {
    recruitment: RecruitmentDetailType;
    postId: number;
    onUpdate: () => void;
}

const TYPE_LABELS: Record<number, string> = { 1: '스터디', 2: '경진대회', 3: '프로젝트', 4: '기타' };
const STATUS_VARIANTS: Record<number, 'success' | 'secondary' | 'accent' | 'danger'> = {
    1: 'success',
    2: 'secondary',
    3: 'accent',
    4: 'danger',
};
const APP_STATUS: Record<number, { label: string; variant: 'attention' | 'success' | 'danger' }> = {
    1: { label: '대기중', variant: 'attention' },
    2: { label: '수락됨', variant: 'success' },
    3: { label: '거절됨', variant: 'danger' },
};

const RecruitmentDetailSection: React.FC<RecruitmentDetailProps> = ({ recruitment, postId, onUpdate }) => {
    const { accessToken } = useUser();
    const { showAlert, showConfirm } = useAlert();

    const [showApplyModal, setShowApplyModal] = useState(false);
    const [applyMessage, setApplyMessage] = useState('');
    const [applying, setApplying] = useState(false);
    const [showManager, setShowManager] = useState(false);
    const [applications, setApplications] = useState<ApplicationItem[]>([]);
    const [managerTab, setManagerTab] = useState<number>(1); // PENDING
    const [loadingApps, setLoadingApps] = useState(false);

    const r = recruitment;

    const handleApply = useCallback(async () => {
        if (!accessToken) return;
        setApplying(true);
        try {
            await applyToRecruitment(postId, applyMessage, accessToken);
            setShowApplyModal(false);
            setApplyMessage('');
            showAlert({ message: '지원이 완료되었습니다!', type: 'success' });
            onUpdate();
        } catch (err: any) {
            const msg = err?.response?.data?.error || '지원에 실패했습니다.';
            showAlert({ message: msg, type: 'error' });
        } finally {
            setApplying(false);
        }
    }, [accessToken, postId, applyMessage, showAlert, onUpdate]);

    const handleWithdraw = useCallback(async () => {
        if (!accessToken) return;
        const confirmed = await showConfirm({
            message: '지원을 철회하시겠습니까?',
            title: '지원 철회',
            type: 'warning',
            confirmText: '철회',
            cancelText: '취소',
        });
        if (!confirmed) return;
        try {
            await withdrawApplication(postId, accessToken);
            showAlert({ message: '지원이 철회되었습니다.', type: 'info' });
            onUpdate();
        } catch {
            showAlert({ message: '지원 철회에 실패했습니다.', type: 'error' });
        }
    }, [accessToken, postId, showAlert, showConfirm, onUpdate]);

    const handleStatusChange = useCallback(async (action: string) => {
        if (!accessToken) return;
        const labels: Record<string, string> = {
            close: '모집을 마감하시겠습니까?',
            reopen: '모집을 재오픈하시겠습니까?',
            complete: '팀 구성을 완료 처리하시겠습니까?',
            cancel: '모집을 취소하시겠습니까? 대기중인 지원자에게 알림이 전송됩니다.',
        };
        const confirmed = await showConfirm({
            message: labels[action] || '진행하시겠습니까?',
            title: '모집 상태 변경',
            type: action === 'cancel' ? 'warning' : 'info',
        });
        if (!confirmed) return;
        try {
            await changeRecruitmentStatus(postId, action, accessToken);
            onUpdate();
        } catch (err: any) {
            showAlert({ message: err?.response?.data?.error || '상태 변경에 실패했습니다.', type: 'error' });
        }
    }, [accessToken, postId, showConfirm, showAlert, onUpdate]);

    const loadApplications = useCallback(async () => {
        if (!accessToken) return;
        setLoadingApps(true);
        try {
            const apps = await fetchApplications(postId, accessToken);
            setApplications(apps);
        } catch {
            setApplications([]);
        } finally {
            setLoadingApps(false);
        }
    }, [accessToken, postId]);

    const handleToggleManager = useCallback(() => {
        if (!showManager) loadApplications();
        setShowManager(prev => !prev);
    }, [showManager, loadApplications]);

    const handleAppAction = useCallback(async (appId: number, action: string) => {
        if (!accessToken) return;
        try {
            await updateApplicationStatus(postId, appId, action, '', accessToken);
            loadApplications();
            onUpdate();
        } catch (err: any) {
            showAlert({ message: err?.response?.data?.error || '처리에 실패했습니다.', type: 'error' });
        }
    }, [accessToken, postId, loadApplications, onUpdate, showAlert]);

    const filteredApps = applications.filter(a => a.status === managerTab);

    const deadlineStr = r.deadline
        ? new Date(r.deadline).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
        : '상시모집';

    const isClosed = r.status !== 1;
    const myAppMeta = r.my_application_status != null ? APP_STATUS[r.my_application_status] : null;

    return (
        <section className="recruitment-detail-card" aria-label="모집 정보">
            {/* 모집 정보 헤더 */}
            <div className="recruitment-detail-badges">
                <Label variant="accent">
                    {TYPE_LABELS[r.recruitment_type] || '기타'}
                </Label>
                <Label variant={STATUS_VARIANTS[r.status] || 'secondary'}>
                    {r.status_display}
                </Label>
            </div>

            {/* 모집 정보 테이블 */}
            <dl className="recruitment-detail-grid">
                <dt>모집 인원</dt>
                <dd>{r.max_members === 0 ? '제한 없음' : `${r.accepted_count} / ${r.max_members}명`}</dd>

                <dt>마감일</dt>
                <dd className={isClosed ? 'is-closed' : undefined}>
                    {deadlineStr} {isClosed && r.status !== 3 && r.status !== 4 && '(마감됨)'}
                </dd>

                {r.required_skills.length > 0 && (
                    <>
                        <dt>필요 기술</dt>
                        <dd className="recruitment-skill-list">
                            {r.required_skills.map(skill => (
                                <Label key={skill} variant="secondary" size="small">
                                    {skill}
                                </Label>
                            ))}
                        </dd>
                    </>
                )}

                {r.contact_info && (
                    <>
                        <dt>연락처</dt>
                        <dd>{r.contact_info}</dd>
                    </>
                )}
            </dl>

            {/* 지원 상태 / 버튼 영역 */}
            {accessToken && !r.is_owner && (
                <div className="recruitment-detail-footer">
                    {r.has_applied && r.my_application_status !== null ? (
                        <div className="recruitment-status-row">
                            <span className="recruitment-status-label">지원 상태:</span>
                            <Label variant={myAppMeta?.variant || 'secondary'}>
                                {myAppMeta?.label || '알 수 없음'}
                            </Label>
                            {r.my_application_status === 1 && (
                                <Button size="small" variant="danger" onClick={handleWithdraw}>
                                    지원 철회
                                </Button>
                            )}
                        </div>
                    ) : (
                        r.status === 1 && (
                            <Button variant="primary" onClick={() => setShowApplyModal(true)}>
                                지원하기
                            </Button>
                        )
                    )}
                </div>
            )}

            {/* 모집자 관리 영역 */}
            {r.is_owner && (
                <div className="recruitment-detail-footer">
                    <div className="recruitment-owner-actions">
                        {r.status === 1 && (
                            <Button size="small" variant="default" onClick={() => handleStatusChange('close')}>
                                모집 마감
                            </Button>
                        )}
                        {r.status === 2 && (
                            <>
                                <Button size="small" variant="default" onClick={() => handleStatusChange('reopen')}>
                                    재오픈
                                </Button>
                                <Button size="small" variant="primary" onClick={() => handleStatusChange('complete')}>
                                    팀 구성 완료
                                </Button>
                            </>
                        )}
                        {(r.status === 1 || r.status === 2) && (
                            <Button size="small" variant="danger" onClick={() => handleStatusChange('cancel')}>
                                모집 취소
                            </Button>
                        )}
                        <Button size="small" variant="default" onClick={handleToggleManager}>
                            {showManager ? '지원자 관리 닫기' : `지원자 관리${r.total_applicants != null ? ` (${r.total_applicants}명)` : ''}`}
                        </Button>
                    </div>

                    {/* 지원자 관리 패널 */}
                    {showManager && (
                        <div className="recruitment-manager-panel">
                            <div className="recruitment-manager-tabs" role="tablist">
                                {[
                                    { val: 1, label: '대기중' },
                                    { val: 2, label: '수락됨' },
                                    { val: 3, label: '거절됨' }
                                ].map(tab => (
                                    <button
                                        key={tab.val}
                                        type="button"
                                        role="tab"
                                        aria-selected={managerTab === tab.val}
                                        className={`recruitment-manager-tab${managerTab === tab.val ? ' is-active' : ''}`}
                                        onClick={() => setManagerTab(tab.val)}
                                    >
                                        {tab.label} ({applications.filter(a => a.status === tab.val).length})
                                    </button>
                                ))}
                            </div>

                            {loadingApps ? (
                                <div className="recruitment-empty">불러오는 중...</div>
                            ) : filteredApps.length === 0 ? (
                                <div className="recruitment-empty">
                                    해당 상태의 지원자가 없습니다.
                                </div>
                            ) : (
                                <div className="recruitment-app-list">
                                    {filteredApps.map(app => (
                                        <div key={app.id} className="recruitment-app-card">
                                            <div className="recruitment-app-header">
                                                <strong>
                                                    {app.applicant_semester ? `${app.applicant_semester}기 ` : ''}{app.applicant_name}
                                                </strong>
                                                <span>
                                                    {new Date(app.created_at).toLocaleDateString('ko-KR')}
                                                </span>
                                            </div>
                                            {app.message && (
                                                <div className="recruitment-app-message">
                                                    {app.message}
                                                </div>
                                            )}
                                            {app.applicant_resume && (
                                                <div className="recruitment-app-resume">
                                                    자기소개: {app.applicant_resume}
                                                </div>
                                            )}
                                            {managerTab === 1 && (
                                                <div className="recruitment-app-actions">
                                                    <Button size="small" variant="primary" onClick={() => handleAppAction(app.id, 'accept')}>
                                                        수락
                                                    </Button>
                                                    <Button size="small" variant="danger" onClick={() => handleAppAction(app.id, 'reject')}>
                                                        거절
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 지원 모달 */}
            {showApplyModal && (
                <Dialog
                    labelledBy="recruitment-apply-title"
                    onClose={() => setShowApplyModal(false)}
                    backdropClassName="recruitment-modal-backdrop"
                    panelClassName="recruitment-modal-card"
                    busy={applying}
                >
                    <h3 id="recruitment-apply-title">지원하기</h3>
                    <textarea
                        className="recruitment-apply-textarea"
                        placeholder="자기소개나 지원 동기를 작성해주세요 (선택사항)"
                        value={applyMessage}
                        onChange={e => setApplyMessage(e.target.value)}
                        rows={5}
                    />
                    <div className="recruitment-modal-actions">
                        <Button type="button" variant="default" onClick={() => setShowApplyModal(false)}>취소</Button>
                        <Button type="button" variant="primary" onClick={handleApply} disabled={applying}>
                            {applying ? '지원 중...' : '지원하기'}
                        </Button>
                    </div>
                </Dialog>
            )}
        </section>
    );
};

export default RecruitmentDetailSection;
