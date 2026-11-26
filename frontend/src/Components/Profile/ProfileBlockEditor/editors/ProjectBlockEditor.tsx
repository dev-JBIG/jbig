import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { ProjectBlock } from '../../types';
import { uploadAttachment } from '../../../../API/req';
import { useUser } from '../../../Utils/UserContext';
import { sanitizeMediaUrl } from '../../../Utils/safeUrl';
import { useAlert } from '../../../Utils/AlertContext';
import { getImageUploadError, PROFILE_IMAGE_EXT_RE, UPLOAD_MESSAGES } from '../../../../Utils/uploadRules';

interface Props {
  block: ProjectBlock;
  onChange: (block: ProjectBlock) => void;
}


const ProjectBlockEditor: React.FC<Props> = ({ block, onChange }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { accessToken } = useUser();
  const { showAlert } = useAlert();
  const [tagInput, setTagInput] = useState('');

  const update = (field: string, value: any) => {
    onChange({ ...block, data: { ...block.data, [field]: value } });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !accessToken) return;
    const fileError = getImageUploadError(file, PROFILE_IMAGE_EXT_RE);
    if (fileError) {
      showAlert({ message: fileError, type: 'warning' });
      return;
    }
    setUploading(true);
    try {
      const result = await uploadAttachment(file, accessToken);
      onChange({
        ...block,
        data: { ...block.data, imagePath: result.path, imageUrl: result.url || '' },
      });
    } catch {
      showAlert({ message: UPLOAD_MESSAGES.uploadFailed, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim();
      if (tag && !block.data.tags.includes(tag)) {
        update('tags', [...block.data.tags, tag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    update('tags', block.data.tags.filter((_: string, i: number) => i !== index));
  };

  return (
    <div className="block-editor block-project-editor">
      <input type="text" placeholder="프로젝트 이름" value={block.data.title} onChange={(e) => update('title', e.target.value)} />
      <textarea placeholder="설명" value={block.data.description} onChange={(e) => update('description', e.target.value)} rows={3} />
      <input type="text" placeholder="프로젝트 URL" value={block.data.url} onChange={(e) => update('url', e.target.value)} />
      <div className="block-project-tags-editor">
        <div className="block-project-tag-list">
          {block.data.tags.map((tag: string, i: number) => (
            <span key={i} className="block-tag">
              {tag}
              <button type="button" onClick={() => removeTag(i)}><X size={12} /></button>
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder="태그 입력 후 Enter"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
        />
      </div>
      {(() => {
        const safeThumbUrl = sanitizeMediaUrl(block.data.imageUrl);
        return safeThumbUrl ? (
          <div className="block-image-preview-wrap">
            <img src={safeThumbUrl} alt="" className="block-image-preview block-image-preview-sm" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
            <button
              type="button"
              className="block-image-remove"
              aria-label="썸네일 제거"
              onClick={() => onChange({ ...block, data: { ...block.data, imagePath: '', imageUrl: '' } })}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button type="button" className="block-image-upload-area block-image-upload-small" onClick={() => fileRef.current?.click()}>
            <Upload size={18} aria-hidden="true" />
            <span>{uploading ? '업로드 중...' : '썸네일 (선택)'}</span>
          </button>
        );
      })()}
      <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.gif,.webp,.bmp" hidden onChange={handleImageUpload} />
    </div>
  );
};

export default ProjectBlockEditor;
