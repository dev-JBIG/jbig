"""게시판: 카테고리별 목록, 게시판 목록과 상세, 관리자 권한 수정"""
from django.db.models import DateTimeField, OuterRef, Prefetch, Subquery
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import Board, Category, Post
from ..permissions import IsBoardReadable
from ..serializers import BoardAdminSerializer, BoardSerializer, CategoryListResponseSerializer


@extend_schema(tags=['게시판'])
@extend_schema_view(
    list=extend_schema(
        summary="카테고리별 게시판 목록 조회",
        description="모든 카테고리와 해당 카테고리에 속한 게시판 목록을 조회합니다. 응답의 최상단에는 전체 게시글의 수가 포함됩니다.",
        responses={200: CategoryListResponseSerializer},
    )
)
class BoardListViewSet(viewsets.ViewSet):
    def list(self, request, *args, **kwargs):
        latest_visible_posts = Post.objects.readable_for_user(request.user)
        total_post_count = latest_visible_posts.count()

        boards = Board.objects.annotate(
            latest_post_created_at=Subquery(
                latest_visible_posts
                .filter(board=OuterRef('pk'))
                .order_by('-created_at')
                .values('created_at')[:1],
                output_field=DateTimeField(),
            )
        )
        categories = Category.objects.prefetch_related(Prefetch('boards', queryset=boards)).all()
        response_payload = {
            "total_post_count": total_post_count,
            "categories": categories
        }
        serializer = CategoryListResponseSerializer(response_payload, context={'request': request})
        return Response(serializer.data)

@extend_schema(tags=['게시판'])
@extend_schema_view(
    get=extend_schema(
        summary="전체 게시판 목록 조회",
        description="사이트의 모든 게시판 목록을 조회합니다.",
    )
)
class BoardListAPIView(generics.ListAPIView):
    serializer_class = BoardSerializer
    
    def get_queryset(self):
        # 게시판마다 카테고리를 따로 읽지 않게 함께 읽는다. 정렬은 페이지 나눔이 흔들리지 않게 id 순
        return Board.objects.select_related('category').order_by('id')



@extend_schema(tags=['게시판'])
@extend_schema_view(
    get=extend_schema(
        summary="게시판 상세 정보 조회",
        description="특정 게시판의 상세 정보를 조회합니다.",
    )
)
class BoardDetailAPIView(generics.RetrieveAPIView):
    queryset = Board.objects.all()
    serializer_class = BoardSerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'board_id'
    permission_classes = [IsBoardReadable]


@extend_schema(tags=['관리자'])
@extend_schema_view(
    get=extend_schema(
        summary="[관리자] 게시판 목록 조회",
        description="스태프 전용. 모든 게시판을 공개범위(read_permission) 포함해 조회합니다.",
    )
)
class AdminBoardListAPIView(generics.ListAPIView):
    """관리자 게시판 관리 화면용 목록. 모든 게시판 + 원본 공개범위 값을 반환한다."""
    serializer_class = BoardAdminSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None

    def get_queryset(self):
        return Board.objects.select_related('category').order_by('category__id', 'name')


@extend_schema(tags=['관리자'])
@extend_schema_view(
    patch=extend_schema(
        summary="[관리자] 게시판 공개범위 수정",
        description=(
            "스태프 전용. 게시판의 read_permission(공개범위)을 변경합니다. "
            "'all'(전체공개) / 'member'(회원전용) / 'staff'(스태프전용)."
        ),
    )
)
class AdminBoardUpdateAPIView(generics.UpdateAPIView):
    """게시판 공개범위(read_permission) 수정. PATCH만 허용."""
    serializer_class = BoardAdminSerializer
    permission_classes = [IsAdminUser]
    queryset = Board.objects.select_related('category').all()
    lookup_field = 'id'
    lookup_url_kwarg = 'board_id'
    http_method_names = ['patch', 'options', 'head']



# 업로드 URL 발급해주는 GeneratePresignedURlAPIView 클래스

# 파일 업로드 허용 확장자 화이트리스트.
# 블랙리스트 방식은 `.phtml`, `.svg` (XSS), `.html` 등 우회 여지를 남기기 때문에 화이트리스트로 운영한다.
