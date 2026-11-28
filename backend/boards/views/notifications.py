"""알림: 만들기, 목록, 안 읽은 개수, 읽음 처리"""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from ..models import Notification, Post
from ..serializers import NotificationSerializer


def create_notification(recipient, actor, notification_type, post, comment=None):
    """알림을 생성합니다. 본인에게는 알림을 보내지 않습니다."""
    if recipient == actor:
        return None
    return Notification.objects.create(
        recipient=recipient,
        actor=actor,
        notification_type=notification_type,
        post=post,
        comment=comment
    )


def visible_notifications(user):
    """받는 사람의 알림 중 연결된 글을 지금도 읽을 수 있는 것만.
    글의 공개 범위가 바뀐 뒤 예전 알림으로 제목이 보이는 것을 막는다."""
    readable = Post.objects.readable_for_user(user).values('id')
    return Notification.objects.filter(recipient=user, post__in=readable)


@extend_schema(tags=['알림'])
@extend_schema_view(
    get=extend_schema(
        summary="알림 목록 조회",
        description="로그인한 사용자의 알림 목록을 조회합니다.",
    )
)
class NotificationListAPIView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            visible_notifications(self.request.user)
            .select_related('actor', 'post', 'post__board', 'comment')
            .order_by('-created_at')[:50]
        )


@extend_schema(tags=['알림'])
class NotificationUnreadCountAPIView(APIView):
    """읽지 않은 알림 개수를 반환합니다."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="읽지 않은 알림 개수",
        description="로그인한 사용자의 읽지 않은 알림 개수를 반환합니다.",
    )
    def get(self, request):
        count = visible_notifications(request.user).filter(is_read=False).count()
        return Response({'unread_count': count})


@extend_schema(tags=['알림'])
class NotificationMarkReadAPIView(APIView):
    """알림을 읽음으로 표시합니다."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="알림 읽음 처리",
        description="특정 알림 또는 전체 알림을 읽음으로 표시합니다.",
    )
    def post(self, request, notification_id=None):
        if notification_id:
            # 특정 알림 읽음 처리
            notification = get_object_or_404(
                Notification, id=notification_id, recipient=request.user
            )
            notification.is_read = True
            notification.save()
        else:
            # 전체 알림 읽음 처리
            Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'success': True})
