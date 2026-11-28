"""게시판 API 뷰 모음. 역할별 모듈(common, og, boards, posts, comments, files, notifications, drafts)로 나눴다.

예전처럼 `from boards.views import X` 로 가져올 수 있게 모든 이름을 다시 내보낸다.
"""
from .common import (  # noqa: F401
    BRAG_BOARD_NAME,
    BRAG_POPUP_DURATION_DAYS,
    OG_DEFAULT_DESCRIPTION,
    OG_DEFAULT_IMAGE,
    OG_DEFAULT_TITLE,
    OG_SITE_BASE_URL,
    logger,
    verify_turnstile,
)
from .og import (  # noqa: F401
    board_post_og_preview,
)
from .posts import (  # noqa: F401
    AllPostListAPIView,
    AllPostSearchView,
    POPULAR_DEFAULT_DAYS,
    POPULAR_DEFAULT_LIMIT,
    POPULAR_MAX_DAYS,
    POPULAR_MAX_LIMIT,
    POPULAR_SORT_FIELDS,
    PopularPostListAPIView,
    PostLikeAPIView,
    PostListCreateAPIView,
    PostRetrieveUpdateDestroyAPIView,
    PostSearchView,
    RegexpReplace,
    sync_brag_popup_for_post,
)
from .comments import (  # noqa: F401
    CommentLikeAPIView,
    CommentListCreateAPIView,
    CommentUpdateDestroyAPIView,
)
from .boards import (  # noqa: F401
    AdminBoardListAPIView,
    AdminBoardUpdateAPIView,
    BoardDetailAPIView,
    BoardListAPIView,
    BoardListViewSet,
)
from .files import (  # noqa: F401
    ALLOWED_UPLOAD_EXTENSIONS,
    ConfirmUploadAPIView,
    DOCUMENT_UPLOAD_EXTENSIONS,
    DeleteFileAPIView,
    GeneratePresignedURLAPIView,
    IMAGE_UPLOAD_EXTENSIONS,
    MAX_EXTENSION_LENGTH,
    MEDIA_STREAM_TOKEN_MAX_AGE,
    MediaStreamView,
    PostAttachmentDownloadView,
    SAFE_IMAGE_MIME_TYPES,
    make_media_stream_token,
    make_media_stream_url,
    verify_media_stream_token,
)
from .notifications import (  # noqa: F401
    NotificationListAPIView,
    NotificationMarkReadAPIView,
    NotificationUnreadCountAPIView,
    create_notification,
)
from .drafts import (  # noqa: F401
    DraftDeleteAPIView,
    DraftRetrieveCreateAPIView,
)
