import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { ImageBlock } from '../../types';
import { uploadAttachment } from '../../../../API/req';
import { useUser } from '../../../Utils/UserContext';
import { sanitizeMediaUrl } from '../../../Utils/safeUrl';
import { useAlert } from '../../../Utils/AlertContext';
import { getImageUploadError, PROFILE_IMAGE_EXT_RE, UPLOAD_MESSAGES } from '../../../../Utils/uploadRules';

interface Props {
  block: ImageBlock;
  onChange: (block: ImageBlock) => void;
}


const ImageBlockEditor: React.FC<Props> = ({ block, onChange }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { accessToken } = useUser();
  const { showAlert } = useAlert();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const result = await uploadAttachment(file);
      onChange({
        ...block,
        data: { ...block.data, path: result.path, url: result.url || '', alt: file.name },
      });
    } catch {
      showAlert({ message: UPLOAD_MESSAGES.uploadFailed, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange({ ...block, data: { ...block.data, path: '', url: '', alt: '' } });
  };

  const safePreviewUrl = sanitizeMediaUrl(block.data.url);

  return (
    <div className="block-editor block-image-editor">
      {safePreviewUrl ? (
        <div className="block-image-preview-wrap">
          <img src={safePreviewUrl} alt={block.data.alt} className="block-image-preview" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
          <button type="button" className="block-image-remove" aria-label="이미지 제거" onClick={handleRemove}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button type="button" className="block-image-upload-area" onClick={() => fileRef.current?.click()}>
          <Upload size={24} aria-hidden="true" />
          <span>{uploading ? '업로드 중...' : '이미지를 선택하세요'}</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.gif,.webp,.bmp" hidden onChange={handleUpload} />
      <div className="block-image-fields">
        <input
          type="text"
          placeholder="캡션 (선택)"
          value={block.data.caption}
          onChange={(e) => onChange({ ...block, data: { ...block.data, caption: e.target.value } })}
        />
        <select
          value={block.style?.width || 'full'}
          onChange={(e) => onChange({ ...block, style: { ...block.style, width: e.target.value as any } })}
        >
          <option value="full">전체 너비</option>
          <option value="medium">중간</option>
          <option value="small">작게</option>
        </select>
      </div>
    </div>
  );
};

export default ImageBlockEditor;
