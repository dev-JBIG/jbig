"""비밀번호 찾기(코드 요청, 확인, 재설정)와 비밀번호 변경"""
import pytz
import secrets
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import models, transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from smtplib import SMTPException
from ..models import EmailVerificationCode, User
from ..password_reset_token import ResetTokenError, consume_reset_token, issue_reset_token
from ..serializers import (
    PasswordChangeSerializer,
    PasswordResetRequestSerializer,
    PasswordResetSerializer,
    VerifyPasswordCodeSerializer,
)
from .common import MAX_VERIFICATION_ATTEMPTS, _invalid_verification_response, logger


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset_request'

    @extend_schema(
        tags=["사용자"],
        summary="비밀번호 재설정 인증코드 요청",
        description=(
            "이메일로 인증 코드를 요청하여 비밀번호 재설정을 시작합니다. "
            "사용자 열거 방지를 위해 이메일 존재 여부와 관계없이 동일한 200 응답을 반환합니다."
        ),
        request=PasswordResetRequestSerializer,
        responses={
            200: {"description": "이메일이 등록되어 있다면 인증 코드가 발송됩니다."},
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()

        generic_response = Response(
            {"message": "입력하신 이메일이 등록되어 있다면 인증 코드가 발송됩니다."},
            status=status.HTTP_200_OK,
        )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return generic_response

        if not user.is_active or not user.is_verified:
            return generic_response

        code = f'{secrets.randbelow(1_000_000):06d}'
        hashed_code = make_password(code)

        try:
            with transaction.atomic():
                EmailVerificationCode.objects.update_or_create(
                    user=user,
                    defaults={'code': hashed_code, 'created_at': timezone.now(), 'attempt_count': 0},
                )

                subject = '[JBIG] 비밀번호 변경 인증 코드'
                message = f'요청하신 비밀번호 변경 인증 코드는 다음과 같습니다: {code}'
                if send_mail(subject, message, None, [user.email]) == 0:
                    raise SMTPException('Password reset email was not accepted')
        except Exception as exc:
            # 메일 전송 장애 시에도 미등록 이메일과 동일한 200 응답을 반환해 계정 열거 오라클을 차단한다.
            logger.error("Password reset email delivery failed for user_id=%s: %s", user.id, exc)
            return generic_response

        return generic_response


class VerifyPasswordCodeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset_verify'

    @extend_schema(
        tags=["사용자"],
        summary="비밀번호 재설정 인증코드 확인",
        description=(
            "이메일로 전송된 인증 코드를 확인하고, "
            "비밀번호 재설정에 사용할 단기 토큰(reset_token)을 발급합니다. "
            "발급된 토큰은 10분 동안 유효하며 PasswordResetView 호출 시 필수입니다."
        ),
        request=VerifyPasswordCodeSerializer,
        responses={
            200: {"description": "인증 코드가 확인되었습니다. 응답 본문에 reset_token이 포함됩니다."},
            400: {"description": "잘못된 요청 또는 유효하지 않은 인증 코드"}
        }
    )
    def post(self, request, *args, **kwargs):
        serializer = VerifyPasswordCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].strip().lower()
        verification_code = serializer.validated_data['verification_code']

        # 사용자 열거 및 코드 상태 노출을 방지하기 위해 실패 경로 응답을 단일화한다.
        generic_error = _invalid_verification_response()

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return generic_error

        if not user.is_active or not user.is_verified:
            return generic_error

        with transaction.atomic():
            try:
                verification_code_obj = EmailVerificationCode.objects.select_for_update().get(user=user)
            except EmailVerificationCode.DoesNotExist:
                return generic_error

            if (timezone.now() - verification_code_obj.created_at).total_seconds() > 300:
                verification_code_obj.delete()
                return generic_error

            if not check_password(verification_code, verification_code_obj.code):
                verification_code_obj.attempt_count = models.F('attempt_count') + 1
                verification_code_obj.save(update_fields=['attempt_count'])
                verification_code_obj.refresh_from_db()
                if verification_code_obj.attempt_count >= MAX_VERIFICATION_ATTEMPTS:
                    verification_code_obj.delete()
                return generic_error

            reset_token, expires_in = issue_reset_token(user, request=request)

            # 인증코드는 재설정 토큰으로 교체되므로 즉시 제거한다.
            verification_code_obj.delete()

        return Response(
            {
                "message": "인증 코드가 확인되었습니다.",
                "reset_token": reset_token,
                "expires_in": expires_in,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    @extend_schema(
        tags=["사용자"],
        summary="새 비밀번호로 재설정",
        description="인증코드 확인 후 새로운 비밀번호를 설정합니다.",
        request=PasswordResetSerializer,
        responses={
            200: {"description": "비밀번호가 성공적으로 변경되었습니다."},
            400: {"description": "잘못된 요청"}
        }
    )
    def post(self, request, *args, **kwargs):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].strip().lower()
        reset_token = serializer.validated_data['reset_token']
        new_password = serializer.validated_data['new_password1']

        try:
            user = consume_reset_token(reset_token, expected_email=email)
        except ResetTokenError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError

        try:
            validate_password(new_password, user=user)
        except ValidationError as e:
            return Response({"error": e.messages}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.password_changed_at = timezone.now()
        user.save()

        # 인증 코드 삭제
        EmailVerificationCode.objects.filter(user=user).delete()

        # 비밀번호 변경 시 모든 리프레시 토큰 블랙리스트 처리하여 강제 로그아웃
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
        try:
            outstanding_tokens = OutstandingToken.objects.filter(user=user)
            for token_obj in outstanding_tokens:
                try:
                    token = RefreshToken(token_obj.token)
                    token.blacklist()
                except Exception:
                    # 이미 블랙리스트에 있거나 만료된 토큰은 무시
                    pass
        except Exception:
            # 블랙리스트 앱이 없거나 오류 발생 시 무시
            pass

        return Response({"message": "비밀번호가 성공적으로 변경되었습니다."},
                        status=status.HTTP_200_OK)


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_change'

    @extend_schema(
        tags=["사용자"],
        summary="[마이페이지] 현재 비밀번호로 변경",
        description="**로그인된 사용자가 현재 비밀번호를 사용하여 새 비밀번호로 변경합니다.**\n- 마이페이지 등에서 사용됩니다.",
        request=PasswordChangeSerializer,
        responses={
            200: {"description": "비밀번호가 성공적으로 변경되었습니다."},
            400: {"description": "잘못된 요청 또는 기존 비밀번호가 일치하지 않음"},
        }
    )
    def post(self, request):
        user = request.user
        kst = pytz.timezone('Asia/Seoul')
        now = timezone.now().astimezone(kst)

        if user.password_changed_at:
            last_changed_kst = user.password_changed_at.astimezone(kst)
            if now.date() == last_changed_kst.date():
                return Response({"error": "비밀번호는 하루에 한 번만 변경할 수 있습니다."},
                                status=status.HTTP_400_BAD_REQUEST)

        serializer = PasswordChangeSerializer(data=request.data)
        if serializer.is_valid():
            if not user.check_password(serializer.validated_data['old_password']):
                return Response({"error": "기존 비밀번호가 올바르지 않습니다."},
                                status=status.HTTP_400_BAD_REQUEST)

            from django.contrib.auth.password_validation import validate_password
            from django.core.exceptions import ValidationError

            try:
                validate_password(serializer.validated_data['new_password1'], user=user)
            except ValidationError as e:
                return Response({"error": e.messages}, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(serializer.validated_data['new_password1'])
            user.password_changed_at = timezone.now()
            user.save()

            # 비밀번호 변경 시 모든 리프레시 토큰 블랙리스트 처리하여 강제 로그아웃
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
            try:
                outstanding_tokens = OutstandingToken.objects.filter(user=user)
                for token_obj in outstanding_tokens:
                    try:
                        token = RefreshToken(token_obj.token)
                        token.blacklist()
                    except Exception:
                        # 이미 블랙리스트에 있거나 만료된 토큰은 무시
                        pass
            except Exception:
                # 블랙리스트 앱이 없거나 오류 발생 시 무시
                pass

            return Response({"message": "비밀번호가 성공적으로 변경되었습니다."},
                            status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
