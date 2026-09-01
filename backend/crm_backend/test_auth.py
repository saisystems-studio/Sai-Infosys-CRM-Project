from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework_simplejwt.tokens import RefreshToken


class TokenRefreshEndpointTests(TestCase):
    def test_refresh_token_returns_a_new_access_token(self):
        user = get_user_model().objects.create_user(
            username="refresh-user",
            password="not-used-here",
        )
        refresh = RefreshToken.for_user(user)

        response = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": str(refresh)},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())
