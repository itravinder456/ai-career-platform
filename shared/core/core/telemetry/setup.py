from contextlib import contextmanager
from typing import Generator

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.util.re import parse_env_headers


def configure_telemetry(service_name: str, otlp_endpoint: str = "", otlp_headers: str = "") -> None:
    """
    Configure OpenTelemetry tracing.
    - With endpoint: exports over OTLP/HTTP (prod) — path-based URLs like Grafana Cloud's
      "https://otlp-gateway-<region>.grafana.net/otlp" are OTLP/HTTP, not gRPC (gRPC
      endpoints are bare host:port with no path), hence the HTTP exporter here, not gRPC.
      otlp_headers is the same "key1=value1,key2=value2" form as OTEL_EXPORTER_OTLP_HEADERS
      (e.g. Grafana's "Authorization=Basic%20<token>") — parsed and URL-decoded before
      being handed to the exporter, which (unlike the gRPC exporter) requires a dict.
    - Without endpoint: exports to stdout (dev/debug)
    Call once at service startup.
    """
    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)

    if otlp_endpoint:
        headers = dict(parse_env_headers(otlp_headers, liberal=True)) if otlp_headers else None
        # The exporter only auto-appends /v1/traces when it falls back to reading
        # OTEL_EXPORTER_OTLP_ENDPOINT itself — passing `endpoint=` explicitly (as we do
        # here, sourced from our own OTEL_ENDPOINT) bypasses that, so it's done by hand.
        traces_endpoint = otlp_endpoint.rstrip("/") + "/v1/traces"
        exporter = OTLPSpanExporter(endpoint=traces_endpoint, headers=headers)
    else:
        exporter = ConsoleSpanExporter()

    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)


def get_tracer(name: str) -> trace.Tracer:
    return trace.get_tracer(name)


@contextmanager
def span(name: str, tracer_name: str = "default") -> Generator[trace.Span, None, None]:
    """Convenience context manager for creating a span inline."""
    tracer = get_tracer(tracer_name)
    with tracer.start_as_current_span(name) as s:
        yield s
