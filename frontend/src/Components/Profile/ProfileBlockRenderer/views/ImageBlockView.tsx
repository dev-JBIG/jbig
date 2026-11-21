import React from 'react';
import { ImageBlock } from '../../types';
import { sanitizeMediaUrl } from '../../../Utils/safeUrl';

interface Props {
  block: ImageBlock;
}

const ImageBlockView: React.FC<Props> = ({ block }) => {
  const { url, caption, alt } = block.data;
  const width = block.style?.width || 'full';
  const safeSrc = sanitizeMediaUrl(url);

  if (!safeSrc) return null;
  return (
    <div className={`block-view block-image-view block-image-${width}`}>
      <img src={safeSrc} alt={alt || caption || ''} referrerPolicy="no-referrer" loading="lazy" decoding="async" />
      {caption && <p className="block-image-caption">{caption}</p>}
    </div>
  );
};

export default ImageBlockView;
