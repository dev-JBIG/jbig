import React, { useCallback } from 'react';
import { getSubmitType, getTableValue, toTableCell, useMarkdownTemplateForm } from './markdownTemplateForm';
import { useUser } from '../Utils/UserContext';
import './PostWrite.css'; // 기존 CSS 재활용

interface AbsenceFormProps {
  setContent: (content: string) => void;
  initialContent: string;
}

// 사유서 종류(선택칸 값과 같게. 조퇴, 기타는 지금 선택칸에서 숨겨 둠)
const ABSENCE_TYPES = ['결석사유서', '조퇴사유서', '기타사유서'] as const;

type AbsenceState = {
  reasonType: string;
  absenceDate: string;
  institution: string;
  schedule: string;
  location: string;
  reason: string;
};

// 마크다운에서 폼 데이터 추출 (수정 시 사용)
const parseMarkdownToForm = (md: string): AbsenceState => ({
  reasonType: getSubmitType(md, ABSENCE_TYPES) || '결석사유서',
  absenceDate: getTableValue(md, '결석 날짜'),
  institution: getTableValue(md, '관련 기관'),
  schedule: getTableValue(md, '일정'),
  location: getTableValue(md, '장소'),
  reason: getTableValue(md, '결석 사유'),
});

const AbsenceForm: React.FC<AbsenceFormProps> = ({ setContent, initialContent }) => {
  const { user } = useUser();
  const userName = user?.username || '자동입력실패';

  // 글 본문 형식은 기존 글과 같아야 한다(수정 화면에서 다시 읽음)
  const generate = useCallback((f: AbsenceState) => `${userName} ${f.reasonType} 제출합니다.

| 항목 | 내용 |
| --- | --- |
| **성명** | ${userName} |
| **결석 날짜** | ${f.absenceDate} |
| **관련 기관** | ${f.institution} |
| **일정** | ${f.schedule} |
| **장소** | ${f.location} |
| **결석 사유** | ${toTableCell(f.reason)} |
`, [userName]);

  const { state: formState, handleChange } = useMarkdownTemplateForm(
    initialContent, setContent, parseMarkdownToForm, generate,
  );

  // 7. 렌더링
  return (
    <div className="absence-form-container">
      <div className="absence-form-notice">
        ※ 제출하신 사유서는 본인과 관리자만 확인할 수 있으며, 타인에게는 공개되지 않습니다.
        <br />
        <br />
        ※ 결석 사유서는 특정 기관, 학교관련 일정부터 기본적인 가족모임이나 친구와의 사적 모임까지 허용합니다.
        <br /> 
        ※ 그러나 잦은 사유결석은 이수조건을 채우지 못할 수 있습니다.  주의해주시길 바랍니다.
      </div>

      {/* 사유서 종류 (드롭다운) */}
      <div className="postwrite-row">
        <label htmlFor="reasonType">사유서 종류</label>
        <select
          id="reasonType"
          name="reasonType"
          className="board-select" // 기존 CSS 재활용
          value={formState.reasonType}
          onChange={handleChange}
        >
          <option value="결석사유서">결석사유서</option>
          {/* <option value="조퇴사유서">조퇴사유서</option> */}
          {/* <option value="기타사유서">기타사유서</option> */}
        </select>
      </div>

      {/* 성명 (자동 입력) */}
      <div className="postwrite-row">
        <label htmlFor="userName">성명</label>
        <input
          id="userName"
          name="userName"
          className="postwrite-title-input" // 기존 CSS 재활용
          type="text"
          value={userName}
          readOnly
          disabled
        />
      </div>

      {/* 결석 날짜 */}
      <div className="postwrite-row">
        <label htmlFor="absenceDate">결석 날짜</label>
        <input
          id="absenceDate"
          name="absenceDate"
          className="postwrite-title-input"
          type="date"
          value={formState.absenceDate}
          onChange={handleChange}
        />
      </div>

      {/* 관련 기관 */}
      <div className="postwrite-row">
        <label htmlFor="institution">관련 기관</label>
        <input
          id="institution"
          name="institution"
          className="postwrite-title-input"
          type="text"
          placeholder="관련 기관을 입력하세요."
          value={formState.institution}
          onChange={handleChange}
        />
      </div>
      
      {/* 일정 */}
      <div className="postwrite-row">
        <label htmlFor="schedule">일정</label>
        <input
          id="schedule"
          name="schedule"
          className="postwrite-title-input"
          type="text"
          placeholder="예: 예비군 훈련, 병원 진료 등"
          value={formState.schedule}
          onChange={handleChange}
        />
      </div>

      {/* 장소 */}
      <div className="postwrite-row">
        <label htmlFor="location">장소</label>
        <input
          id="location"
          name="location"
          className="postwrite-title-input"
          type="text"
          placeholder="장소를 입력하세요."
          value={formState.location}
          onChange={handleChange}
        />
      </div>

      {/* 결석 사유 (여러 줄) */}
      <div className="postwrite-row">
        <label htmlFor="reason">결석 사유</label>
        <textarea
          id="reason"
          name="reason"
          className="postwrite-title-input postwrite-textarea-md"
          rows={6}
          placeholder="결석 사유를 입력하세요."
          value={formState.reason}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export default AbsenceForm;
