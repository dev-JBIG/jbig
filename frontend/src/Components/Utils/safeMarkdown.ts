import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// PostDetail/TextBlockView/에디터 프리뷰 공통 화이트리스트 스키마.
// text-align 및 엄격한 color 값(hex / 숫자 rgba / CSS 영문 색상명)만 허용한다.
export const safeSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [
      ...(defaultSchema.attributes?.div || []),
      ['style', /^text-align:\s*(left|center|right);?$/i],
    ],
    span: [
      ...(defaultSchema.attributes?.span || []),
      [
        'style',
        /^color:\s*(#[0-9a-fA-F]{3,6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|[a-zA-Z]{3,20});?$/i,
      ],
    ],
  },
};

// @uiw/react-md-editor 내부 react-markdown-preview는 기본적으로 rehypeRaw를 사용한다.
// 저장형/자가 XSS 방어를 위해 previewOptions.rehypePlugins에 rehypeSanitize를 함께 넘겨
// PostDetail 렌더링과 동일한 정책을 유지한다.
export const safeSanitizePlugin: [typeof rehypeSanitize, typeof safeSanitizeSchema] = [
  rehypeSanitize,
  safeSanitizeSchema,
];
