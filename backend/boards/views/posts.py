"""게시글: 목록, 작성, 상세, 수정, 삭제, 좋아요, 검색, 전체 목록, 인기 글, 자랑게시판 팝업 동기화"""
from datetime import timedelta
from django.db.models import CharField, F, Func, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from jbig_backend.storage import delete_files
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated, SAFE_METHODS
from rest_framework.response import Response
from ..models import Board, Notification, Post
from ..permissions import IsBoardReadable, IsPostWritable, PostDetailPermission, board_read_allowed
from ..serializers import (
    BoardSerializer,
    PhotoPostSummarySerializer,
    PostCreateUpdateSerializer,
    PostDetailSerializer,
    PostListResponseSerializer,
    PostListSerializer,
    PostSummarySerializer,
)
from .common import (
    BRAG_BOARD_NAME,
    BRAG_POPUP_DURATION_DAYS,
    _is_upload_owned_by,
    _is_upload_referenced,
    _post_attachment_keys,
    _post_content_keys,
    _with_post_list_summary,
)
from .notifications import create_notification
from .og import _plain_text_from_markdown


class RegexpReplace(Func):
    function = 'REGEXP_REPLACE'
    template = "%(function)s(%(expressions)s, '%(pattern)s', '%(replacement)s', 'g')"

    def __init__(self, expression, pattern, replacement='', **extra):
        super().__init__(
            expression,
            pattern=pattern,
            replacement=replacement,
            output_field=CharField(),
            **extra
        )



def _build_brag_popup_content(post: Post) -> str:
    preview = _plain_text_from_markdown(post.content_md or '')
    if len(preview) > 140:
        preview = f"{preview[:137]}..."

    lines = [
        "새 자랑 글이 등록되었습니다.",
        f"게시판: {post.board.name}",
        f"제목: {post.title}",
    ]
    if preview:
        lines.append(f"내용: {preview}")
    lines.append("축하 한 줄을 남기고 닫아주세요!")
    return "\n".join(lines)


def sync_brag_popup_for_post(post: Post) -> None:
    """
    자랑 태그 게시글과 팝업을 동기화합니다.
    - tag == "자랑": 자동 팝업 생성/갱신
    - 그 외 태그: 연결된 자동 팝업 비활성화
    """
    from django.utils import timezone
    from jbig_backend.models import Popup

    is_brag_post = bool(post.board_id and post.board and post.board.name == BRAG_BOARD_NAME)
    if not is_brag_post:
        Popup.objects.filter(source_post=post, is_active=True).update(is_active=False)
        return

    now = timezone.now()
    Popup.objects.update_or_create(
        source_post=post,
        defaults={
            'title': '축하해주세요!',
            'content': _build_brag_popup_content(post),
            'start_date': now,
            'end_date': now + timedelta(days=BRAG_POPUP_DURATION_DAYS),
            'is_active': True,
            'created_by': post.author,
        }
    )


@extend_schema(
    tags=['게시판'],
    summary="게시글 좋아요/취소",
    description="특정 게시글에 좋아요를 추가하거나 취소합니다. 이미 좋아요를 누른 상태에서 요청하면 좋아요가 취소됩니다.",
    responses={
        200: {
            'description': '좋아요 상태 변경 성공',
            'examples': {
                '좋아요 추가': {
                    'value': {'likes_count': 28, 'is_liked': True}
                },
                '좋아요 취소': {
                    'value': {'likes_count': 27, 'is_liked': False}
                }
            }
        }
    }
)
class PostLikeAPIView(generics.GenericAPIView):
    queryset = Post.objects.all()
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = 'post_id'

    def get_queryset(self):
        # 읽을 수 없는 게시판의 글에는 좋아요도 불가(존재 확인 차단 포함).
        return Post.objects.readable_for_user(self.request.user)

    def post(self, request, *args, **kwargs):
        post = self.get_object()
        user = request.user

        try:
            like = post.likes.through.objects.get(user=user, post=post)
            like.delete()
            is_liked = False
        except post.likes.through.DoesNotExist:
            post.likes.add(user)
            is_liked = True
            # 좋아요 추가 시에만 알림 생성(글쓴이가 탈퇴한 글은 받는 사람이 없어 건너뜀)
            if post.author is not None:
                create_notification(
                    recipient=post.author,
                    actor=user,
                    notification_type=Notification.NotificationType.LIKE,
                    post=post
                )

        likes_count = post.likes.count()
        return Response({'likes_count': likes_count, 'is_liked': is_liked}, status=status.HTTP_200_OK)



