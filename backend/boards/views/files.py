"""파일: 업로드 주소 발급, 업로드 확인, 삭제, 권한 첨부 다운로드, 미디어 스트림 토큰"""
import os
import re
import uuid
from datetime import datetime
from django.core import signing
from django.http import Http404, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, OpenApiResponse, extend_schema
from jbig_backend.storage import (
    delete_file,
    file_exists,
    generate_presigned_upload_url,
    get_file_stream,
    is_safe_upload_key,
    set_public_acl,
)
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from urllib.parse import quote
from ..models import Post
from .common import _is_upload_referenced, logger


IMAGE_UPLOAD_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}
SAFE_IMAGE_MIME_TYPES = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
}
DOCUMENT_UPLOAD_EXTENSIONS = {
    'pdf', 'hwp', 'hwpx', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv', 'md', 'zip',
}
ALLOWED_UPLOAD_EXTENSIONS = IMAGE_UPLOAD_EXTENSIONS | DOCUMENT_UPLOAD_EXTENSIONS
MAX_EXTENSION_LENGTH = 10


@extend_schema(
    tags=['파일'],
    summary="업로드된 파일 삭제",
    description="오브젝트 스토리지에 업로드된 파일을 삭제합니다. 본인이 업로드한 파일만 삭제할 수 있습니다.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'path': {'type': 'string', 'example': 'uploads/2025/01/01/12/uuid.png'}
            },
            'required': ['path']
        }
    },
    responses={
        200: OpenApiResponse(description="파일 삭제 성공"),
        400: OpenApiResponse(description="잘못된 파일 경로"),
        403: OpenApiResponse(description="본인이 업로드한 파일이 아닙니다"),
        404: OpenApiResponse(description="파일을 찾을 수 없습니다"),
    }
)
class DeleteFileAPIView(APIView):
    """업로드된 파일을 스토리지에서 삭제하는 API"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        file_key = request.data.get('path')

        # 파일 경로 유효성 검사
        if not file_key or not isinstance(file_key, str):
            return Response({"error": "No file path provided."}, status=status.HTTP_400_BAD_REQUEST)

        file_key = file_key.strip().replace('\\', '/')
        if not is_safe_upload_key(file_key):
            return Response({"error": "Invalid file path."}, status=status.HTTP_400_BAD_REQUEST)

        parts = file_key.split('/')
        if len(parts) < 6:
            return Response({"error": "Invalid file path format."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            file_owner_id = int(parts[4])  # uploads/년/월/일/유저ID/파일명
        except (ValueError, IndexError):
            return Response({"error": "Invalid file path format."}, status=status.HTTP_400_BAD_REQUEST)
        if file_owner_id != request.user.id:
            return Response(
                {"error": "You can only delete your own files."},
                status=status.HTTP_403_FORBIDDEN
            )

        # 게시글/드래프트에 이미 첨부 또는 본문 참조 중인 파일은 삭제를 거부한다.
        if _is_upload_referenced(file_key):
            return Response(
                {"error": "이 파일은 게시글 또는 임시 저장(Draft)에서 참조 중이라 삭제할 수 없습니다."},
                status=status.HTTP_409_CONFLICT,
            )

        # 파일 존재 여부 확인
        if not file_exists(file_key):
            return Response({"error": "File not found."}, status=status.HTTP_404_NOT_FOUND)

        # 파일 삭제 (스토리지 또는 로컬)
        if delete_file(file_key):
            return Response({"message": "File deleted successfully."}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Failed to delete file."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ConfirmUploadAPIView(APIView):
    """업로드 완료 후 파일에 public-read ACL을 적용하는 API"""
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        file_key = request.data.get('file_key')
        if not file_key or not isinstance(file_key, str):
            return Response({"error": "No file_key provided."}, status=status.HTTP_400_BAD_REQUEST)

        file_key = file_key.strip().replace('\\', '/')
        if not is_safe_upload_key(file_key):
            return Response({"error": "Invalid file path."}, status=status.HTTP_400_BAD_REQUEST)

        parts = file_key.split('/')
        if len(parts) < 6:
            return Response({"error": "Invalid file path format."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            file_owner_id = int(parts[4])
        except (ValueError, IndexError):
            return Response({"error": "Invalid file path format."}, status=status.HTTP_400_BAD_REQUEST)
        if file_owner_id != request.user.id:
            return Response({"error": "You can only modify your own files."}, status=status.HTTP_403_FORBIDDEN)

        # 이미지는 마크다운 렌더러가 직접 `<img src=...>`로 로드해야 하므로 public-read로
        # 두고, 문서/압축 파일은 private 유지한 뒤 클라이언트가 요청할 때마다 서버가
        # 짧은 만료의 presigned download URL을 발급한다. 이력서/계약서 등 민감 문서가
        # URL만 알면 전세계에 노출되는 것을 막기 위한 조치.
        extension = file_key.rsplit('.', 1)[-1].lower() if '.' in file_key else ''
        if extension in IMAGE_UPLOAD_EXTENSIONS:
            if set_public_acl(file_key):
                return Response({"message": "ACL updated."}, status=status.HTTP_200_OK)
            return Response({"error": "Failed to update ACL."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        # 문서 계열은 ACL 변경 없이 성공 응답 (기본 private 유지)
        return Response({"message": "Upload confirmed."}, status=status.HTTP_200_OK)


def _iter_file(body, chunk_size=8192):
    """스토리지/로컬 파일 객체를 청크 단위로 흘려보내는 제너레이터."""
    try:
        if hasattr(body, 'iter_chunks'):  # boto3 StreamingBody
            for chunk in body.iter_chunks(chunk_size):
                yield chunk
        else:  # 로컬 파일 객체
            while True:
                chunk = body.read(chunk_size)
                if not chunk:
                    break
                yield chunk
    finally:
        try:
            body.close()
        except Exception:
            pass


# 본문 인라인 이미지용 서명 토큰의 유효기간(초). <img src>는 Authorization 헤더를
# 실을 수 없어 URL에 서명 토큰을 넣어 게이트하므로, 페이지 열람 세션 동안만 유효하도록
# 6시간으로 짧게 잡는다(유출돼도 만료 후 무효).
MEDIA_STREAM_TOKEN_MAX_AGE = 6 * 3600
_MEDIA_STREAM_SALT = 'jbig.media.stream'


def make_media_stream_token(file_key: str) -> str:
    """파일 key를 담은 서명·타임스탬프 토큰을 생성한다(TimestampSigner 기반 dumps)."""
    return signing.dumps({'key': file_key}, salt=_MEDIA_STREAM_SALT)


def verify_media_stream_token(token: str) -> str | None:
    """토큰을 검증해 file_key를 반환한다. 서명 위조/만료/형식오류면 None."""
    if not token:
        return None
    try:
        data = signing.loads(token, salt=_MEDIA_STREAM_SALT, max_age=MEDIA_STREAM_TOKEN_MAX_AGE)
    except signing.BadSignature:
        # SignatureExpired 는 BadSignature 의 하위 클래스라 함께 처리된다.
        return None
    if not isinstance(data, dict):
        return None
    key = data.get('key')
    return key if isinstance(key, str) else None


def make_media_stream_url(file_key: str) -> str:
    """토큰을 붙인 미디어 스트림 상대 경로(/api/media/stream/?token=...)를 만든다."""
    token = make_media_stream_token(file_key)
    return f"{reverse('media-stream')}?token={quote(token)}"


@extend_schema(
    tags=['파일'],
    summary="첨부파일 다운로드(권한 게이트)",
    description=(
        "회원전용/스태프 게시판의 첨부파일을 권한 확인 후 스트리밍한다. "
        "게시판 read_permission 기준으로 접근을 제어하며, 원본 스토리지 URL은 노출하지 않는다."
    ),
    responses={
        200: OpenApiResponse(description="파일 스트림"),
        403: OpenApiResponse(description="접근 권한이 없습니다."),
        404: OpenApiResponse(description="게시글 또는 첨부파일을 찾을 수 없습니다."),
    },
)
class PostAttachmentDownloadView(APIView):
    """권한 게이트된 첨부파일 다운로드.

    스토리지가 도메인 단위 공개(R2+CDN)라 공개 URL만으로는 접근을 막을 수 없으므로,
    비공개(member/staff) 범위 게시판의 첨부는 이 엔드포인트로만 내려간다. 인증/권한을
    직접 확인한 뒤 백엔드가 바이트를 스트리밍하고, 클라이언트에는 원본 키/URL을 주지 않는다.
    'all' 게시판의 첨부는 시리얼라이저가 공개 URL을 그대로 주므로 이 경로를 타지 않는다.
    """
    permission_classes = [AllowAny]  # 실제 게이트는 게시판 read_permission으로 세분 판정

    def get(self, request, post_id, index):
        post = get_object_or_404(Post.objects.select_related('board'), pk=post_id)

        # 글 단위 가시성(사유서/스태프전용 글)과 게시판 read_permission('author' 포함)을
        # readable_for_user 한 곳에서 판정한다. 사유서 글의 게시판 검사 우회도 동일 규칙.
        if not Post.objects.readable_for_user(request.user).filter(pk=post_id).exists():
            return Response({'detail': '접근 권한이 없습니다.'}, status=status.HTTP_403_FORBIDDEN)

        attachments = post.attachment_paths if isinstance(post.attachment_paths, list) else []
        if index < 0 or index >= len(attachments):
            raise Http404('첨부파일을 찾을 수 없습니다.')

        item = attachments[index] if isinstance(attachments[index], dict) else {}
        file_key = (item.get('path') or item.get('url') or '').replace('\\', '/')
        file_name = item.get('name') or (file_key.rsplit('/', 1)[-1] if file_key else 'download')
        if not is_safe_upload_key(file_key):
            raise Http404('첨부파일을 찾을 수 없습니다.')

        stream = get_file_stream(file_key)
        if stream is None:
            raise Http404('파일을 찾을 수 없습니다.')
        body, _content_type, content_length = stream

        # 첨부 다운로드는 스토리지 메타데이터의 Content-Type을 신뢰하지 않고 항상 바이너리로 강제한다.
        response = StreamingHttpResponse(
            _iter_file(body),
            content_type='application/octet-stream',
        )
        if content_length is not None:
            response['Content-Length'] = str(content_length)
        # 한글 파일명 대응: 헤더 인젝션(\r\n, 따옴표 등)을 제거한 ASCII 폴백 + RFC 5987 filename*
        safe_file_name = re.sub(r'[\r\n\x00]', '', str(file_name)) or 'download'
        ascii_name = re.sub(r'[^A-Za-z0-9._ -]', '', safe_file_name).strip() or 'download'
        response['Content-Disposition'] = (
            f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(safe_file_name)}"
        )
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'private, no-store'
        return response


@extend_schema(
    tags=['파일'],
    summary="본문 인라인 이미지 스트리밍(서명 토큰)",
    description=(
        "비공개(회원전용/스태프/사유서·스태프전용 글) 본문의 인라인 이미지를 서명 토큰으로 "
        "게이트해 스트리밍한다. <img src>는 Authorization 헤더를 실을 수 없어 URL의 서명 "
        "토큰 자체가 접근 권한을 증명하며, 토큰은 6시간 후 만료된다. 이미지가 페이지에서 "
        "렌더되도록 Content-Disposition은 inline으로 내려간다."
    ),
    parameters=[
        OpenApiParameter(
            name='token',
            description='서명된 미디어 스트림 토큰',
            required=True,
            type=str,
            location=OpenApiParameter.QUERY,
        ),
    ],
    responses={
        200: OpenApiResponse(description="파일 스트림(inline)"),
        403: OpenApiResponse(description="토큰이 없거나 위조/만료되었습니다."),
        404: OpenApiResponse(description="파일을 찾을 수 없습니다."),
    },
)
class MediaStreamView(APIView):
    """서명 토큰으로 게이트된 본문 인라인 이미지 스트리밍.

    스토리지가 도메인 단위 공개(R2+CDN)라 공개 URL만으로는 접근을 막을 수 없고,
    브라우저의 <img src>는 인증 헤더를 실을 수 없다. 그래서 권한 판정 결과를 담은 서명
    토큰을 URL에 넣어 내려보내고, 이 뷰가 토큰의 서명·만료를 검증한 뒤 바이트를 흘려보낸다.
    권한 확인은 토큰 자체가 대신하므로 permission_classes는 AllowAny로 둔다.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get('token')
        file_key = verify_media_stream_token(token)
        if file_key is None:
            return Response({'detail': '유효하지 않은 토큰입니다.'}, status=status.HTTP_403_FORBIDDEN)

        # 토큰이 유효해도 key 형식과 이미지 확장자를 재검증한다(Same-Origin Stored XSS 차단).
        file_key = file_key.replace('\\', '/') if isinstance(file_key, str) else ''
        if not is_safe_upload_key(file_key):
            return Response({'detail': '유효하지 않은 경로입니다.'}, status=status.HTTP_403_FORBIDDEN)

        ext = file_key.rsplit('.', 1)[-1].lower() if '.' in file_key else ''
        safe_content_type = SAFE_IMAGE_MIME_TYPES.get(ext)
        if safe_content_type is None:
            return Response({'detail': '허용되지 않는 미디어 형식입니다.'}, status=status.HTTP_403_FORBIDDEN)

        stream = get_file_stream(file_key)
        if stream is None:
            raise Http404('파일을 찾을 수 없습니다.')
        body, _s3_content_type, content_length = stream

        # 업로더가 R2에 임의의 Content-Type(예: text/html)을 주입해도 무시하고 확장자 기반 안전 MIME만 사용.
        response = StreamingHttpResponse(
            _iter_file(body),
            content_type=safe_content_type,
        )
        if content_length is not None:
            response['Content-Length'] = str(content_length)
        # 이미지는 페이지 내에서 렌더되어야 하므로 다운로드가 아닌 inline 으로 내려보낸다.
        response['Content-Disposition'] = 'inline'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "default-src 'none'; sandbox"
        # 서명 토큰이 붙은 사설 리소스라 공용 캐시는 피하고 짧게 사설 캐시만 허용.
        response['Cache-Control'] = 'private, max-age=3600'
        return response


