import os
import json
import logging

from django.http import JsonResponse
from django.conf import settings

logger = logging.getLogger(__name__)

from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiExample
from drf_spectacular.types import OpenApiTypes

from rest_framework.decorators import action

from .models import CalendarEvent, SiteSettings, Popup, PopupDismiss
from .serializers import CalendarEventSerializer, PopupSerializer
from .permissions import IsStaffOrReadOnly


def version_info(request):
    """배포된 버전 정보 반환 (commit hash, branch, deploy time)"""
    version_file = os.path.join(settings.BASE_DIR, 'VERSION.json')
    try:
        with open(version_file, 'r') as f:
            data = json.load(f)
            return JsonResponse(data)
    except FileNotFoundError:
        return JsonResponse({'error': 'VERSION.json not found', 'commit': 'unknown'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid VERSION.json'}, status=500)

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator

_HTTP_URL_VALIDATOR = URLValidator(schemes=['http', 'https'])


def _validate_http_url(value: str) -> str:
    cleaned = (value or '').strip()
    _HTTP_URL_VALIDATOR(cleaned)
    return cleaned


@extend_schema(
    summary="Quiz URL Management",
    description="Retrieve or update the quiz URL. Only admins can update the URL.",
)
class QuizUrlView(APIView):
    def get_permissions(self):
        if self.request.method == 'PUT':
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
        examples=[
            OpenApiExample(
                "Example Response",
                value={"quiz_url": "https://forms.gle/example123"},
                response_only=True
            )
        ]
    )
    def get(self, request):
        url = SiteSettings.get('quiz_url', '')
        return Response({'quiz_url': url or None})

    @extend_schema(
        request={
            'application/json': {
                'type': 'object',
                'properties': {'quiz_url': {'type': 'string', 'format': 'uri'}},
                'required': ['quiz_url']
            }
        },
        responses={200: OpenApiTypes.OBJECT}
    )
    def put(self, request):
        url = request.data.get('quiz_url')
        if not url or not isinstance(url, str):
            return Response({'error': 'quiz_url is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            url = _validate_http_url(url)
        except DjangoValidationError:
            return Response({'error': 'quiz_url must be a valid http(s) URL.'}, status=status.HTTP_400_BAD_REQUEST)
        SiteSettings.set('quiz_url', url)
        return Response({'message': 'Quiz URL updated successfully', 'quiz_url': url})


@extend_schema(
    summary="Site Settings Management",
    description="Retrieve or update site settings. Only admins can update.",
)
class SiteSettingsView(APIView):
    PUBLIC_KEYS = (
        'notion_page_id', 'jbig_description',
        'jbig_president', 'jbig_president_dept',
        'jbig_vice_president', 'jbig_vice_president_dept',
        'jbig_email', 'jbig_advisor', 'jbig_advisor_dept',
    )

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsAdminUser()]
        return [AllowAny()]

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
        examples=[
            OpenApiExample(
                "Example Response",
                value={
                    "notion_page_id": "abc123",
                    "quiz_url": "https://forms.gle/...",
                    "jbig_description": "'JBIG'(JBNU Big Data & AI Group)은 데이터 사이언스와 딥러닝, 머신러닝을 포함한 AI에 대한 학술 교류를 목표로 2021년 설립된 전북대학교의 학생 학회입니다.",
                    "jbig_president": "박성현",
                    "jbig_president_dept": "전자공학부",
                    "jbig_vice_president": "국환",
                    "jbig_vice_president_dept": "사회학과",
                    "jbig_email": "green031234@naver.com",
                    "jbig_advisor": "최규빈 교수님",
                    "jbig_advisor_dept": "통계학과"
                },
                response_only=True
            )
        ]
    )
    def get(self, request):
        # 설정 값들을 쿼리 한 번으로 읽는다. 퀴즈 주소는 로그인한 회원에게만 준다
        keys = self.PUBLIC_KEYS + (('quiz_url',) if request.user.is_authenticated else ())
        values = SiteSettings.get_many(keys)
        return Response({
            'notion_page_id': values['notion_page_id'],
            'quiz_url': values.get('quiz_url', ''),
            **{key: values[key] for key in self.PUBLIC_KEYS if key != 'notion_page_id'},
        })

    @extend_schema(
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'notion_page_id': {'type': 'string'},
                    'quiz_url': {'type': 'string', 'format': 'uri'},
                    'jbig_description': {'type': 'string'},
                    'jbig_president': {'type': 'string'},
                    'jbig_president_dept': {'type': 'string'},
                    'jbig_vice_president': {'type': 'string'},
                    'jbig_vice_president_dept': {'type': 'string'},
                    'jbig_email': {'type': 'string', 'format': 'email'},
                    'jbig_advisor': {'type': 'string'},
                    'jbig_advisor_dept': {'type': 'string'}
                }
            }
        },
        responses={200: OpenApiTypes.OBJECT}
    )
    def put(self, request):
        from django.db import transaction

        pending = {}
        fields = [
            'notion_page_id', 'quiz_url', 'jbig_description', 'jbig_president', 'jbig_president_dept',
            'jbig_vice_president', 'jbig_vice_president_dept', 'jbig_email',
            'jbig_advisor', 'jbig_advisor_dept'
        ]
        
        for field in fields:
            if field in request.data:
                val = request.data[field]
                if val is None:
                    val = ''
                if not isinstance(val, str):
                    return Response({'error': f'{field} must be a string.'}, status=status.HTTP_400_BAD_REQUEST)
                val = val.strip()
                if field == 'quiz_url' and val:
                    try:
                        val = _validate_http_url(val)
                    except DjangoValidationError:
                        return Response({'error': 'quiz_url must be a valid http(s) URL.'}, status=status.HTTP_400_BAD_REQUEST)
                if field == 'jbig_email' and val:
                    from django.core.validators import EmailValidator
                    try:
                        EmailValidator()(val)
                    except DjangoValidationError:
                        return Response({'error': 'jbig_email must be a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)
                pending[field] = val
        
        if not pending:
            return Response({'error': 'No valid fields provided'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for field, val in pending.items():
                SiteSettings.set(field, val)
        return Response({'message': 'Settings updated', **pending})

class NotionPageView(APIView):
    """Notion 내부 API 프록시 (splitbee 대체)"""
    permission_classes = [IsAuthenticated]
    throttle_scope = 'notion'

    def get(self, request, page_id):
        import re
        clean = re.sub(r'[^a-fA-F0-9]', '', page_id)
        if len(clean) != 32:
            return Response({'error': '잘못된 페이지 ID입니다.'}, status=status.HTTP_400_BAD_REQUEST)

        from .notion import diagnostic_headers, fetch_page, new_request_diagnostics

        diagnostics = new_request_diagnostics(clean)
        try:
            record_map = fetch_page(clean, diagnostics=diagnostics)
            response = Response(record_map)
        except Exception as e:
            logger.error(f'Notion API error: {e}')
            response = Response({'error': '페이지를 불러올 수 없습니다.'}, status=status.HTTP_502_BAD_GATEWAY)

        if settings.DEBUG or request.user.is_staff:
            for header, value in diagnostic_headers(diagnostics).items():
                response[header] = value
        return response


@extend_schema(tags=['Calendar'])
class CalendarEventViewSet(viewsets.ModelViewSet):
    serializer_class = CalendarEventSerializer
    permission_classes = [IsStaffOrReadOnly]
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def get_queryset(self):
        return CalendarEvent.objects.all()


@extend_schema(tags=['Popup'])
class PopupViewSet(viewsets.ModelViewSet):
    """팝업 관리 ViewSet"""
    serializer_class = PopupSerializer
    permission_classes = [IsStaffOrReadOnly]
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def get_queryset(self):
        from django.utils import timezone
        queryset = Popup.objects.all()

        if not self.request.user.is_staff:
            now = timezone.now()
            queryset = queryset.filter(
                is_active=True,
                start_date__lte=now,
                end_date__gte=now
            )

        # dismiss 필터링은 staff 포함 모든 로그인 사용자에게 적용
        if self.request.user.is_authenticated:
            dismissed_ids = PopupDismiss.objects.filter(
                user=self.request.user
            ).values_list('popup_id', flat=True)
            queryset = queryset.exclude(id__in=dismissed_ids)

        return queryset.order_by('order', '-created_at')

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def dismiss(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        popup = get_object_or_404(Popup, pk=pk)
        PopupDismiss.objects.get_or_create(user=request.user, popup=popup)
        return Response({'status': 'dismissed'})