@extend_schema(
    tags=['게시글'],
    summary="게시글 검색",
    description="제목, 내용, 작성자명을 기준으로 게시글을 검색합니다. 사용자의 권한에 따라 접근 가능한 게시글 내에서만 검색이 수행됩니다.",
    parameters=[
        OpenApiParameter(
            name='q',
            description='검색할 키워드',
            required=True,
            type=str,
            location=OpenApiParameter.QUERY
        ),
    ]
)


class PostSearchView(generics.ListAPIView):
    serializer_class = PostSummarySerializer
    throttle_scope = 'search'

    def get_queryset(self):
        raw_query = self.request.query_params.get('q', '')
        query = (raw_query or '').strip()[:100]
        if not query:
            return Post.objects.none()

        board_id = self.kwargs.get('board_id', None)
        user = self.request.user

        if board_id:
            board = get_object_or_404(Board, id=board_id)
            if not board_read_allowed(board, user):
                return Post.objects.none()
            base_queryset = Post.objects.filter(board_id=board_id)
        else:
            base_queryset = Post.objects.exclude(board__board_type=Board.BoardType.PHOTO_ALBUM)

        # readable_for_user가 게시판 read_permission('author' 글 단위 필터 포함)과
        # 글 단위 가시성을 함께 적용한다.
        queryset = base_queryset.readable_for_user(user)

        from django.db import connection
        if connection.vendor == 'postgresql':
            # URL/링크를 제거하는 정규식 패턴
            url_pattern = r'!\[[^\]\n]*\]\([^\)\n]*\)|\[[^\]\n]*\]\([^\)\n]*\)|https?://[^\s]+|www\.[^\s]+'
            # content_md에서 URL 제거 후 검색
            queryset = queryset.annotate(
                clean_content=RegexpReplace('content_md', url_pattern, '')
            )
            content_filter = Q(clean_content__icontains=query)
        else:
            content_filter = Q(content_md__icontains=query)

        # 비회원은 익명 게시글 작성자의 실명으로 역추적(de-anonymize)할 수 없도록 제한한다.
        if user.is_authenticated:
            author_filter = Q(author__username__icontains=query)
        else:
            author_filter = Q(author__username__icontains=query, is_anonymous=False)

        search_filter = Q(title__icontains=query) | content_filter | author_filter

        queryset = queryset.filter(search_filter).distinct()
        return _with_post_list_summary(queryset).order_by('-created_at')

@extend_schema(
    tags=['게시글'],
    summary="전체 게시글 검색",
    description="모든 게시판의 게시글을 대상으로 검색합니다. 사용자의 권한에 따라 접근 가능한 게시글 내에서만 검색이 수행됩니다.",
    parameters=[
        OpenApiParameter(
            name='q',
            description='검색할 키워드',
            required=True,
            type=str,
            location=OpenApiParameter.QUERY
        ),
    ]
)
class AllPostSearchView(PostSearchView):
    def get_queryset(self):
        self.kwargs['board_id'] = None
        return super().get_queryset()