@extend_schema(
    tags=['파일'], # API 문서에서 '파일' 태그로 분류
    summary="파일 업로드용 Presigned URL 생성",
    description="오브젝트 스토리지에 파일을 직접 업로드할 수 있는 10분 만료 Presigned URL을 발급받습니다.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'filename': {'type': 'string', 'example': 'example.png'}
            },
            'required': ['filename']
        }
    },
    responses={
        200: OpenApiResponse(
            description="URL 발급 성공",
            examples=[
                OpenApiExample(
                    'Success',
                    value={
                        "upload_url": "https://<account>.r2.cloudflarestorage.com/jbig/uploads/2025/10/28/12/a1b2c3d4-....png?X-Amz-Signature=...",
                        "file_key": "uploads/2025/10/28/12/a1b2c3d4-....png"
                    }
                )
            ]
        ),
        400: OpenApiResponse(description="파일 이름이 제공되지 않았거나 허용되지 않는 확장자입니다."),
        500: OpenApiResponse(description="URL 생성에 실패했습니다."),
    }
)
class GeneratePresignedURLAPIView(APIView):
    """
    파일 업로드를 위한 Presigned URL을 생성하는 API
    """
    permission_classes = [IsAuthenticated] # 로그인한 사용자만 이 API를 호출할 수 있음
    throttle_scope = 'file_upload'

    def post(self, request, *args, **kwargs):
        filename = request.data.get('filename')
        if not filename:
            return Response({"error": "No filename provided."}, status=status.HTTP_400_BAD_REQUEST)

        # 파일명 검증: 빈 문자열, 너무 긴 이름 체크
        filename = str(filename).strip()
        if not filename or len(filename) > 255:
            return Response({"error": "Invalid filename."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user

        # 1. 파일 확장자 추출 및 검증
        try:
            extension = os.path.splitext(filename)[1].lstrip('.').lower()
            if not extension:
                extension = 'bin'

            if len(extension) > MAX_EXTENSION_LENGTH:
                return Response({"error": "Extension too long."}, status=status.HTTP_400_BAD_REQUEST)

            if extension not in ALLOWED_UPLOAD_EXTENSIONS:
                return Response(
                    {"error": f"File extension '.{extension}' is not allowed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception:
            return Response({"error": "Invalid filename."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. 서버에서 고유한 파일 경로(Key) 생성
        now = datetime.now()
        file_key = f"uploads/{now:%Y}/{now:%m}/{now:%d}/{user.id}/{uuid.uuid4()}.{extension}"

        # 3. 업로드 URL 생성 (스토리지 presigned URL 또는 로컬 엔드포인트)
        try:
            result = generate_presigned_upload_url(file_key, request=request)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"업로드 URL 생성 실패: {e}")
            return Response({"error": "Failed to generate upload URL."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# 알림 생성 헬퍼 함수
