import React from 'react';
import { HeaderBlock } from '../../types';

interface Props { block: HeaderBlock; onChange: (block: HeaderBlock) => void; }

const HeaderBlockEditor: React.FC<Props> = ({ block, onChange }) => {
  const update = (field: string, value: any) => onChange({ ...block, data: { ...block.data, [field]: value } });
  return (
    <div className="block-editor block-header-editor">
      <input type="text" placeholder="섹션 제목" value={block.data.title} onChange={(e) => update('title', e.target.value)} className="block-editor-title-input" />
      <input type="text" placeholder="소제목 (선택)" value={block.data.subtitle} onChange={(e) => update('subtitle', e.target.value)} />
      <div className="block-editor-inline-row">
        <label className="block-editor-hint">정렬:</label>
        <select value={block.style?.align || 'left'} onChange={(e) => onChange({ ...block, style: { ...block.style, align: e.target.value as any } })} className="block-editor-inline-select">
          <option value="left">왼쪽</option>
          <option value="center">가운데</option>
        </select>
      </div>
    </div>
  );
};

export default HeaderBlockEditor;
