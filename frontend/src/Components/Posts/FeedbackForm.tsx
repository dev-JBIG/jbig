import React, { useCallback } from 'react';
import { getSubmitType, getTableValue, toTableCell, useMarkdownTemplateForm } from './markdownTemplateForm';
import { useUser } from '../Utils/UserContext';
import './PostWrite.css'; // 기존 CSS 재활용

interface FeedbackFormProps {
  setContent: (content: string) => void;
  initialContent: string;
}

type FeedbackState = {
  reasonType: string;
  reportType: string;
  reportDate: string;
  reportTime: string;
  location: string;
  description: string;
  reproductionSteps: string;
  expectedBehavior: string;
};

// 마크다운에서 폼 데이터 추출 (수정 시 사용)
const parseMarkdownToForm = (md: string): FeedbackState => ({
  reasonType: getSubmitType(md, ['에러/피드백 제보']) || '에러/피드백 제보',
  reportType: getTableValue(md, '제보 유형') || '에러',
  reportDate: getTableValue(md, '발생 날짜'),
  reportTime: getTableValue(md, '발생 시간'),
  location: getTableValue(md, '발생 위치/페이지'),
  description: getTableValue(md, '상세 내용'),
  reproductionSteps: getTableValue(md, '재현 방법'),
  expectedBehavior: getTableValue(md, '기대 동작'),
});

const FeedbackForm: React.FC<FeedbackFormProps> = ({ setContent, initialContent }) => {
  const { user } = useUser();
  const userName = user?.username || '자동입력실패';

  // 글 본문 형식은 기존 글과 같아야 한다(수정 화면에서 다시 읽음). 재현 방법, 기대 동작은 에러 제보일 때만
  const generate = useCallback((f: FeedbackState) => `${userName} ${f.reasonType} 제출합니다.

| 항목 | 내용 |
| --- | --- |
| **성명** | ${userName} |
| **제보 유형** | ${f.reportType} |
| **발생 날짜** | ${f.reportDate} |
| **발생 시간** | ${f.reportTime} |
| **발생 위치/페이지** | ${f.location} |
| **상세 내용** | ${toTableCell(f.description)} |
${f.reportType === '에러' ? `| **재현 방법** | ${toTableCell(f.reproductionSteps)} |\n| **기대 동작** | ${toTableCell(f.expectedBehavior)} |` : ''}
`, [userName]);

  const { state: formState, handleChange } = useMarkdownTemplateForm(
    initialContent, setContent, parseMarkdownToForm, generate,
  );

  // 7. 렌더링
  return (
    <div className="absence-form-container">
      <div className="absence-form-notice">
        ※ 제보하신 내용은 관리자가 확인하여 빠르게 처리하겠습니다.
        <br />
        <br />
        ※ 에러 제보 시 가능한 한 상세한 정보(재현 방법, 스크린샷 등)를 제공해주시면 더 빠른 해결이 가능합니다.
        <br /> 
        ※ 피드백 제보 시 구체적인 개선 사항을 작성해주시면 서비스 개선에 큰 도움이 됩니다.
      </div>

      {/* 제보 유형 (드롭다운) */}
      <div className="postwrite-row">
        <label htmlFor="reportType">제보 유형</label>
        <select
          id="reportType"
          name="reportType"
          className="board-select"
          value={formState.reportType}
          onChange={handleChange}
        >
          <option value="에러">에러</option>
          <option value="피드백">피드백</option>
        </select>
      </div>

      {/* 성명 (자동 입력) */}
      <div className="postwrite-row">
        <label htmlFor="userName">성명</label>
        <input
          id="userName"
          name="userName"
          className="postwrite-title-input"
          type="text"
          value={userName}
          readOnly
          disabled
        />
      </div>

      {/* 발생 날짜 */}
      <div className="postwrite-row">
        <label htmlFor="reportDate">발생 날짜</label>
        <input
          id="reportDate"
          name="reportDate"
          className="postwrite-title-input"
          type="date"
          value={formState.reportDate}
          onChange={handleChange}
        />
      </div>

      {/* 발생 시간 */}
      <div className="postwrite-row">
        <label htmlFor="reportTime">발생 시간</label>
        <input
          id="reportTime"
          name="reportTime"
          className="postwrite-title-input"
          type="time"
          value={formState.reportTime}
          onChange={handleChange}
        />
      </div>

      {/* 발생 위치/페이지 */}
      <div className="postwrite-row">
        <label htmlFor="location">발생 위치/페이지</label>
        <input
          id="location"
          name="location"
          className="postwrite-title-input"
          type="text"
          placeholder="예: 게시판 목록 페이지, 로그인 화면 등"
          value={formState.location}
          onChange={handleChange}
        />
      </div>

      {/* 상세 내용 */}
      <div className="postwrite-row">
        <label htmlFor="description">상세 내용</label>
        <textarea
          id="description"
          name="description"
          className="postwrite-title-input postwrite-textarea-md"
          rows={6}
          placeholder="에러나 피드백에 대한 상세한 내용을 입력하세요."
          value={formState.description}
          onChange={handleChange}
        />
      </div>

      {/* 에러인 경우에만 표시되는 필드들 */}
      {formState.reportType === '에러' && (
        <>
          {/* 재현 방법 */}
          <div className="postwrite-row">
            <label htmlFor="reproductionSteps">재현 방법</label>
            <textarea
              id="reproductionSteps"
              name="reproductionSteps"
              className="postwrite-title-input postwrite-textarea-sm"
              rows={4}
              placeholder="에러를 재현하는 단계를 입력하세요. (예: 1. 로그인 2. 게시판 클릭 3. 글 작성 버튼 클릭)"
              value={formState.reproductionSteps}
              onChange={handleChange}
            />
          </div>

          {/* 기대 동작 */}
          <div className="postwrite-row">
            <label htmlFor="expectedBehavior">기대 동작</label>
            <textarea
              id="expectedBehavior"
              name="expectedBehavior"
              className="postwrite-title-input postwrite-textarea-sm"
              rows={4}
              placeholder="정상적으로 동작했을 때 예상되는 결과를 입력하세요."
              value={formState.expectedBehavior}
              onChange={handleChange}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default FeedbackForm;

