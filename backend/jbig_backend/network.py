"""신뢰할 수 있는 프록시 홉 수 기반의 안전한 클라이언트 IP 추출 유틸리티."""
import ipaddress
from django.conf import settings


def _parse_valid_ip(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    candidate = raw.strip()
    if not candidate:
        return None
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return None


def get_client_ip(request) -> str | None:
    """DRF NUM_PROXIES 설정과 동일한 기준으로 검증된 클라이언트 IP를 반환한다.

    X-Forwarded-For 왼쪽 끝(클라이언트가 임의로 주입 가능)이 아니라,
    신뢰 프록시 홉 수(NUM_PROXIES)만큼 오른쪽에서 역산한 IP를 선택해 IP 스푸핑을 막는다.
    유효한 IP 형식이 아니면 REMOTE_ADDR로 안전하게 폴백한다.
    """
    if request is None:
        return None

    num_proxies = getattr(settings, 'REST_FRAMEWORK', {}).get('NUM_PROXIES', 0) or 0
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if num_proxies > 0 and xff:
        hops = [part.strip() for part in xff.split(',') if part.strip()]
        if hops:
            index = max(0, len(hops) - num_proxies)
            valid = _parse_valid_ip(hops[index])
            if valid:
                return valid

    return _parse_valid_ip(request.META.get('REMOTE_ADDR'))
