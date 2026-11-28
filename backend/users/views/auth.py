"""가입, 로그인, 토큰 갱신, 메일 인증과 재전송, 로그아웃"""
import secrets
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import models, transaction
from django.utils import timezone
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.parsers import FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from smtplib import SMTPException
from ..models import EmailVerificationCode, User
from ..serializers import (
    CustomTokenObtainPairSerializer,
    EmailResendSerializer,
    EmailVerificationSerializer,
    MAIL_DELIVERY_ERRORS,
    UserCreateSerializer,
)
from .common import MAX_VERIFICATION_ATTEMPTS, _invalid_verification_response, logger


@extend_schema(
    tags=["사용자"],
    summary="회원가입",
    description="새로운 사용자를 등록합니다. 성공 시 인증 이메일이 발송됩니다.",
    request=UserCreateSerializer,
    responses={
        201: {
            'description': '회원가입 성공',
            'examples': {
                'Success': {
                    'value': {
                        "isSuccess": True,
                        "message": "회원가입에 성공하였습니다. 인증번호를 확인해주세요."
                    }
                }
            }
        },
        400: {
            'description': '잘못된 요청',
            'examples': {
                'Invalid Data': {
                    'value': {
                        "email": [
                            "user with this email already exists."
                        ],
                        "username": [
                            "A user with that username already exists."
                        ]
                    }
                }
            }
        }
    }
)
class SignUpView(generics.CreateAPIView):
    parser_classes = [JSONParser, FormParser]
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'signup'

    def post(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        semester = request.data.get('semester')
        if semester is not None:
            try:
                semester_int = int(semester)
                if semester_int > 100:
                    return Response({
                        "isSuccess": False,
                        "message": "학기는 100 이하여야 합니다."
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({
                    "isSuccess": False,
                    "message": "학기는 유효한 숫자여야 합니다."
                }, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            self.perform_create(serializer)
        except MAIL_DELIVERY_ERRORS:
            # serializer의 atomic 블록을 빠져나와 롤백된 뒤에만 응답한다.
            return Response({
                "isSuccess": False,
                "message": "인증 메일을 보내지 못했습니다. 잠시 후 같은 정보로 다시 가입해주세요."
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        headers = self.get_success_headers(serializer.data)
        
        return Response({
            "isSuccess": True,
            "message": "회원가입에 성공하였습니다. 인증번호를 확인해주세요."
        }, status=status.HTTP_201_CREATED, headers=headers)


@extend_schema(
    tags=["사용자"],
    summary="로그인",
    description="이메일과 비밀번호를 사용하여 로그인하고 JWT 토큰(Access, Refresh)을 발급받습니다.",
    request=CustomTokenObtainPairSerializer,
    responses={
        200: {
            'description': '로그인 성공',
            'examples': {
                'Success': {
                    'value': {
                        "isSuccess": True,
                        "message": "로그인에 성공했습니다.",
                        "username": "testuser",
                        "semester": 1,
                        "is_staff": False,
                        "refresh": "your_refresh_token",
                        "access": "your_access_token"
                    }
                }
            }
        },
        401: {
            'description': '인증 실패',
            'examples': {
                'User Not Found': {
                    'value': {
                        "isSuccess": False,
                        "errorCode": "USER_NOT_FOUND",
                        "message": "존재하지 않는 이메일입니다."
                    }
                },
                'Invalid Password': {
                    'value': {
                        "isSuccess": False,
                        "errorCode": "INVALID_PASSWORD",
                        "message": "비밀번호가 올바르지 않습니다."
                    }
                },
                'Account Not Verified': {
                    'value': {
                        "isSuccess": False,
                        "errorCode": "ACCOUNT_NOT_VERIFIED",
                        "message": "이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요."
                    }
                }
            }
        }
    }
)
class SignInView(TokenObtainPairView):
    parser_classes = [JSONParser, FormParser]
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'signin'

    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class CustomTokenRefreshView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'token_refresh'

    @extend_schema(
        tags=["사용자"],
        summary="JWT 토큰 재발급",
        description="""**Refresh 토큰을 사용하여 새로운 Access 토큰을 발급받습니다.** 
        
- 요청 본문에 유효한 `refresh` 토큰을 포함해야 합니다.
- 성공 시, 새로운 `access` 토큰과 새로운 `refresh` 토큰이 반환됩니다.
- 보안을 위해 한 번 사용된 리프레시 토큰은 만료 처리되고 새로운 리프레시 토큰이 발급됩니다. 클라이언트는 이 새로운 리프레시 토큰을 저장하여 사용해야 합니다.""",
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "refresh": {
                        "type": "string",
                        "description": "The refresh token."
                    }
                },
                "required": ["refresh"]
            }
        },
        responses={
            200: OpenApiExample(
                'Successful Response',
                summary='A successful response.',
                description='새로운 토큰이 성공적으로 반환되었습니다.',
                value={
                    "isSuccess": True,
                    "message": "토큰이 성공적으로 재발급되었습니다.",
                    "access": "new_access_token_string",
                    "refresh": "new_refresh_token_string",
                }
            ),
            400: {"description": "Bad Request - refresh 토큰이 제공되지 않음"},
            401: {"description": "Unauthorized - 제공된 토큰이 유효하지 않거나 만료됨"}
        }
    )
    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh")

        if not refresh_token or not isinstance(refresh_token, str):
            return Response({"error": "Refresh token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            old_token = RefreshToken(refresh_token)
            jti = old_token.get('jti')
            user_id = old_token.get('user_id')

            from rest_framework_simplejwt.token_blacklist.models import (
                BlacklistedToken,
                OutstandingToken,
            )

            with transaction.atomic():
                # 동시 refresh 요청이 같은 토큰으로 2회 재발급되는 레이스 컨디션을 막기 위해
                # OutstandingToken 행에 배타 잠금을 건 뒤 블랙리스트 여부를 검사하고 즉시 블랙리스트한다.
                if jti:
                    outstanding = OutstandingToken.objects.select_for_update().filter(jti=jti).first()
                    if outstanding is not None and BlacklistedToken.objects.filter(token=outstanding).exists():
                        raise AuthenticationFailed('Token is blacklisted', code='token_not_valid')
                    elif BlacklistedToken.objects.filter(token__jti=jti).exists():
                        raise AuthenticationFailed('Token is blacklisted', code='token_not_valid')

                try:
                    user = User.objects.get(id=user_id)
                except User.DoesNotExist:
                    raise AuthenticationFailed('User not found', code='user_not_found')

                if not user.is_active or not user.is_verified:
                    try:
                        old_token.blacklist()
                    except Exception:
                        pass
                    return Response({"error": "Account disabled"}, status=status.HTTP_401_UNAUTHORIZED)

                # 비밀번호 변경 이전에 발급된 리프레시 토큰 차단 (같은 초 포함)
                from ..authentication import is_token_valid_for_password, issue_tokens_for_user
                if not is_token_valid_for_password(old_token, user):
                    try:
                        old_token.blacklist()
                    except Exception:
                        pass
                    return Response(
                        {"error": "Token invalidated by password change"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

                try:
                    old_token.blacklist()
                except AttributeError:
                    pass

                # last_login 업데이트
                user.last_login = timezone.now()
                user.save(update_fields=['last_login'])

                # 비밀번호 지문(pwh)을 포함한 새로운 리프레시 토큰 생성
                new_refresh_token = issue_tokens_for_user(user)

            response_data = {
                "isSuccess": True,
                "message": "토큰이 성공적으로 재발급되었습니다.",
                'access': str(new_refresh_token.access_token),
                'refresh': str(new_refresh_token),
                'username': user.username,
                'email': user.email,
                'semester': user.semester,
                'is_staff': user.is_staff,
            }
            
            return Response(response_data, status=status.HTTP_200_OK)

        except AuthenticationFailed as e:
            detail = e.detail if hasattr(e, 'detail') else str(e)
            return Response({"error": str(detail)}, status=status.HTTP_401_UNAUTHORIZED)
        except TokenError:
            return Response({"error": "Token is invalid or expired."}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception:
            logger.exception("Unexpected error during token refresh")
            return Response({"error": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    tags=["사용자"],
    summary="이메일 인증",
    description="회원가입 후 이메일로 발송된 6자리 인증 코드를 사용하여 이메일 주소를 인증합니다.",
    request=EmailVerificationSerializer,
    responses={
        200: {
            'description': '인증 성공',
            'examples': {
                'Success': {
                    'value': {"message": "Email verified successfully."}
                },
                'Already Verified': {
                    'value': {"message": "This account is already verified."}
                }
            }
        },
        400: {
            'description': '잘못된 요청',
            'examples': {
                'Expired Code': {
                    'value': {"error": "Verification code has expired."}
                },
                'Invalid Code': {
                    'value': {"error": "Invalid verification code."}
                }
            }
        },
        404: {
            'description': '사용자를 찾을 수 없음',
            'examples': {
                'User Not Found': {
                    'value': {"error": "User not found"}
                }
            }
        }
    }
)
class EmailVerifyView(APIView):
    serializer_class = EmailVerificationSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'email_verify'

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        verifyCode = serializer.validated_data['verifyCode']

        # 사용자 존재/상태/코드 유효성을 구분하는 3-way 응답은 회원 enumeration을 허용하므로
        # 성공 여부 외에는 전부 동일한 400으로 통일한다.
        generic_error = _invalid_verification_response()

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return generic_error

        if user.is_verified:
            # 이미 인증된 이메일에 200을 반환하면 이메일 존재 여부 오라클이 되므로 동일한 400으로 통일한다.
            return generic_error

        with transaction.atomic():
            try:
                verification_code_obj = EmailVerificationCode.objects.select_for_update().get(user=user)
            except EmailVerificationCode.DoesNotExist:
                return generic_error

            if (timezone.now() - verification_code_obj.created_at).total_seconds() > 300:
                verification_code_obj.delete()
                return generic_error

            if not check_password(verifyCode, verification_code_obj.code):
                verification_code_obj.attempt_count = models.F('attempt_count') + 1
                verification_code_obj.save(update_fields=['attempt_count'])
                verification_code_obj.refresh_from_db()
                if verification_code_obj.attempt_count >= MAX_VERIFICATION_ATTEMPTS:
                    verification_code_obj.delete()
                return generic_error

            # 신규 가입 인증: 아직 한 번도 인증된 적 없는 계정만 활성화한다.
            user.is_verified = True
            user.is_active = True
            user.save(update_fields=['is_verified', 'is_active'])
            verification_code_obj.delete()

        return Response({"message": "Email verified successfully."}, status=status.HTTP_200_OK)


class ResendVerificationEmailView(APIView):
    serializer_class = EmailResendSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset_request'

    @extend_schema(
        tags=["사용자"],
        summary="인증 이메일 재전송",
        description="인증 이메일을 재전송합니다. 사용자가 인증 코드를 받지 못했거나 코드가 만료된 경우 사용됩니다. 존재 여부와 관계없이 동일한 응답을 반환합니다.",
    )
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()

        generic_response = Response(
            {"message": "A new verification email has been sent if the account exists and is pending verification."},
            status=status.HTTP_200_OK,
        )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return generic_response

        if user.is_verified:
            return generic_response

        code = f'{secrets.randbelow(1_000_000):06d}'
        hashed_code = make_password(code)

        try:
            with transaction.atomic():
                EmailVerificationCode.objects.update_or_create(
                    user=user,
                    defaults={'code': hashed_code, 'created_at': timezone.now(), 'attempt_count': 0},
                )

                subject = '[JBIG] Your New Verification Code'
                message = f'Your new verification code is: {code}'
                if send_mail(subject, message, None, [user.email]) == 0:
                    raise SMTPException('Verification email was not accepted')
        except MAIL_DELIVERY_ERRORS:
            return Response({
                "message": "인증 메일을 보내지 못했습니다. 잠시 후 다시 재전송해주세요."
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return generic_response


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["사용자"],
        summary="로그아웃",
        description="사용자를 로그아웃 처리합니다. 요청 본문에 제공된 리프레시 토큰을 블랙리스트에 추가하여 더 이상 사용할 수 없게 만듭니다.",
        request= {
            "application/json": {
                "type": "object",
                "properties": {
                    "refresh": {
                        "type": "string",
                        "description": "블랙리스트에 추가할 리프레시 토큰"
                    }
                },
                "required": ["refresh"]
            }
        },
        responses={
            205: {"description": "로그아웃 성공"},
            400: {"description": "잘못된 요청 - 토큰이 유효하지 않거나 누락됨"}
        }
    )
    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
        except (KeyError, TypeError):
            return Response(status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
        except Exception:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        # 본인 리프레시 토큰만 블랙리스트 처리한다.
        if token.get('user_id') != request.user.id:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        try:
            token.blacklist()
        except Exception:
            # 이미 블랙리스트됐거나 outstanding이 없는 경우 — 사용자 관점에선 성공.
            pass
        return Response(status=status.HTTP_205_RESET_CONTENT)
