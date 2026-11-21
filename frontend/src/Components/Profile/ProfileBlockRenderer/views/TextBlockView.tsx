import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { TextBlock } from '../../types';
import { safeSanitizePlugin } from '../../../Utils/safeMarkdown';

interface Props {
  block: TextBlock;
}

const TextBlockView: React.FC<Props> = ({ block }) => {
  if (!block.data.markdown) return null;
  return (
    <div className="block-view block-text-view">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, safeSanitizePlugin]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer">
              {props.children}
            </a>
          ),
        }}
      >
        {block.data.markdown}
      </ReactMarkdown>
    </div>
  );
};

export default TextBlockView;
