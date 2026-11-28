"""글 임시저장(계정당 하나)"""
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from ..models import Draft
from ..serializers import DraftSerializer


@extend_schema(tags=['임시저장'])
class DraftRetrieveCreateAPIView(generics.GenericAPIView):
    """사용자 게시글 작성 버퍼 조회 및 저장"""
    permission_classes = [IsAuthenticated]
    serializer_class = DraftSerializer

    @extend_schema(
        summary="임시저장 버퍼 조회",
        description="사용자의 작성 중인 게시글 버퍼를 조회합니다.",
        responses={
            200: DraftSerializer,
            404: OpenApiResponse(description="임시저장 데이터가 없습니다.")
        }
    )
    def get(self, request):
        """사용자 버퍼 조회"""
        try:
            draft = Draft.objects.get(author=request.user)
            serializer = self.get_serializer(draft)
            return Response(serializer.data)
        except Draft.DoesNotExist:
            return Response({'detail': 'No draft found'}, status=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="임시저장 버퍼 생성/업데이트",
        description="게시글을 임시저장합니다. 사용자당 하나의 버퍼만 유지됩니다.",
        request=DraftSerializer,
        responses={
            200: DraftSerializer,
            201: DraftSerializer
        }
    )
    def post(self, request):
        """버퍼 생성/업데이트 (upsert)"""
        try:
            draft = Draft.objects.get(author=request.user)
            serializer = self.get_serializer(draft, data=request.data, partial=True, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Draft.DoesNotExist:
            serializer = self.get_serializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)


@extend_schema(tags=['임시저장'])
class DraftDeleteAPIView(APIView):
    """임시저장 버퍼 삭제"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="임시저장 버퍼 삭제",
        description="사용자의 작성 중인 게시글 버퍼를 삭제합니다.",
        responses={
            204: OpenApiResponse(description="삭제 성공"),
            404: OpenApiResponse(description="임시저장 데이터가 없습니다.")
        }
    )
    def delete(self, request):
        try:
            draft = Draft.objects.get(author=request.user)
            draft.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Draft.DoesNotExist:
            return Response({'detail': 'No draft found'}, status=status.HTTP_404_NOT_FOUND)
