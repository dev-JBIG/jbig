"""비밀번호 변경 이후 기존 Access JWT를 즉시 무효화하는 커스텀 JWT 인증."""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class PasswordAwareJWTAuthentication(JWTAuthentication):
    """user.password_changed_at 이전에 발급된 Access Token을 거부한다."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        password_changed_at = getattr(user, 'password_changed_at', None)
        if password_changed_at is not None:
            iat = validated_token.get('iat')
            if iat is None or int(iat) < int(password_changed_at.timestamp()):
                raise AuthenticationFailed(
                    '비밀번호가 변경되어 다시 로그인해야 합니다.',
                    code='token_not_valid',
                )
        return user
