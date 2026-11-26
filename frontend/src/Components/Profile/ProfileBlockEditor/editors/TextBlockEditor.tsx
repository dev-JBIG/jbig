import React from 'react';
import MDEditor from '@uiw/react-md-editor';
import { TextBlock } from '../../types';
import { safeSanitizePlugin } from '../../../Utils/safeMarkdown';
import { useColorMode } from '../../../Utils/ThemeContext';

interface Props {
  block: TextBlock;
  onChange: (block: TextBlock) => void;
}

const TextBlockEditor: React.FC<Props> = ({ block, onChange }) => {
  const { resolvedColorMode } = useColorMode();

  return (
    <div className="block-editor block-text-editor" data-color-mode={resolvedColorMode}>
      <MDEditor
        value={block.data.markdown}
        onChange={(val) => onChange({ ...block, data: { markdown: val || '' } })}
        height={200}
        preview="edit"
        previewOptions={{ rehypePlugins: [safeSanitizePlugin] }}
        textareaProps={{ placeholder: '마크다운으로 작성하세요...' }}
      />
    </div>
  );
};

export default TextBlockEditor;
