"""비밀번호 변경 이후 기존 Access/Refresh JWT를 같은 초 안에서도 즉시 무효화하는 인증 유틸리티."""
import hashlib
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken


def password_fingerprint(user) -> str:
    """현재 비밀번호 해시에서 짧은 지문(16 hex)을 도출한다(원문/해시 비노출)."""
    return hashlib.sha256((getattr(user, 'password', '') or '').encode('utf-8')).hexdigest()[:16]


def issue_tokens_for_user(user) -> RefreshToken:
    """현재 비밀번호 지문(pwh)을 포함한 RefreshToken(및 파생 AccessToken)을 발급한다."""
    refresh = RefreshToken.for_user(user)
    refresh['pwh'] = password_fingerprint(user)
    return refresh


def is_token_valid_for_password(token, user) -> bool:
    """비밀번호 변경 이전에 발급된 토큰인지(같은 초 포함) 판정한다."""
    token_pwh = token.get('pwh')
    if token_pwh is not None:
        if token_pwh != password_fingerprint(user):
            return False

    password_changed_at = getattr(user, 'password_changed_at', None)
    if password_changed_at is not None:
        iat = token.get('iat')
        if iat is None:
            return False
        changed_ts = int(password_changed_at.timestamp())
        # pwh 클레임이 없는 레거시 토큰은 같은 초(<=) 발급분도 보수적으로 차단한다.
        if token_pwh is None:
            if int(iat) <= changed_ts:
                return False
        elif int(iat) < changed_ts:
            return False
    return True


class PasswordAwareJWTAuthentication(JWTAuthentication):
    """user.password 또는 password_changed_at 변경 이전에 발급된 Access Token을 즉시 거부한다."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not is_token_valid_for_password(validated_token, user):
            raise AuthenticationFailed(
                '비밀번호가 변경되어 다시 로그인해야 합니다.',
                code='token_not_valid',
            )
        return user
