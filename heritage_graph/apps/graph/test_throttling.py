"""The public read surface must be rate limited.

The SPARQL proxy, the KG query endpoint and the LOD/graph endpoints are all
AllowAny, and each request can scan the whole triplestore. Before this there was
no `anon`/`user` default and the proxy sits outside DRF entirely, so none of
them were limited at all.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test apps.graph.test_throttling -v2
"""

from apps.graph.sparql_proxy import _sparql_rate_limited
from django.core.cache import cache
from django.test import TestCase, override_settings


class _Req:
    """Minimal stand-in carrying only what the limiter reads."""

    def __init__(self, ip="203.0.113.1"):
        self.META = {"REMOTE_ADDR": ip}


class SparqlProxyThrottleTests(TestCase):
    def setUp(self):
        cache.clear()

    @override_settings(SPARQL_THROTTLE_RATE="3/min")
    def test_blocks_once_over_the_limit(self):
        req = _Req()
        allowed = [not _sparql_rate_limited(req) for _ in range(3)]
        self.assertEqual(allowed, [True, True, True])

        self.assertTrue(_sparql_rate_limited(req), "4th request should be limited")

    @override_settings(SPARQL_THROTTLE_RATE="2/min")
    def test_limits_are_per_client(self):
        a, b = _Req("203.0.113.1"), _Req("203.0.113.2")
        for _ in range(3):
            _sparql_rate_limited(a)

        self.assertTrue(_sparql_rate_limited(a))
        self.assertFalse(
            _sparql_rate_limited(b), "a different IP must not inherit the block"
        )

    @override_settings(SPARQL_THROTTLE_RATE="2/min")
    def test_honours_forwarded_header(self):
        """Behind Traefik every request shares REMOTE_ADDR."""
        req = _Req("10.0.0.1")
        req.META["HTTP_X_FORWARDED_FOR"] = "198.51.100.7, 10.0.0.1"
        for _ in range(3):
            _sparql_rate_limited(req)

        other = _Req("10.0.0.1")
        other.META["HTTP_X_FORWARDED_FOR"] = "198.51.100.8, 10.0.0.1"
        self.assertFalse(
            _sparql_rate_limited(other),
            "clients must be distinguished by forwarded IP, not the proxy's",
        )

    @override_settings(SPARQL_THROTTLE_RATE="not-a-rate")
    def test_fails_open_on_a_malformed_rate(self):
        """A config typo must not lock readers out of a public resource."""
        self.assertFalse(_sparql_rate_limited(_Req()))

    @override_settings(SPARQL_THROTTLE_RATE="1/min")
    def test_proxy_returns_429_when_limited(self):
        cache.clear()
        self.client.get("/sparql/", {"query": "SELECT * WHERE { ?s ?p ?o } LIMIT 1"})
        response = self.client.get(
            "/sparql/", {"query": "SELECT * WHERE { ?s ?p ?o } LIMIT 1"}
        )

        self.assertEqual(response.status_code, 429)
