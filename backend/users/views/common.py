"""회원 뷰 공통: 로거, 인증 코드 시도 횟수, 인증 실패 공통 응답"""
import logging
from rest_framework import status
from rest_framework.response import Response


MAX_VERIFICATION_ATTEMPTS = 5

logger = logging.getLogger(__name__)

def _invalid_verification_response():
    """인증 코드 확인 실패 응답. 계정 유무, 인증 상태, 코드 만료를 구분하지 않는 한 가지 400
    (회원 열거 방지). 응답 객체는 요청마다 새로 만든다."""
    return Response(
        {"error": "인증 정보가 유효하지 않거나 만료되었습니다."},
        status=status.HTTP_400_BAD_REQUEST,
    )
