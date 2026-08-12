"""Foundation-only orchestration for the paper-doll document pipeline."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any

from .index import IndexSummary, rebuild_index
from .inspection import InspectionReport, inspect_pending_documents
from .intake import (
    IntakeReport,
    MirrorReport,
    audit_existing_mirror,
    intake_documents,
)
from .legacy import LegacyReport, inventory_pending_legacy_assets
from .models import (
    APPROVAL_SCOPES,
    ApprovalRecord,
    ArtifactRecord,
    ContractRecord,
    DocumentRecord,
    IssueRecord,
)
from .reconciliation import ReconciliationReport, reconcile_pending_documents
from .review import write_foundation_review
from .store import iter_records


FOUNDATION_STAGES = (
    "intake",
    "inspection",
    "mirror",
    "reconciliation",
    "legacy",
    "index",
    "review",
)
NEW_GEOMETRY_APPROVAL_SCOPES = frozenset({
    "dimensional_truth",
    "body_geometry",
    "fitment_geometry",
    "component_geometry",
    "assembly_visual_fit",
    "assembly_dimensional_fit",
})


@dataclass(frozen=True)
class RunSummary:
    intake: IntakeReport
    inspection: InspectionReport
    mirror: MirrorReport
    reconciliation: ReconciliationReport
    legacy: LegacyReport
    index: IndexSummary
    review_path: str


def run_foundation(
    source_dir: Path,
    pipeline_root: Path,
    *,
    mirror_dir: Path | None = None,
    master_root: Path | None = None,
) -> RunSummary:
    """Advance only the document-contract foundation, ending at human review."""
    source_dir = Path(source_dir)
    pipeline_root = Path(pipeline_root)
    intake_report = intake_documents(source_dir, pipeline_root)
    inspection_report = inspect_pending_documents(pipeline_root)
    mirror_report = audit_existing_mirror(
        Path(mirror_dir) if mirror_dir is not None else pipeline_root / "specs",
        iter_records(pipeline_root, "documents", DocumentRecord),
    )
    reconciliation_report = reconcile_pending_documents(pipeline_root)
    legacy_report = inventory_pending_legacy_assets(
        pipeline_root,
        master_root=Path(master_root) if master_root is not None else None,
    )
    index_report = rebuild_index(
        pipeline_root, pipeline_root / "indexes/pipeline.sqlite",
    )
    review_path = write_foundation_review(
        pipeline_root,
        pipeline_root / "reviews/foundation/document-contract-foundation.md",
    )
    return RunSummary(
        intake=intake_report,
        inspection=inspection_report,
        mirror=mirror_report,
        reconciliation=reconciliation_report,
        legacy=legacy_report,
        index=index_report,
        review_path=str(review_path),
    )


def _counts(values: tuple[object, ...], attribute: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        key = getattr(value, attribute)
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items()))


def _contract_records(pipeline_root: Path) -> tuple[ContractRecord, ...]:
    records = []
    for path in sorted(Path(pipeline_root).glob("contracts/**/*.json")):
        with path.open(encoding="utf-8") as handle:
            records.append(ContractRecord.from_dict(json.load(handle)))
    return tuple(records)


def foundation_status(pipeline_root: Path) -> dict[str, Any]:
    """Return current authoritative status without granting or deriving approval."""
    root = Path(pipeline_root)
    documents = tuple(iter_records(root, "documents", DocumentRecord))
    contracts = _contract_records(root)
    approvals = tuple(iter_records(root, "approvals", ApprovalRecord))
    issues = tuple(iter_records(root, "issues", IssueRecord))
    artifacts = tuple(iter_records(root, "artifacts", ArtifactRecord))
    blockers = tuple(
        issue for issue in issues
        if issue.severity == "blocked" and issue.status == "open"
    )
    candidate_dimensions = tuple(
        dimension
        for contract in contracts
        for dimension in contract.dimensions
        if dimension.get("status") == "candidate"
    )
    approved_candidate_dimensions = tuple(
        dimension
        for contract in contracts
        for dimension in contract.dimensions
        if dimension.get("status") == "approved"
    )
    approved_scopes = sorted({
        *(scope for artifact in artifacts for scope in artifact.approved_scopes),
        *(
            approval.scope for approval in approvals
            if approval.decision == "approved" and approval.scope in APPROVAL_SCOPES
        ),
    })
    new_geometry_approvals = sum(
        approval.decision == "approved"
        and approval.scope in NEW_GEOMETRY_APPROVAL_SCOPES
        for approval in approvals
    )
    return {
        "command": "status",
        "intake_documents": sum(len(document.observed_paths) for document in documents),
        "document_records": len(documents),
        "document_statuses": _counts(documents, "status"),
        "contract_records": len(contracts),
        "contract_statuses": _counts(contracts, "status"),
        "artifact_records": len(artifacts),
        "artifact_statuses": _counts(artifacts, "status"),
        "candidate_dimensions": len(candidate_dimensions),
        "approved_candidate_dimensions": len(approved_candidate_dimensions),
        "approved_scopes": approved_scopes,
        "new_geometry_approvals": new_geometry_approvals,
        "blockers": [
            {
                "id": issue.id,
                "entity_id": issue.entity_id,
                "code": issue.code,
                "message": issue.message,
                "severity": issue.severity,
                "status": issue.status,
            }
            for issue in blockers
        ],
    }


def intake_summary(report: IntakeReport) -> dict[str, Any]:
    return {
        "command": "intake",
        "discovered": report.discovered,
        "new": report.new,
        "duplicate": report.duplicate,
        "revision_conflicts": report.revision_conflicts,
    }


def inspection_summary(report: InspectionReport) -> dict[str, Any]:
    return {
        "command": "inspect",
        "inspected": report.inspected,
        "skipped": report.skipped,
    }


def mirror_summary(report: MirrorReport) -> dict[str, Any]:
    return {
        "matched_hashes": report.matched_hashes,
        "mirror_files": report.mirror_files,
        "duplicate_file_instances": report.duplicate_file_instances,
        "unknown_hashes": report.unknown_hashes,
    }


def reconciliation_summary(report: ReconciliationReport) -> dict[str, Any]:
    return {
        "command": "reconcile",
        "reconciled": report.reconciled,
        "needs_review": report.needs_review,
        "skipped": report.skipped,
        "contracts": len(report.contract_records),
        "issues": len(report.issues),
    }


def legacy_summary(report: LegacyReport) -> dict[str, Any]:
    return {
        "command": "inventory-legacy",
        "discovered": report.discovered,
        "written": report.written,
        "status_counts": dict(report.status_counts),
    }


def index_summary(report: IndexSummary) -> dict[str, Any]:
    return {
        "command": "rebuild-index",
        "entities": report.entities,
        "approvals": report.approvals,
        "dependencies": report.dependencies,
        "issues": report.issues,
        "artifacts": report.artifacts,
    }


def run_summary(report: RunSummary) -> dict[str, Any]:
    return {
        "command": "run",
        "stages": list(FOUNDATION_STAGES),
        "intake": {key: value for key, value in intake_summary(report.intake).items()
                   if key != "command"},
        "inspection": {
            key: value for key, value in inspection_summary(report.inspection).items()
            if key != "command"
        },
        "mirror": mirror_summary(report.mirror),
        "reconciliation": {
            key: value for key, value in reconciliation_summary(report.reconciliation).items()
            if key != "command"
        },
        "legacy": {
            key: value for key, value in legacy_summary(report.legacy).items()
            if key != "command"
        },
        "index": {
            key: value for key, value in index_summary(report.index).items()
            if key != "command"
        },
        "review_path": report.review_path,
    }
