"""회원 활동과 프로필: 회원 글, 댓글 목록, 회원 정보, 공개 프로필, 이력서, 프로필 블록, HTML 프로필"""
from boards.models import Comment, Post
from boards.serializers import CommentSerializer, CommentTreeListMixin, PostSummarySerializer
from django.db import models
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from ..models import User
from ..serializers import (
    ProfileBlocksUpdateSerializer,
    ProfileHtmlUpdateSerializer,
    PublicProfileSerializer,
    ResumeUpdateSerializer,
    UserProfileSerializer,
)


@extend_schema(
    tags=["사용자"],
    summary="특정 사용자가 작성한 게시글 목록 조회",
    description="""특정 사용자의 username을 이용하여 해당 사용자가 작성한 모든 게시글의 목록을 조회합니다.
    
- 로그인한 사용자: 실명 작성글과 익명 작성글 모두 조회 가능
- 비로그인 사용자(비회원): 실명 작성글만 조회 가능 (익명 작성글은 제외됨)
- 본인의 프로필: 익명 작성글도 모두 확인 가능""",
    parameters=[
        OpenApiParameter(
            name='user_id',
            type=str,
            location=OpenApiParameter.PATH,
            description="사용자 username"
        )
    ]
)
class UserPostListView(generics.ListAPIView):
    serializer_class = PostSummarySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        username = (self.kwargs['user_id'] or '').strip().lower()
        target_user = get_object_or_404(User, email__iexact=f'{username}@jbnu.ac.kr')
        request_user = self.request.user

        queryset = Post.objects.filter(author=target_user).visible_for_user(request_user)

        if not (request_user.is_authenticated and request_user.is_staff):
            queryset = queryset.filter(board__read_permission='all')
        
        # 로그인하지 않은 사용자는 익명 글을 볼 수 없음
        if not request_user.is_authenticated:
            queryset = queryset.filter(is_anonymous=False)
        
        return queryset.select_related('author', 'board', 'recruitment').annotate(
            likes_count=models.Count('likes', distinct=True),
            comment_count=models.Count('comments', distinct=True),
        ).order_by('-created_at')



@extend_schema(
    tags=["사용자"],
    summary="특정 사용자가 작성한 댓글 목록 조회",
    description="""특정 사용자의 ID를 이용하여 해당 사용자가 작성한 모든 댓글의 목록을 조회합니다.
    
- 로그인한 사용자: 실명 댓글과 익명 댓글 모두 조회 가능
- 비로그인 사용자(비회원): 실명 댓글만 조회 가능 (익명 댓글은 제외됨)
- 본인의 프로필: 익명 댓글도 모두 확인 가능""",
    parameters=[
        OpenApiParameter(
            name='user_id',
            type=str,
            location=OpenApiParameter.PATH,
            description="사용자 ID (이메일의 '@' 앞 부분)"
        )
    ]
)
class UserCommentListView(CommentTreeListMixin, generics.ListAPIView):
    serializer_class = CommentSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user_id = (self.kwargs['user_id'] or '').strip().lower()
        target_user = get_object_or_404(User, email__iexact=f'{user_id}@jbnu.ac.kr')
        request_user = self.request.user

        visible_posts = Post.objects.visible_for_user(request_user)
        if not (request_user.is_authenticated and request_user.is_staff):
            visible_posts = visible_posts.filter(board__read_permission='all')

        queryset = Comment.objects.filter(author=target_user, post__in=visible_posts)
        
        # 로그인하지 않은 사용자는 익명 댓글을 볼 수 없음
        if not request_user.is_authenticated:
            queryset = queryset.filter(is_anonymous=False)
        
        return queryset.order_by('-created_at', '-id')


@extend_schema(
    tags=["사용자"],
    summary="사용자 프로필 조회",
    description="특정 사용자의 프로필 정보를 조회합니다. 요청한 사용자가 프로필의 주인인지 여부(is_self)와 총 게시글/댓글 수를 포함합니다.",
    parameters=[
        OpenApiParameter(
            name='user_id',
            type=str,
            location=OpenApiParameter.PATH,
            description="사용자 ID (이메일의 '@' 앞 부분)"
        )
    ],
    responses={
        200: OpenApiExample(
            'Successful Response',
            summary='A successful response.',
            description='사용자 프로필 정보가 성공적으로 반환되었습니다.',
            value={
                "username": "testuser",
                "email": "test@example.com",
                "semester": 1,
                "is_staff": False,
                "date_joined": "2025-08-17 10:00:00",
                "is_self": True,
                "post_count": 15,
                "comment_count": 42
            }
        )
    }
)
class UserProfileView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user_id = (self.kwargs['user_id'] or '').strip().lower()
        # 전북대 이메일 ID(@ 앞부분)에 해당하는 사용자를 정확히 매칭한다.
        # 접두 매칭(startswith)은 예: 'a'로 'abc@...'를 잡는 경로 불일치 및
        # 여러 도메인을 가진 중복 ID 선점 공격의 여지를 남긴다.
        obj = get_object_or_404(self.get_queryset(), email__iexact=f'{user_id}@jbnu.ac.kr')
        self.check_object_permissions(self.request, obj)
        return obj


@extend_schema(
    tags=["사용자"],
    summary="공개 프로필 조회",
    description="이메일 ID(@ 앞부분)로 사용자의 공개 프로필을 조회합니다. 로그인 없이 접근 가능합니다.",
    parameters=[
        OpenApiParameter(
            name='username',
            type=str,
            location=OpenApiParameter.PATH,
            description="사용자 ID (이메일의 '@' 앞 부분, 예: bjl5029)"
        )
    ]
)
class PublicProfileView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = PublicProfileSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        username = (self.kwargs['username'] or '').strip().lower()
        obj = get_object_or_404(self.get_queryset(), email__iexact=f'{username}@jbnu.ac.kr')
        return obj


@extend_schema(
    tags=["사용자"],
    summary="프로필(Resume) 수정",
    description="본인의 프로필 정보(resume)를 수정합니다.",
    request=ResumeUpdateSerializer
)
class ResumeUpdateView(generics.UpdateAPIView):
    queryset = User.objects.all()
    serializer_class = ResumeUpdateSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)


@extend_schema(
    tags=["사용자"],
    summary="프로필 블록 수정",
    description="본인의 프로필 블록 데이터를 수정합니다.",
    request=ProfileBlocksUpdateSerializer
)
class ProfileBlocksUpdateView(generics.UpdateAPIView):
    queryset = User.objects.all()
    serializer_class = ProfileBlocksUpdateSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)


@extend_schema(
    tags=["사용자"],
    summary="프로필 방식/HTML 수정",
    description="본인의 프로필 방식(blocks/html) 및 업로드된 raw HTML을 수정합니다.",
    request=ProfileHtmlUpdateSerializer
)
class ProfileHtmlUpdateView(generics.UpdateAPIView):
    queryset = User.objects.all()
    serializer_class = ProfileHtmlUpdateSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)
