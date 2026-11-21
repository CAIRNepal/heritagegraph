"""
Structured telemetry for heritage KG ingestion pipeline stages.
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Generator

logger = logging.getLogger(__name__)


@dataclass
class StageMetrics:
    name: str
    duration_ms: float = 0.0
    input_count: int = 0
    output_count: int = 0
    error_count: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineMetrics:
    stages: list[StageMetrics] = field(default_factory=list)
    pipeline_run_id: str = ""
    document_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "pipeline_run_id": self.pipeline_run_id,
            "document_id": self.document_id,
            "stages": [
                {
                    "name": s.name,
                    "duration_ms": s.duration_ms,
                    "input_count": s.input_count,
                    "output_count": s.output_count,
                    "error_count": s.error_count,
                    "metadata": s.metadata,
                }
                for s in self.stages
            ],
            "total_duration_ms": sum(s.duration_ms for s in self.stages),
        }


@contextmanager
def stage_timer(
    metrics: PipelineMetrics,
    name: str,
    *,
    input_count: int = 0,
) -> Generator[StageMetrics, None, None]:
    stage = StageMetrics(name=name, input_count=input_count)
    start = time.perf_counter()
    try:
        yield stage
    finally:
        stage.duration_ms = round((time.perf_counter() - start) * 1000, 2)
        metrics.stages.append(stage)
        logger.info(
            "pipeline.stage=%s duration_ms=%.1f in=%d out=%d errors=%d %s",
            name,
            stage.duration_ms,
            stage.input_count,
            stage.output_count,
            stage.error_count,
            stage.metadata,
        )
