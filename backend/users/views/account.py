"""회원 탈퇴"""
from django.db import transaction
from django.db.models.deletion import ProtectedError
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken


@extend_schema(
    tags=["사용자"],
    summary="회원 탈퇴",
    description="현재 로그인된 사용자의 계정을 삭제합니다. 이 작업은 되돌릴 수 없습니다.",
    request={
        "application/json": {
            "type": "object",
            "properties": {
                "password": {
                    "type": "string",
                    "description": "현재 비밀번호 확인"
                }
            },
            "required": ["password"]
        }
    },
    responses={
        200: {"description": "회원 탈퇴 성공"},
        400: {"description": "잘못된 요청 또는 비밀번호 불일치"},
        401: {"description": "인증되지 않은 사용자"}
    }
)
class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'delete_account'

    def post(self, request):
        user = request.user
        password = request.data.get('password')

        if not password:
            return Response(
                {"error": "비밀번호를 입력해주세요."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 비밀번호 확인
        if not user.check_password(password):
            return Response(
                {"error": "비밀번호가 올바르지 않습니다."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 사용자 계정 삭제 (참조 보호 제약이 있는 경우 토큰 무효화 전에 409 반환)
        try:
            with transaction.atomic():
                # 모든 리프레시 토큰 블랙리스트 처리
                from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
                try:
                    outstanding_tokens = OutstandingToken.objects.filter(user=user)
                    for token_obj in outstanding_tokens:
                        try:
                            token = RefreshToken(token_obj.token)
                            token.blacklist()
                        except Exception:
                            pass
                except Exception:
                    pass

                user.delete()
        except ProtectedError:
            return Response(
                {"error": "연관된 기록(대회 제출 등)이 있어 계정을 즉시 삭제할 수 없습니다. 운영진에게 문의해주세요."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            {"message": "회원 탈퇴가 완료되었습니다."},
            status=status.HTTP_200_OK
        )
