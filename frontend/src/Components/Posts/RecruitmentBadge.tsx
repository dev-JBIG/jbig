import React from 'react';
import { Label } from '@primer/react';
import { RecruitmentInfo } from '../Utils/interfaces';

interface RecruitmentBadgeProps {
    info: RecruitmentInfo;
}

const STATUS_VARIANTS: Record<number, 'success' | 'secondary' | 'accent' | 'danger'> = {
    1: 'success',   // 모집중
    2: 'secondary', // 마감
    3: 'accent',    // 완료
    4: 'danger',    // 취소
};

const RecruitmentBadge: React.FC<RecruitmentBadgeProps> = ({ info }) => {
    const variant = STATUS_VARIANTS[info.status] || 'secondary';
    const progress = info.max_members > 0
        ? `${info.accepted_count}/${info.max_members}명`
        : null;

    return (
        <span className="recruitment-badge-wrap">
            <Label variant={variant} size="small">
                {info.status_display}
            </Label>
            {progress && info.status === 1 && (
                <span className="recruitment-badge-progress">
                    {progress}
                </span>
            )}
        </span>
    );
};

export default RecruitmentBadge;
