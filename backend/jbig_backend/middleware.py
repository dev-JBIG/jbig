"""방어적 보안 응답 헤더 미들웨어."""


class SecurityHeadersMiddleware:
    """모든 응답에 기본 보안 헤더를 보강한다.

    개별 뷰가 이미 설정한 헤더(예: MediaStreamView의 sandbox CSP)는 덮어쓰지 않는다.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault('X-Content-Type-Options', 'nosniff')
        response.setdefault('Referrer-Policy', 'same-origin')
        response.setdefault(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        )
        # API JSON/파일 응답에는 스크립트 실행을 원천 차단하는 최소 CSP 부여
        # (Swagger/ReDoc/Django Admin UI는 자체 정적 자산이 필요하므로 제외)
        path = request.path or ''
        if path.startswith('/api/') and not path.startswith(('/api/schema', '/api/docs')):
            response.setdefault(
                'Content-Security-Policy',
                "default-src 'none'; frame-ancestors 'none'",
            )
        return response
