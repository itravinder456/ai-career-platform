from contextlib import contextmanager
from typing import Generator

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter


def configure_telemetry(service_name: str, otlp_endpoint: str = "") -> None:
    """
    Configure OpenTelemetry tracing.
    - With endpoint: exports to OTLP collector (prod)
    - Without endpoint: exports to stdout (dev/debug)
    Call once at service startup.
    """
    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)

    if otlp_endpoint:
        exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
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