@extend_schema(tags=['게시판'])
@extend_schema_view(
    get=extend_schema(
        summary="게시글 목록 조회",
        description="""특정 게시판의 정보 및 게시글 목록을 조회합니다.\n- **게시판 접근 권한**: 게시판의 `read_permission` 설정에 따라 접근이 제어됩니다.\n- **게시글 필터링**: 사용자의 권한(스태프, 인증 여부)에 따라 조회되는 게시글이 자동으로 필터링됩니다. (예: 스태프 전용 글, 본인 작성 해명글 등) """,
        responses={
            200: OpenApiResponse(
                response=PostListResponseSerializer,
                examples=[
                    OpenApiExample(
                        'Success',
                        summary='게시글 목록 조회 성공',
                        value={
                            "board": {
                                "id": 1,
                                "name": "자유게시판",
                                "category": {"id": 1, "name": "커뮤니티"},
                                "read_permission": True,
                                "post_permission": True,
                                "comment_permission": True
                            },
                            "count": 1,
                            "next": None,
                            "previous": None,
                            "results": [
                                {
                                    "id": 101,
                                    "board_post_id": 1,
                                    "title": "첫 번째 게시글입니다.",
                                    "user_id": "testuser",
                                    "author": "테스트유저",
                                    "author_semester": 1,
                                    "created_at": "2025-09-17T12:30:00Z",
                                    "views": 150,
                                    "likes_count": 10,
                                    "comment_count": 2
                                }
                            ]
                        }
                    )
                ]
            ),
            403: OpenApiResponse(description="게시판에 대한 읽기 권한이 없습니다."),
            404: OpenApiResponse(description="존재하지 않는 게시판입니다."),
        },
    ),
    post=extend_schema(
        summary="게시글 생성",
        description="""특정 게시판에 새로운 게시글을 작성합니다.\n- **권한 (Board Level)**: 게시판의 `post_permission` 설정에 따라 접근이 제어됩니다.\n  - `all`: 인증된 사용자 누구나 작성 가능\n  - `staff`: 스태프만 작성 가능""",
        request=PostCreateUpdateSerializer,
        examples=[
            OpenApiExample(
                '게시글 생성 요청',
                summary='새로운 게시글을 작성하는 예시입니다.',
                value={
                    "title": "새로운 게시글 제목",
                    "content_md": "# 제목\n\n여기에 게시글 내용이 마크다운 형식으로 들어갑니다.\n\n- 목록1\n- 목록2",
                    "attachment_paths": [
                        {"url": "http://example.com/media/attachments/file1.pdf", "name": "file1.pdf"},
                        {"url": "http://example.com/media/attachments/file2.jpg", "name": "file2.jpg"}
                    ],
                    "post_type": 1
                }
            )
        ],
        responses={
            201: PostListSerializer,
            400: OpenApiResponse(description="잘못된 요청 데이터입니다."),
            403: OpenApiResponse(description="게시판에 대한 쓰기 권한이 없습니다."),
            404: OpenApiResponse(description="존재하지 않는 게시판입니다."),
        },
    )
)
class PostListCreateAPIView(generics.ListCreateAPIView):
    lookup_url_kwarg = 'board_id'

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [IsBoardReadable()]
        elif self.request.method == 'POST':
            return [IsPostWritable()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PostCreateUpdateSerializer
        if self.request.query_params.get('view') == 'photo':
            return PhotoPostSummarySerializer
        return PostSummarySerializer

    def get_queryset(self):
        board_id = self.kwargs.get('board_id')
        # readable_for_user: 글 단위 가시성 + 게시판 read_permission('author' 포함)을
        # 한 곳에서 적용한다. 게시판 진입 자체는 IsBoardReadable이 이미 게이트한다.
        qs = Post.objects.filter(board_id=board_id).readable_for_user(self.request.user)
        # tag 필터링
        tag = self.request.query_params.get('tag')
        if tag:
            qs = qs.filter(tag=tag)
        if self.request.query_params.get('view') == 'photo':
            # 시리얼라이저가 gated 판정을 위해 post.board.read_permission에 접근하므로
            # select_related로 게시글당 board 추가 쿼리(N+1)를 막는다.
            return (
                qs.select_related('board')
                .only('id', 'title', 'created_at', 'attachment_paths', 'post_type',
                      'board__id', 'board__read_permission')
                .order_by('-created_at')
            )
        return _with_post_list_summary(qs).order_by('-created_at')

    def get_object(self):
        board_id = self.kwargs.get(self.lookup_url_kwarg)
        obj = get_object_or_404(Board, pk=board_id)
        # self.check_object_permissions(self.request, obj) # This line causes recursion
        return obj

    def list(self, request, *args, **kwargs):
        board = self.get_object()
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            paginated_response = self.get_paginated_response(serializer.data)
            response_data = {
                'board': BoardSerializer(board, context={'request': request}).data,
                'count': paginated_response.data['count'],
                'next': paginated_response.data['next'],
                'previous': paginated_response.data['previous'],
                'results': paginated_response.data['results']
            }
            return Response(response_data)

        serializer = self.get_serializer(queryset, many=True)
        response_data = {
            'board': BoardSerializer(board, context={'request': request}).data,
            'results': serializer.data
        }
        return Response(response_data)

    def perform_create(self, serializer):
        board = get_object_or_404(Board, pk=self.kwargs.get('board_id'))
        self.check_object_permissions(self.request, board)
        
        post_type = Post.PostType.DEFAULT # Default to DEFAULT
        # 사유서형 게시판(개인정보 폼)은 항상, 그 외에는 조회 범위가 '본인+스태프(author)'인
        # 동안 작성된 글에 글 단위 잠금을 스탬프한다. 스탬프는 글에 남으므로 이후 게시판
        # 범위를 완화해도 기존 글은 계속 본인+스태프만 볼 수 있다(프라이버시 보존).
        if (board.board_type == Board.BoardType.JUSTIFICATION_LETTER
                or board.read_permission == 'author'):
            post_type = Post.PostType.JUSTIFICATION_LETTER
        
        is_anonymous = serializer.validated_data.get('is_anonymous', True)
        post = serializer.save(
            author=self.request.user,
            board=board,
            post_type=post_type,
            is_anonymous=is_anonymous
        )
        sync_brag_popup_for_post(post)

@extend_schema(tags=['게시판'])
@extend_schema_view(
    get=extend_schema(
        summary="게시글 상세 조회",
        description=(
            "게시글의 상세 정보를 조회합니다.\n"
            "- 권한 (Board Level): 먼저 게시판의 `read_permission`을 확인합니다.\n"
            "- 권한 (Post Level): 게시글의 `post_type`에 따라 상세 조회 권한이 결정됩니다.\n"
            "  - DEFAULT(일반): 게시판 읽기 권한이 있으면 누구나 조회 가능\n"
            "  - STAFF_ONLY(스태프 전용): 스태프만 조회 가능\n"
            "  - JUSTIFICATION_LETTER(해명글): 작성자 또는 스태프만 조회 가능\n"
            "- 조회수 증가: 이 API를 호출하면 해당 게시글의 조회수가 1 증가합니다."
        ),
        responses={
            200: PostDetailSerializer,
            403: OpenApiResponse(description="게시글을 읽을 권한이 없습니다."),
            404: OpenApiResponse(description="존재하지 않는 게시글입니다."),
        },
    ),
    put=extend_schema(summary="게시글 수정", description="작성자 또는 스태프만 게시글을 수정할 수 있습니다."),
    patch=extend_schema(summary="게시글 부분 수정", description="작성자 또는 스태프만 게시글을 부분 수정할 수 있습니다."),
    delete=extend_schema(summary="게시글 삭제", description="작성자 또는 스태프만 게시글을 삭제할 수 있습니다.")
)
class PostRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Post.objects.all()
    permission_classes = [IsBoardReadable, PostDetailPermission]
    lookup_url_kwarg = 'post_id'

    def get_queryset(self):
        return Post.objects.select_related('author', 'board', 'board__category', 'recruitment')

    def get_object(self):
        if not hasattr(self, '_post_object'):
            self._post_object = super().get_object()
        return self._post_object

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return PostCreateUpdateSerializer
        return PostDetailSerializer  

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        Post.objects.filter(pk=instance.pk).update(views=F('views') + 1)
        instance.views += 1

        serializer = self.get_serializer(instance, context={'request': request})
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        """게시글 수정 시 제거된 파일들을 스토리지에서 삭제"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # 게시판 변경 권한 검증
        board_id = request.data.get('board_id')
        if board_id is not None:
            try:
                board_id_int = int(board_id)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "유효한 게시판 ID가 아닙니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            new_board = Board.objects.filter(id=board_id_int).first()
            if new_board is None:
                return Response(
                    {"detail": "대상 게시판을 찾을 수 없습니다."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if new_board.id != instance.board_id:
                if not board_read_allowed(new_board, request.user):
                    return Response(
                        {"detail": "대상 게시판에 접근할 권한이 없습니다."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                if new_board.post_permission != 'all' and not request.user.is_staff:
                    return Response(
                        {"detail": "해당 게시판에는 글을 작성할 권한이 없습니다."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                # 사유서/스태프전용 비공개 글을 일반 공개 게시판으로 빼내는 이동은 스태프만 허용
                if (
                    instance.post_type in (Post.PostType.JUSTIFICATION_LETTER, Post.PostType.STAFF_ONLY)
                    and new_board.read_permission != 'author'
                    and not request.user.is_staff
                ):
                    return Response(
                        {"detail": "비공개 게시글은 다른 게시판으로 이동할 수 없습니다."},
                        status=status.HTTP_403_FORBIDDEN,
                    )

        # 수정 전 파일 키 수집
        old_attachment_keys = {k for k in _post_attachment_keys(instance) if k.startswith('uploads/')}
        old_content_keys = _post_content_keys(instance)

        # 실제 수정 수행
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # 수정 후 파일 키 수집
        instance.refresh_from_db()
        new_attachment_keys = {k for k in _post_attachment_keys(instance) if k.startswith('uploads/')}
        new_content_keys = _post_content_keys(instance)

        # 삭제할 파일 키 계산 (기존에 있었지만 새로운 버전에 없는 것)
        removed_keys = (old_attachment_keys - new_attachment_keys) | (old_content_keys - new_content_keys)
        author_id = getattr(instance.author, 'id', None)
        keys_to_delete = {
            key for key in removed_keys
            if _is_upload_owned_by(key, author_id) and not _is_upload_referenced(key)
        }

        # 삭제된 파일 제거 (스토리지 또는 로컬)
        if keys_to_delete:
            delete_files(keys_to_delete)

        sync_brag_popup_for_post(instance)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """게시글 삭제 시 스토리지에 저장된 파일들도 함께 삭제"""
        instance = self.get_object()
        author_id = getattr(instance.author, 'id', None)

        # 글쓴이 본인이 올린 파일만 지운다(남의 파일 키를 넣어 지우게 하는 공격 방지)
        candidate_keys = {
            k for k in _post_attachment_keys(instance) | _post_content_keys(instance)
            if _is_upload_owned_by(k, author_id)
        }

        response = super().destroy(request, *args, **kwargs)

        # DB에서 게시글이 삭제된 뒤에도 다른 글/임시저장(Draft)에서 참조하지 않는 파일만 제거한다.
        keys_to_delete = {
            key for key in candidate_keys if not _is_upload_referenced(key)
        }
        if keys_to_delete:
            delete_files(keys_to_delete)

        return response


@extend_schema(tags=['게시판'])
@extend_schema_view(
    get=extend_schema(
        summary="전체 게시글 목록 조회",
        description="모든 게시판의 게시글 목록을 조회합니다. 사용자의 권한에 따라 접근 가능한 게시판 및 게시글만 필터링되어 보여집니다.",
    )
)
class AllPostListAPIView(generics.ListAPIView):
    serializer_class = PostSummarySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = self.request.user
        queryset = Post.objects.readable_for_user(user)
        queryset = queryset.exclude(board__board_type=Board.BoardType.PHOTO_ALBUM)

        return _with_post_list_summary(queryset).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({'results': serializer.data})



POPULAR_SORT_FIELDS = {
    'likes': 'likes_count',
    'comments': 'comment_count',
    'views': 'views',
}
POPULAR_DEFAULT_LIMIT = 5
POPULAR_MAX_LIMIT = 10
POPULAR_DEFAULT_DAYS = 90
POPULAR_MAX_DAYS = 365


def _bounded_int(raw, default, low, high):
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, value))


@extend_schema(tags=['게시판'])
@extend_schema_view(
    get=extend_schema(
        summary="인기 게시글 목록 조회",
        description=(
            "최근 days일(기본 90, 최대 365) 안에 올라온 글을 sort 기준(likes, comments, views)으로 "
            "많은 순서대로 limit개(기본 5, 최대 10) 돌려줍니다. 전체 글 목록과 같은 읽기 권한 규칙을 따르고 "
            "사진첩 글과 반응이 0인 글은 뺍니다."
        ),
        parameters=[
            OpenApiParameter(name='sort', type=str, enum=list(POPULAR_SORT_FIELDS), required=False),
            OpenApiParameter(name='limit', type=int, required=False),
            OpenApiParameter(name='days', type=int, required=False),
        ],
    )
)
class PopularPostListAPIView(generics.ListAPIView):
    serializer_class = PostSummarySerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        params = self.request.query_params
        field = POPULAR_SORT_FIELDS.get(params.get('sort'), POPULAR_SORT_FIELDS['likes'])
        days = _bounded_int(params.get('days'), POPULAR_DEFAULT_DAYS, 1, POPULAR_MAX_DAYS)
        limit = _bounded_int(params.get('limit'), POPULAR_DEFAULT_LIMIT, 1, POPULAR_MAX_LIMIT)
        since = timezone.now() - timedelta(days=days)

        queryset = (
            Post.objects.readable_for_user(self.request.user)
            .exclude(board__board_type=Board.BoardType.PHOTO_ALBUM)
            .filter(created_at__gte=since)
        )
        return (
            _with_post_list_summary(queryset)
            .filter(**{f'{field}__gt': 0})
            .order_by(f'-{field}', '-created_at', '-id')[:limit]
        )

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response({'results': serializer.data})
