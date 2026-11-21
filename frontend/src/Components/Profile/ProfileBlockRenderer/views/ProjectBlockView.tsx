import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ProjectBlock } from '../../types';
import { sanitizeHttpUrl, sanitizeMediaUrl } from '../../../Utils/safeUrl';

interface Props {
  block: ProjectBlock;
}

const ProjectBlockView: React.FC<Props> = ({ block }) => {
  const { title, description, tags, url, imageUrl } = block.data;
  if (!title) return null;
  const safeHref = sanitizeHttpUrl(url);
  const safeImg = sanitizeMediaUrl(imageUrl);

  return (
    <div className="block-view block-project-view">
      {safeImg && (
        <div className="block-project-image">
          <img src={safeImg} alt={title} referrerPolicy="no-referrer" loading="lazy" decoding="async" />
        </div>
      )}
      <div className="block-project-content">
        <h3 className="block-project-title">
          {title}
          {safeHref && (
            <a href={safeHref} target="_blank" rel="noopener noreferrer" className="block-project-link">
              <ExternalLink size={16} />
            </a>
          )}
        </h3>
        {description && <p className="block-project-desc">{description}</p>}
        {tags && tags.length > 0 && (
          <div className="block-project-tags">
            {tags.map((tag, i) => (
              <span key={i} className="block-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectBlockView;
