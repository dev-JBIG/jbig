import React from 'react';
import { getTableValue, toTableCell, useMarkdownTemplateForm } from './markdownTemplateForm';
import MDEditor from '@uiw/react-md-editor';
import { safeSanitizePlugin } from '../Utils/safeMarkdown';
import { useColorMode } from '../Utils/ThemeContext';
import './PostWrite.css';

interface StudyFormProps {
  setContent: (content: string) => void;
  initialContent: string;
}

type StudyState = {
  leaderIntro: string;
  groupName: string;
  studyType: string;
  deadline: string;
  isDeadlineTbd: boolean;
  duration: string;
  headcount: string;
  schedule: string;
  plan: string;
};

const parseMarkdownToForm = (md: string): StudyState => {
  const deadlineValue = getTableValue(md, '지원 마감일');
  const planSplit = md.split('## 활동 계획');
  // 본문 끝 줄바꿈 하나는 양식이 붙인 것이라 뺀다(예전에는 수정할 때마다 빈 줄이 하나씩 늘었다)
  const planContent = planSplit.length > 1 ? planSplit[1].trimStart().replace(/\n$/, '') : '';

  return {
    leaderIntro: getTableValue(md, '소모임장 소개'),
    groupName: getTableValue(md, '소모임 이름'),
    studyType: getTableValue(md, '분류') || '학술',
    deadline: deadlineValue === '미정' ? '' : deadlineValue,
    isDeadlineTbd: deadlineValue === '미정',
    duration: getTableValue(md, '활동 기간'),
    headcount: getTableValue(md, '활동 예상 인원'),
    schedule: getTableValue(md, '모임 장소 및 시간'),
    plan: planContent,
  };
};

// 글 본문 형식은 기존 글과 같아야 한다(수정 화면에서 다시 읽음). 표는 가운데 정렬(:---:)
const generateMarkdown = (f: StudyState) => `[${f.studyType}] ${f.groupName} 모집합니다.

| 항목 | 내용 |
| :---: | :---: |
| **소모임 이름** | ${f.groupName} |
| **분류** | ${f.studyType} |
| **소모임장 소개** | ${toTableCell(f.leaderIntro)} |
| **지원 마감일** | ${f.isDeadlineTbd ? '미정' : f.deadline} |
| **활동 기간** | ${f.duration} |
| **활동 예상 인원** | ${f.headcount} |
| **모임 장소 및 시간** | ${f.schedule} |

<br />

## 활동 계획
${f.plan}
`;

const StudyForm: React.FC<StudyFormProps> = ({ setContent, initialContent }) => {
  const { resolvedColorMode } = useColorMode();
  const { state: formState, setState: setFormState, handleChange } = useMarkdownTemplateForm(
    initialContent, setContent, parseMarkdownToForm, generateMarkdown,
  );

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setFormState((prev) => ({
      ...prev,
      isDeadlineTbd: checked,
      deadline: checked ? '' : prev.deadline,
    }));
  };

  return (
    <div className="study-form-container">
       <div className="absence-form-notice">
        ※ 스터디/소모임 모집 양식입니다. 활동 계획은 마크다운으로 자유롭게 작성 가능합니다.
      </div>

      <div className="postwrite-row">
        <label htmlFor="leaderIntro">소모임장 소개</label>
        <textarea
          id="leaderIntro"
          name="leaderIntro"
          className="postwrite-title-input postwrite-textarea-sm"
          rows={3}
          placeholder="간단한 자기소개를 입력해주세요.
          예시) OOO학과 n기 OOO입니다. ~에 관심이 있습니다. 등"
          value={formState.leaderIntro}
          onChange={handleChange}
        />
      </div>

      <div className="postwrite-row">
        <label htmlFor="groupName">소모임 이름</label>
        <input
          id="groupName"
          name="groupName"
          className="postwrite-title-input"
          type="text"
          placeholder="소모임 이름을 입력해주세요."
          value={formState.groupName}
          onChange={handleChange}
        />
      </div>

      <div className="postwrite-row">
        <label htmlFor="studyType">분류</label>
        <select
          id="studyType"
          name="studyType"
          className="board-select"
          value={formState.studyType}
          onChange={handleChange}
        >
          <option value="학술">학술</option>
          <option value="친목">친목</option>
          <option value="프로젝트">프로젝트</option>
          <option value="기타">기타</option>
        </select>
      </div>

      <div className="postwrite-row">
        <label htmlFor="deadline">지원 마감일</label>
        <div className="postwrite-inline-group">
          <input
            id="deadline"
            name="deadline"
            className="postwrite-title-input"
            type="date"
            value={formState.deadline}
            onChange={handleChange}
            disabled={formState.isDeadlineTbd}
          />
          <label className="postwrite-checkbox-inline">
            <input
              type="checkbox"
              checked={formState.isDeadlineTbd}
              onChange={handleCheckboxChange}
            />
            <span>미정(상시)</span>
          </label>
        </div>
      </div>

      <div className="postwrite-row">
        <label htmlFor="duration">활동 기간</label>
        <input
          id="duration"
          name="duration"
          className="postwrite-title-input"
          type="text"
          placeholder="예: 3개월, 이번 학기 동안 등"
          value={formState.duration}
          onChange={handleChange}
        />
      </div>

      <div className="postwrite-row">
        <label htmlFor="headcount">활동 예상 인원</label>
        <input
          id="headcount"
          name="headcount"
          className="postwrite-title-input"
          type="text"
          placeholder="예: 4~6명"
          value={formState.headcount}
          onChange={handleChange}
        />
      </div>

      <div className="postwrite-row">
        <label htmlFor="schedule">모임 장소/시간</label>
        <input
          id="schedule"
          name="schedule"
          className="postwrite-title-input"
          type="text"
          placeholder="예: 매주 목요일 18시 / 학교 근처 카페 / 필요할 때만 만남 등"
          value={formState.schedule}
          onChange={handleChange}
        />
      </div>

      <div className="postwrite-row">
        <label className="postwrite-label-bold">활동 계획 (본문)</label>
        <div className="content-body">
          <MDEditor
            value={formState.plan}
            onChange={(val) => setFormState(prev => ({ ...prev, plan: val || '' }))}
            data-color-mode={resolvedColorMode}
            height={300}
            preview="edit"
            previewOptions={{ rehypePlugins: [safeSanitizePlugin] }}
          />
        </div>
      </div>
    </div>
  );
};

export default StudyForm;