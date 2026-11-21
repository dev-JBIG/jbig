"""로컬 개발 환경에서 presigned URL 대신 파일을 직접 받는 뷰."""
from django.conf import settings
from django.http import HttpResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .storage import is_safe_upload_key, save_local_file

MAX_LOCAL_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB


@method_decorator(csrf_exempt, name='dispatch')
class LocalFileUploadView(View):
    """
    PUT 요청으로 파일 바이너리를 받아 media/ 에 저장한다.
    스토리지 presigned URL처럼 인증 없이 동작 (로컬 전용).
    """

    def put(self, request, file_key):
        if not settings.USE_LOCAL_STORAGE:
            return HttpResponse("Local upload is disabled.", status=404)

        if not is_safe_upload_key(file_key):
            return HttpResponse("Invalid file path.", status=400)

        content_length = request.META.get('CONTENT_LENGTH')
        if content_length:
            try:
                if int(content_length) > MAX_LOCAL_UPLOAD_BYTES:
                    return HttpResponse("File too large.", status=413)
            except (TypeError, ValueError):
                return HttpResponse("Invalid Content-Length.", status=400)

        body = request.body
        if not body:
            return HttpResponse("Empty body.", status=400)
        if len(body) > MAX_LOCAL_UPLOAD_BYTES:
            return HttpResponse("File too large.", status=413)

        try:
            save_local_file(file_key, body)
        except ValueError:
            return HttpResponse("Invalid file path.", status=400)
        return HttpResponse(status=200)
