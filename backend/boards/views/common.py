"""게시판 뷰 공통: 로거, 상수, 목록 요약 쿼리, 업로드 파일 키 소유와 참조 확인, Turnstile 확인"""
import logging
import re
import requests
from django.conf import settings
from django.db.models import Count, Q
from django.db.utils import NotSupportedError
from jbig_backend.storage import is_safe_upload_key
from ..models import Draft, Post


logger = logging.getLogger(__name__)

BRAG_POPUP_DURATION_DAYS = 7
BRAG_BOARD_NAME = '자랑게시판'
OG_SITE_BASE_URL = 'https://jbig.co.kr'
OG_DEFAULT_TITLE = 'JBIG'
OG_DEFAULT_DESCRIPTION = 'Data are profoundly dumb.'
OG_DEFAULT_IMAGE = 'https://jbig.co.kr/JBIG-logo-1200x630.png'

def _with_post_list_summary(queryset):
    return queryset.select_related('author', 'board', 'recruitment').annotate(
        likes_count=Count('likes', distinct=True),
        comment_count=Count('comments', distinct=True),
    )


def _post_attachment_keys(post):
    """글 첨부 목록(attachment_paths)의 파일 키를 / 구분자로 맞춰 돌려준다."""
    keys = set()
    if post.attachment_paths and isinstance(post.attachment_paths, list):
        for att in post.attachment_paths:
            if isinstance(att, dict) and isinstance(att.get('path'), str):
                keys.add(att['path'].replace('\\', '/'))
    return keys


def _post_content_keys(post):
    """본문의 media-key://uploads/... 이미지 키를 / 구분자로 맞춰 돌려준다."""
    if not post.content_md:
        return set()
    return {
        k.replace('\\', '/')
        for k in re.findall(r'media-key://(uploads[\\/][^\s\)]+)', post.content_md)
    }


def _is_upload_owned_by(file_key, owner_id):
    if owner_id is None or not isinstance(file_key, str):
        return False
    normalized = file_key.strip().replace('\\', '/')
    if not is_safe_upload_key(normalized):
        return False
    parts = normalized.split('/')
    if len(parts) < 6:
        return False
    try:
        return int(parts[4]) == owner_id
    except (TypeError, ValueError):
        return False


def _json_paths_reference(model, field_name, file_key):
    normalized = file_key.replace('\\', '/')
    legacy = normalized.replace('/', '\\')
    try:
        return (
            model.objects.filter(**{f'{field_name}__contains': [{'path': normalized}]}).exists()
            or (
                legacy != normalized
                and model.objects.filter(**{f'{field_name}__contains': [{'path': legacy}]}).exists()
            )
        )
    except NotSupportedError:
        paths_lists = model.objects.values_list(field_name, flat=True).iterator()
        return any(
            isinstance(item, dict)
            and isinstance(item.get('path'), str)
            and item['path'].replace('\\', '/') == normalized
            for paths in paths_lists if isinstance(paths, list)
            for item in paths
        )


def _is_upload_referenced(file_key):
    normalized = file_key.replace('\\', '/')
    legacy = normalized.replace('/', '\\')
    marker_norm = f'media-key://{normalized}'
    marker_legacy = f'media-key://{legacy}'
    return (
        Post.objects.filter(Q(content_md__contains=marker_norm) | Q(content_md__contains=marker_legacy)).exists()
        or Draft.objects.filter(Q(content_md__contains=marker_norm) | Q(content_md__contains=marker_legacy)).exists()
        or _json_paths_reference(Post, 'attachment_paths', normalized)
        or _json_paths_reference(Draft, 'uploaded_paths', normalized)
    )


# Cloudflare Turnstile 검증 함수
def verify_turnstile(token: str, ip: str) -> bool:
    """Cloudflare Turnstile 토큰 검증"""
    if not settings.TURNSTILE_SECRET_KEY:
        if settings.IS_LOCAL or settings.DEBUG:
            return True  # 로컬 개발 환경에서만 검증 건너뛰기
        logger.error("TURNSTILE_SECRET_KEY is not configured in production; rejecting verification.")
        return False
    if not token or not isinstance(token, str):
        return False

    try:
        response = requests.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            data={
                'secret': settings.TURNSTILE_SECRET_KEY,
                'response': token,
                'remoteip': ip,
            },
            timeout=10,
            allow_redirects=False,
        )
        result = response.json()
        return bool(result.get('success', False))
    except Exception as e:
        logger.error(f"Turnstile 검증 실패: {e}")
        return False


# 데코레이터가 뷰로 착각해서;; 맨 위로 뺌
