"""댓글: 목록(트리), 작성, 수정, 삭제, 좋아요"""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from jbig_backend.network import get_client_ip
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from ..models import Comment, Notification, Post
from ..permissions import IsCommentWritable, IsOwnerOrReadOnly
from ..serializers import CommentSerializer, CommentTreeListMixin
from .common import verify_turnstile
from .notifications import create_notification


@extend_schema(
    tags=['댓글'],
    summary="댓글 좋아요/취소",
    description="특정 댓글에 좋아요를 추가하거나 취소합니다. 이미 좋아요를 누른 상태에서 요청하면 좋아요가 취소됩니다. 좋아요 추가 시 댓글 작성자에게 알림이 전송됩니다.",
    responses={
        200: {
            'description': '좋아요 상태 변경 성공',
            'examples': {
                '좋아요 추가': {
                    'value': {'likes': 5, 'isLiked': True}
                },
                '좋아요 취소': {
                    'value': {'likes': 4, 'isLiked': False}
                }
            }
        }
    }
)
class CommentLikeAPIView(generics.GenericAPIView):
    queryset = Comment.objects.all()
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = 'comment_id'

    def get_queryset(self):
        readable_posts = Post.objects.readable_for_user(self.request.user)
        return Comment.objects.filter(post__in=readable_posts)

    def post(self, request, *args, **kwargs):
        comment = self.get_object()
        user = request.user

        try:
            like = comment.likes.through.objects.get(user=user, comment=comment)
            like.delete()
            is_liked = False
        except comment.likes.through.DoesNotExist:
            comment.likes.add(user)
            is_liked = True
            # 댓글 좋아요 추가 시에만 알림 생성 (비회원 댓글 제외)
            if comment.author:
                create_notification(
                    recipient=comment.author,
                    actor=user,
                    notification_type=Notification.NotificationType.COMMENT_LIKE,
                    post=comment.post,
                    comment=comment
                )

        likes_count = comment.likes.count()
        return Response({'likes': likes_count, 'isLiked': is_liked}, status=status.HTTP_200_OK)



@extend_schema(tags=['댓글'])
@extend_schema_view(
    get=extend_schema(summary="댓글 목록 조회"),
    post=extend_schema(
        summary="댓글 생성",
        description="""특정 게시글에 새로운 댓글을 작성합니다.\n- **권한 (Board Level)**: 게시판의 `comment_permission` 설정에 따라 접근이 제어됩니다.\n  - `all`: 비회원 포함 누구나 작성 가능\n  - `staff`: 스태프만 작성 가능\n- **비회원 댓글**: 비회원은 자동으로 IP 기반 익명 닉네임이 부여됩니다.\n- **회원 익명 작성**: 회원은 `is_anonymous` 필드를 true로 설정하면 익명으로 작성됩니다 (기본값: true).""",
    )
)
class CommentListCreateAPIView(CommentTreeListMixin, generics.ListCreateAPIView):
    serializer_class = CommentSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsCommentWritable()]
        return [AllowAny()]

    def get_queryset(self):
        post_id = self.kwargs.get('post_id')
        # 게시판 read_permission(회원전용/스태프)까지 적용해, 글을 못 보는 사용자가
        # 댓글만 따로 읽어가는 우회를 막는다.
        readable_posts = Post.objects.readable_for_user(self.request.user)
        return Comment.objects.filter(
            post_id=post_id,
            post__in=readable_posts,
            parent__isnull=True,
        ).order_by('created_at', 'id')

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError

        post_id = self.kwargs.get('post_id')
        # 비공개 게시글/게시판에 대한 댓글 작성·존재 확인을 모두 막는다.
        readable_posts = Post.objects.readable_for_user(self.request.user)
        post = get_object_or_404(readable_posts, pk=post_id)

        # parent는 반드시 동일 게시글의 댓글이어야 하며, 대댓글은 1단계(depth 1)까지만 허용한다.
        parent = serializer.validated_data.get('parent')
        if parent is not None:
            if parent.post_id != post.id:
                raise ValidationError({'parent': '다른 게시글의 댓글은 부모가 될 수 없습니다.'})
            if parent.parent_id is not None:
                raise ValidationError({'parent': '대댓글에는 다시 대댓글을 달 수 없습니다.'})

        is_anonymous = serializer.validated_data.get('is_anonymous', True)

        # 비회원인 경우 author=None으로 저장
        if self.request.user.is_authenticated:
            comment = serializer.save(author=self.request.user, post=post, is_anonymous=is_anonymous)

            # 알림 생성 (회원만)
            if comment.parent and comment.parent.author:
                # 대댓글인 경우: 부모 댓글 작성자에게 알림
                create_notification(
                    recipient=comment.parent.author,
                    actor=self.request.user,
                    notification_type=Notification.NotificationType.REPLY,
                    post=post,
                    comment=comment
                )
            elif post.author:
                # 일반 댓글인 경우: 게시글 작성자에게 알림
                create_notification(
                    recipient=post.author,
                    actor=self.request.user,
                    notification_type=Notification.NotificationType.COMMENT,
                    post=post,
                    comment=comment
                )
        else:
            # 비회원 댓글 - 신뢰 프록시 기준 검증된 IP 주소 추출
            ip = get_client_ip(self.request) or '0.0.0.0'

            # Turnstile CAPTCHA 검증
            turnstile_token = self.request.data.get('turnstile_token')
            if not verify_turnstile(turnstile_token, ip):
                raise ValidationError({'detail': 'CAPTCHA 검증에 실패했습니다. 다시 시도해주세요.'})

            comment = serializer.save(author=None, post=post, is_anonymous=is_anonymous, guest_id=ip)

            # 비회원 댓글 알림 (글 작성자에게)
            if post.author:
                create_notification(
                    recipient=post.author,
                    actor=None,  # 비회원이므로 actor 없음
                    notification_type=Notification.NotificationType.COMMENT,
                    post=post,
                    comment=comment
                )

@extend_schema(tags=['댓글'])
@extend_schema_view(
    put=extend_schema(summary="댓글 수정", description="작성자 또는 스태프만 댓글을 수정할 수 있습니다."),
    patch=extend_schema(summary="댓글 부분 수정", description="작성자 또는 스태프만 댓글을 부분 수정할 수 있습니다."),
    delete=extend_schema(summary="댓글 삭제", description="작성자 또는 스태프만 댓글을 삭제할 수 있습니다.")
)
class CommentUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [IsOwnerOrReadOnly]
    lookup_url_kwarg = 'comment_id'

    def get_queryset(self):
        readable_posts = Post.objects.readable_for_user(self.request.user)
        return Comment.objects.filter(post__in=readable_posts)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()
