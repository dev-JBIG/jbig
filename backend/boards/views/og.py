"""게시글 링크 미리보기(OG 메타) 페이지"""
import os
import re
from django.shortcuts import render
from django.views.decorators.http import require_GET
from jbig_backend.storage import public_media_url
from urllib.parse import urlparse
from ..models import Board, Post
from .common import OG_DEFAULT_DESCRIPTION, OG_DEFAULT_IMAGE, OG_DEFAULT_TITLE, OG_SITE_BASE_URL
from .files import IMAGE_UPLOAD_EXTENSIONS


def _plain_text_from_markdown(markdown: str) -> str:
    """팝업 미리보기용으로 마크다운을 짧은 평문으로 변환."""
    if not markdown:
        return ''
    text = re.sub(r'!\[[^\]]*]\([^)]+\)', '', markdown)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'[#>*`~_\-\[\]\(\)]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _is_publicly_previewable(post: Post) -> bool:
    return (
        post.board.read_permission == 'all'
        and post.post_type == Post.PostType.DEFAULT
        and post.board.board_type != Board.BoardType.JUSTIFICATION_LETTER
    )


def _has_image_extension(*values) -> bool:
    for value in values:
        if not isinstance(value, str):
            continue
        path = urlparse(value.strip()).path or value.strip()
        extension = os.path.splitext(path)[1].lstrip('.').lower()
        if extension in IMAGE_UPLOAD_EXTENSIONS:
            return True
    return False


def _looks_presigned_url(value: str) -> bool:
    query = urlparse(value).query.lower()
    return any(marker in query for marker in ('x-amz-', 'x-goog-', 'signature=', 'expires=', 'token='))


def _public_image_url_from_ref(value: str) -> str | None:
    if not isinstance(value, str):
        return None

    ref = value.strip().strip('<>')
    if not ref:
        return None

    if ref.startswith('media-key://'):
        ref = ref[len('media-key://'):]

    ref = ref.replace('\\', '/')
    if ref.startswith('uploads/'):
        if '..' in ref.split('/'):
            return None
        return public_media_url(ref)

    parsed = urlparse(ref)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
        return None
    if _looks_presigned_url(ref):
        return None
    return ref


def _first_attachment_image_url(post: Post) -> str | None:
    if not isinstance(post.attachment_paths, list):
        return None

    for item in post.attachment_paths:
        if not isinstance(item, dict):
            continue
        file_ref = item.get('path') or item.get('url')
        if not file_ref or not _has_image_extension(file_ref, item.get('name')):
            continue
        image_url = _public_image_url_from_ref(file_ref)
        if image_url:
            return image_url
    return None


def _markdown_image_ref(raw_ref: str) -> str:
    ref = raw_ref.strip()
    if ref.startswith('<'):
        end = ref.find('>')
        if end != -1:
            return ref[1:end].strip()
    return ref.split()[0].strip('\'"') if ref else ''


def _first_markdown_image_url(markdown: str) -> str | None:
    if not markdown:
        return None

    for match in re.finditer(r'!\[[^\]]*]\(([^)]+)\)', markdown):
        file_ref = _markdown_image_ref(match.group(1))
        if not file_ref or not _has_image_extension(file_ref):
            continue
        image_url = _public_image_url_from_ref(file_ref)
        if image_url:
            return image_url
    return None


def _post_og_image_url(post: Post) -> str:
    return (
        _first_attachment_image_url(post)
        or _first_markdown_image_url(post.content_md or '')
        or OG_DEFAULT_IMAGE
    )


def _default_og_context(board_id: int, post_id: int) -> dict:
    return {
        'title': OG_DEFAULT_TITLE,
        'description': OG_DEFAULT_DESCRIPTION,
        'image': OG_DEFAULT_IMAGE,
        'url': f'{OG_SITE_BASE_URL}/board/{board_id}/{post_id}',
    }


@require_GET
def board_post_og_preview(request, board_id: int, post_id: int):
    context = _default_og_context(board_id, post_id)
    post = Post.objects.select_related('board').filter(id=post_id, board_id=board_id).first()

    if post and _is_publicly_previewable(post):
        context.update({
            'title': post.title,
            'description': OG_DEFAULT_TITLE,
            'image': _post_og_image_url(post),
        })

    return render(request, 'boards/og_preview.html', context, content_type='text/html; charset=utf-8')
