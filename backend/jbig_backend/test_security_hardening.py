"""보안 하드닝 회귀 테스트 스위트."""
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from boards.models import Board, Category, Comment, Post
from boards.serializers import is_post_media_gated, sanitize_markdown
from boards.views import make_media_stream_token, verify_turnstile
from jbig_backend.models import SiteSettings
from jbig_backend.network import get_client_ip
from jbig_backend.storage import delete_file, is_safe_upload_key, save_local_file

User = get_user_model()


class SecurityHardeningTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name='보안테스트')
        self.public_board = Board.objects.create(
            name='공개게시판', category=self.category,
            read_permission='all', post_permission='all', comment_permission='all',
        )
        self.member_board = Board.objects.create(
            name='회원게시판', category=self.category,
            read_permission='member', post_permission='all', comment_permission='all',
        )
        self.author_board = Board.objects.create(
            name='작성자전용게시판', category=self.category,
            read_permission='author', post_permission='all', comment_permission='all',
        )
        self.staff_board = Board.objects.create(
            name='스태프게시판', category=self.category,
            read_permission='staff', post_permission='staff', comment_permission='staff',
        )

        self.alice = User.objects.create_user(
            email='alice@jbnu.ac.kr', username='AliceRealName',
            password='StrongPassword!9', semester=1,
            is_active=True, is_verified=True,
        )
        self.bob = User.objects.create_user(
            email='bob@jbnu.ac.kr', username='BobRealName',
            password='StrongPassword!9', semester=2,
            is_active=True, is_verified=True,
        )
        self.staff = User.objects.create_user(
            email='staff@jbnu.ac.kr', username='StaffUser',
            password='StrongPassword!9', semester=1,
            is_active=True, is_verified=True, is_staff=True,
        )

    # ── [BC-1] MediaStreamView Same-Origin Stored XSS 방어 ────────────────
    def test_media_stream_blocks_non_image_extensions_even_with_valid_token(self):
        for key in (
            f'uploads/2026/11/21/{self.alice.id}/payload.html',
            f'uploads/2026/11/21/{self.alice.id}/vector.svg',
            f'uploads/2026/11/21/{self.alice.id}/doc.pdf',
        ):
            token = make_media_stream_token(key)
            res = self.client.get(reverse('media-stream'), {'token': token})
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN, msg=key)

    def test_media_stream_ignores_s3_html_content_type_and_sets_sandbox_headers(self):
        img_key = f'uploads/2026/11/21/{self.alice.id}/photo.png'
        token = make_media_stream_token(img_key)
        fake_stream = (BytesIO(b'\x89PNG\r\n\x1a\n'), 'text/html; charset=utf-8', 8)
        with patch('boards.views.get_file_stream', return_value=fake_stream):
            res = self.client.get(reverse('media-stream'), {'token': token})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Content-Type'], 'image/png')
        self.assertEqual(res['X-Content-Type-Options'], 'nosniff')
        self.assertIn('sandbox', res['Content-Security-Policy'])

    # ── [BC-2] Path Traversal 차단 ───────────────────────────────────────
    def test_storage_rejects_path_traversal(self):
        bad_keys = [
            'uploads/2026/01/01/1/../../../../../etc/passwd',
            '../secret.txt',
            '/etc/passwd',
            'uploads/2026/01/01/1/file.png\x00.txt',
            'uploads\\2026\\..\\evil.png',
        ]
        for key in bad_keys:
            self.assertFalse(is_safe_upload_key(key), msg=key)
            self.assertFalse(delete_file(key), msg=key)
            with self.assertRaises(ValueError):
                save_local_file(key, b'data')

    def test_delete_and_confirm_file_reject_path_traversal(self):
        self.client.force_authenticate(user=self.alice)
        traversal = f'uploads/2026/11/21/{self.alice.id}/../../../../etc/passwd'
        res_del = self.client.delete(reverse('file-delete'), {'path': traversal}, format='json')
        self.assertEqual(res_del.status_code, status.HTTP_400_BAD_REQUEST)
        res_conf = self.client.post(reverse('file-confirm-upload'), {'file_key': traversal}, format='json')
        self.assertEqual(res_conf.status_code, status.HTTP_400_BAD_REQUEST)

    # ── [BH-3] 댓글 수정 BOLA & parent 변조 차단 ─────────────────────────
    def test_post_author_cannot_edit_or_delete_other_member_comment(self):
        post = Post.objects.create(
            author=self.alice, board=self.public_board, title='글', content_md='본문'
        )
        bob_comment = Comment.objects.create(post=post, author=self.bob, content='밥 댓글')
        guest_comment = Comment.objects.create(post=post, author=None, guest_id='1.2.3.4', content='비회원 댓글')

        self.client.force_authenticate(user=self.alice)
        # 글 작성자는 다른 회원의 댓글을 수정하거나 삭제할 수 없다.
        patch_res = self.client.patch(
            reverse('comment-detail-update-destroy', kwargs={'comment_id': bob_comment.id}),
            {'content': '변조'},
            format='json',
        )
        self.assertEqual(patch_res.status_code, status.HTTP_403_FORBIDDEN)
        del_member_res = self.client.delete(
            reverse('comment-detail-update-destroy', kwargs={'comment_id': bob_comment.id}),
        )
        self.assertEqual(del_member_res.status_code, status.HTTP_403_FORBIDDEN)

        # 글 작성자는 비회원 댓글 삭제는 가능하지만 수정은 불가하다.
        patch_guest = self.client.patch(
            reverse('comment-detail-update-destroy', kwargs={'comment_id': guest_comment.id}),
            {'content': '변조'},
            format='json',
        )
        self.assertEqual(patch_guest.status_code, status.HTTP_403_FORBIDDEN)
        del_guest = self.client.delete(
            reverse('comment-detail-update-destroy', kwargs={'comment_id': guest_comment.id}),
        )
        self.assertEqual(del_guest.status_code, status.HTTP_204_NO_CONTENT)

    def test_comment_parent_cannot_be_mutated_or_cross_post(self):
        post1 = Post.objects.create(author=self.alice, board=self.public_board, title='글1', content_md='본문1')
        post2 = Post.objects.create(author=self.alice, board=self.public_board, title='글2', content_md='본문2')
        c1 = Comment.objects.create(post=post1, author=self.bob, content='댓글1')
        c2 = Comment.objects.create(post=post2, author=self.bob, content='다른글댓글')

        self.client.force_authenticate(user=self.bob)
        # 자기 자신으로 parent 순환 변경 시도 차단
        res_cycle = self.client.patch(
            reverse('comment-detail-update-destroy', kwargs={'comment_id': c1.id}),
            {'content': '수정', 'parent': c1.id},
            format='json',
        )
        self.assertEqual(res_cycle.status_code, status.HTTP_400_BAD_REQUEST)

        # 다른 게시글의 댓글을 parent로 지정해 생성 시도 차단
        res_cross = self.client.post(
            reverse('comment-list-create', kwargs={'post_id': post1.id}),
            {'content': '크로스답글', 'parent': c2.id},
            format='json',
        )
        self.assertEqual(res_cross.status_code, status.HTTP_400_BAD_REQUEST)

    # ── [BH-4] 익명 게시글 작성자 실명 역추적 차단 ───────────────────────
    def test_anonymous_post_author_cannot_be_deanonymized_via_search(self):
        Post.objects.create(
            author=self.alice, board=self.public_board,
            title='비밀고백', content_md='내용없음', is_anonymous=True,
        )
        Post.objects.create(
            author=self.alice, board=self.public_board,
            title='실명글', content_md='내용없음', is_anonymous=False,
        )
        res_anon = self.client.get(reverse('post-search-all'), {'q': 'AliceRealName'})
        self.assertEqual(res_anon.status_code, status.HTTP_200_OK)
        titles = [item['title'] for item in res_anon.data['results']]
        self.assertEqual(titles, ['실명글'])

    # ── [BH-5] 'author' 게시판 미디어 게이트 ─────────────────────────────
    def test_author_scoped_board_post_is_media_gated(self):
        post = Post.objects.create(
            author=self.alice, board=self.author_board,
            title='작성자전용', content_md='본문', post_type=Post.PostType.DEFAULT,
        )
        self.assertTrue(is_post_media_gated(post))

    # ── [BH-6] 게시글 게시판 이동 권한 검증 ──────────────────────────────
    def test_post_board_move_validates_board_id_and_permissions(self):
        post = Post.objects.create(
            author=self.alice, board=self.public_board, title='이동테스트', content_md='본문'
        )
        self.client.force_authenticate(user=self.alice)

        # 잘못된 board_id 타입은 500 대신 400
        res_bad = self.client.patch(
            reverse('post-detail-update-destroy', kwargs={'post_id': post.id}),
            {'board_id': 'not-an-int'},
            format='json',
        )
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

        # 일반 회원은 스태프 게시판으로 이동 불가
        res_staff = self.client.patch(
            reverse('post-detail-update-destroy', kwargs={'post_id': post.id}),
            {'board_id': self.staff_board.id},
            format='json',
        )
        self.assertEqual(res_staff.status_code, status.HTTP_403_FORBIDDEN)

        # 사유서(JUSTIFICATION_LETTER) 글은 일반 회원이 공개 게시판으로 빼낼 수 없음
        private_post = Post.objects.create(
            author=self.alice, board=self.author_board,
            title='사유서', content_md='개인정보',
            post_type=Post.PostType.JUSTIFICATION_LETTER,
        )
        res_leak = self.client.patch(
            reverse('post-detail-update-destroy', kwargs={'post_id': private_post.id}),
            {'board_id': self.public_board.id},
            format='json',
        )
        self.assertEqual(res_leak.status_code, status.HTTP_403_FORBIDDEN)

    # ── [BH-8] 회원가입 비밀번호 정책 강제 ───────────────────────────────
    def test_signup_enforces_password_validators(self):
        res = self.client.post(
            reverse('signup'),
            {
                'email': 'weakpw@jbnu.ac.kr',
                'username': 'weakuser',
                'password': '123',
                'semester': 1,
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', res.data)

    # ── [BH-9] 프로덕션 Turnstile fail-closed ───────────────────────────
    @override_settings(IS_LOCAL=False, DEBUG=False, TURNSTILE_SECRET_KEY='')
    def test_turnstile_fails_closed_in_production_without_secret(self):
        self.assertFalse(verify_turnstile('dummy-token', '127.0.0.1'))

    # ── [BM-1] 보안 응답 헤더 미들웨어 ───────────────────────────────────
    def test_api_responses_include_security_headers(self):
        res = self.client.get(reverse('site_settings'))
        self.assertEqual(res['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(res['Referrer-Policy'], 'same-origin')
        self.assertIn('camera=()', res['Permissions-Policy'])
        self.assertIn("default-src 'none'", res['Content-Security-Policy'])

    # ── [BM-2] 마크다운 data: 프로토콜 제거 ──────────────────────────────
    def test_sanitize_markdown_strips_data_protocol(self):
        cleaned = sanitize_markdown('<a href="data:text/html,<script>alert(1)</script>">click</a>')
        self.assertNotIn('data:text/html', cleaned)

    # ── [BM-3] 프로필 블록 URL 스킴 검증 & HTML 위험 태그 제거 ──────────
    def test_profile_blocks_reject_javascript_urls_and_html_strips_scripts(self):
        self.client.force_authenticate(user=self.alice)
        res_bad = self.client.patch(
            reverse('profile-blocks-update'),
            {
                'profile_blocks': [
                    {
                        'id': 'b1',
                        'type': 'links',
                        'data': {
                            'items': [
                                {'label': 'XSS', 'url': 'javascript:alert(1)', 'icon': 'globe'}
                            ]
                        },
                    }
                ]
            },
            format='json',
        )
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

        res_html = self.client.patch(
            reverse('profile-html-update'),
            {
                'profile_type': 'html',
                'profile_html': '<h1>Hi</h1><script>alert(1)</script><meta http-equiv="refresh" content="0;url=https://evil.example">',
            },
            format='json',
        )
        self.assertEqual(res_html.status_code, status.HTTP_200_OK)
        self.alice.refresh_from_db()
        self.assertNotIn('<script>', self.alice.profile_html.lower())
        self.assertNotIn('http-equiv="refresh"', self.alice.profile_html.lower())

    # ── [BM-6] 첨부파일 다운로드 Content-Disposition & MIME 하드닝 ───────
    def test_attachment_download_sanitizes_filename_and_forces_octet_stream(self):
        file_key = f'uploads/2026/11/21/{self.alice.id}/report.html'
        post = Post.objects.create(
            author=self.alice,
            board=self.member_board,
            title='첨부',
            content_md='내용',
            attachment_paths=[{'path': file_key, 'name': 'evil"\r\nX-Injected: 1.html'}],
        )
        self.client.force_authenticate(user=self.alice)
        fake_stream = (BytesIO(b'<html>test</html>'), 'text/html', 17)
        with patch('boards.views.get_file_stream', return_value=fake_stream):
            res = self.client.get(
                reverse('post-attachment-download', kwargs={'post_id': post.id, 'index': 0})
            )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Content-Type'], 'application/octet-stream')
        self.assertEqual(res['X-Content-Type-Options'], 'nosniff')
        self.assertNotIn('\r', res['Content-Disposition'])
        self.assertNotIn('\n', res['Content-Disposition'])

    # ── [BM-8] 비밀번호 변경 시 기존 Access/Refresh JWT 즉시 무효화 ──────
    def test_password_change_invalidates_prior_access_and_refresh_tokens(self):
        refresh = RefreshToken.for_user(self.alice)
        access_str = str(refresh.access_token)
        refresh_str = str(refresh)

        # 비밀번호 변경 시각을 토큰 발급 시점 이후로 기록
        self.alice.password_changed_at = timezone.now() + timedelta(seconds=5)
        self.alice.save(update_fields=['password_changed_at'])

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_str}')
        res_profile = self.client.get(reverse('user-profile', kwargs={'user_id': 'alice'}))
        self.assertEqual(res_profile.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.credentials()
        res_refresh = self.client.post(reverse('token_refresh'), {'refresh': refresh_str}, format='json')
        self.assertEqual(res_refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── [BM-9] DraftSerializer 타인 업로드 파일 참조 차단 ────────────────
    def test_draft_rejects_foreign_uploaded_paths(self):
        self.client.force_authenticate(user=self.alice)
        foreign_key = f'uploads/2026/11/21/{self.bob.id}/secret.pdf'
        res = self.client.post(
            reverse('draft-retrieve-create'),
            {
                'title': '초안',
                'content_md': '본문',
                'uploaded_paths': [{'path': foreign_key, 'name': 'secret.pdf'}],
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # ── [BM-13] SiteSettings quiz_url 인증 게이트 및 URL 스킴 검증 ───────
    def test_site_settings_hides_quiz_url_from_anon_and_validates_scheme(self):
        SiteSettings.set('quiz_url', 'https://forms.gle/safe')

        res_anon = self.client.get(reverse('site_settings'))
        self.assertEqual(res_anon.status_code, status.HTTP_200_OK)
        self.assertEqual(res_anon.data['quiz_url'], '')

        self.client.force_authenticate(user=self.alice)
        res_member = self.client.get(reverse('site_settings'))
        self.assertEqual(res_member.data['quiz_url'], 'https://forms.gle/safe')

        self.client.force_authenticate(user=self.staff)
        res_xss = self.client.put(
            reverse('quiz_url'),
            {'quiz_url': 'javascript:alert(1)'},
            format='json',
        )
        self.assertEqual(res_xss.status_code, status.HTTP_400_BAD_REQUEST)

    # ── [BM-14] X-Forwarded-For 스푸핑 방지 ──────────────────────────────
    def test_get_client_ip_ignores_spoofed_xff_hops(self):
        class FakeRequest:
            def __init__(self, meta):
                self.META = meta

        req = FakeRequest({
            'HTTP_X_FORWARDED_FOR': 'evil-not-an-ip, 1.1.1.1, 203.0.113.55',
            'REMOTE_ADDR': '10.0.0.1',
        })
        with override_settings(REST_FRAMEWORK={'NUM_PROXIES': 1}):
            self.assertEqual(get_client_ip(req), '203.0.113.55')
        with override_settings(REST_FRAMEWORK={'NUM_PROXIES': 0}):
            self.assertEqual(get_client_ip(req), '10.0.0.1')

    # ── [BL-1] HEAD 요청 게시판 권한 검증 ────────────────────────────────
    def test_head_request_enforces_board_read_permission(self):
        res = self.client.head(reverse('post-list-create', kwargs={'board_id': self.member_board.id}))
        self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    # ── [BM-5] 비스태프 Notion 진단 헤더 비노출 ──────────────────────────
    def test_notion_view_hides_diagnostic_headers_for_non_staff(self):
        self.client.force_authenticate(user=self.alice)
        with patch('jbig_backend.notion.fetch_page', return_value={'block': {}}):
            res = self.client.get('/api/notion/3021859be145800e9e88e93bc146b840/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertNotIn('X-Notion-Cache', res.headers)
        self.assertNotIn('X-Notion-Trace-Id', res.headers)
