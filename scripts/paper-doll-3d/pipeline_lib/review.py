"""Human-readable foundation decision packets derived from strict records."""

from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
from typing import Iterator
from urllib.parse import quote

from .models import (
    ApprovalRecord,
    ArtifactRecord,
    ContractRecord,
    DocumentRecord,
    IssueRecord,
    SCHEMA_VERSION,
)
from .paths import resolve_descendant, safe_record_id


def _record_paths(root: Path, pattern: str) -> Iterator[Path]:
    for path in sorted(root.glob(pattern)):
        try:
            resolved = resolve_descendant(root, path, "review record path")
        except (OSError, ValueError) as error:
            raise ValueError("review record path escapes pipeline root") from error
        if not resolved.is_file():
            raise ValueError("review record path must be a regular file")
        yield resolved


def _records(root: Path, pattern: str, record_type: type) -> tuple[object, ...]:
    records = []
    for path in _record_paths(root, pattern):
        try:
            with path.open(encoding="utf-8") as handle:
                value = json.load(handle)
            records.append(record_type.from_dict(value))
        except (OSError, TypeError, ValueError, json.JSONDecodeError) as error:
            relative = path.relative_to(root).as_posix()
            raise ValueError(f"invalid review source record: {relative}") from error
    return tuple(records)


def _inspection(root: Path, document: DocumentRecord) -> dict | None:
    document_id = safe_record_id(document.id, "document id")
    evidence_root = resolve_descendant(root, root / "evidence", "evidence root")
    path = evidence_root / document_id / "inspection.json"
    try:
        resolved = resolve_descendant(evidence_root, path, "evidence inspection path")
    except (OSError, ValueError) as error:
        raise ValueError("evidence inspection path escapes pipeline root") from error
    if not resolved.exists():
        return None
    if not resolved.is_file():
        raise ValueError("evidence inspection path must be a regular file")
    try:
        with resolved.open(encoding="utf-8") as handle:
            value = json.load(handle)
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"invalid evidence inspection for {document.id}") from error
    if (
        not isinstance(value, dict)
        or type(value.get("schema_version")) is not int
        or value["schema_version"] != SCHEMA_VERSION
        or value.get("document_id") != document.id
        or value.get("source_sha256") != document.sha256
    ):
        raise ValueError(f"invalid evidence inspection for {document.id}")
    page_count = value.get("page_count")
    page_paths = value.get("page_paths")
    if (
        type(page_count) is not int
        or page_count < 0
        or not isinstance(page_paths, list)
        or page_count != len(page_paths)
    ):
        raise ValueError(f"invalid evidence page inventory for {document.id}")
    for page_path in page_paths:
        if (
            not isinstance(page_path, str)
            or not page_path
            or Path(page_path).name != page_path
        ):
            raise ValueError(f"invalid evidence page path for {document.id}")
        page = resolve_descendant(
            evidence_root, resolved.parent / page_path, "evidence page path",
        )
        if not page.is_file():
            raise ValueError(f"missing evidence page for {document.id}: {page_path}")
    return value


def _relative_link(output: Path, target: Path) -> str:
    relative = Path(os.path.relpath(target, output.parent)).as_posix()
    return quote(relative, safe="/.-_~")


def _atomic_write_text(path: Path, text: str) -> None:
    data = text.encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", dir=path.parent, suffix=".tmp", delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(data)
            temporary.flush()
            os.fsync(temporary.fileno())
        if path.exists() and path.read_bytes() == data:
            return
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def _status_counts(records: tuple[ArtifactRecord, ...]) -> str:
    counts: dict[str, int] = {}
    for record in records:
        counts[record.status] = counts.get(record.status, 0) + 1
    if not counts:
        return "none"
    return ", ".join(f"{status}: {count}" for status, count in sorted(counts.items()))


def write_foundation_review(pipeline_root: Path, output: Path) -> Path:
    """Atomically write the deterministic eight-section foundation review."""
    root = Path(pipeline_root).resolve()
    destination = resolve_descendant(root, Path(output), "review output")

    documents = _records(root, "documents/records/*.json", DocumentRecord)
    contracts = _records(root, "contracts/**/*.json", ContractRecord)
    approvals = _records(root, "approvals/records/*.json", ApprovalRecord)
    issues = _records(root, "issues/records/*.json", IssueRecord)
    artifacts = _records(root, "artifacts/records/*.json", ArtifactRecord)
    inspections = {
        document.id: inspection
        for document in documents
        if (inspection := _inspection(root, document)) is not None
    }

    duplicate_count = sum(max(0, len(document.observed_names) - 1) for document in documents)
    rendered_pages = sum(value["page_count"] for value in inspections.values())
    referenced_documents = {
        document_id for contract in contracts for document_id in contract.document_ids
    }
    unresolved_documents = tuple(
        document for document in documents if document.id not in referenced_documents
    )
    draft_reviewable = tuple(
        contract for contract in contracts
        if contract.contract_type in {"bottle", "finish"}
        and contract.status == "draft"
        and contract.geometry_authority
        and contract.dimensions
    )
    spec_ready = tuple(
        contract for contract in draft_reviewable if contract.contract_type == "bottle"
    )
    open_issues = tuple(issue for issue in issues if issue.status == "open")
    blockers = tuple(issue for issue in open_issues if issue.severity == "blocked")
    missing_fitments = tuple(
        issue for issue in open_issues if issue.code.startswith("MISSING_FITMENT")
    )
    missing_components = tuple(
        issue for issue in open_issues if issue.code.startswith("MISSING_COMPONENT")
    )
    missing_assemblies = tuple(
        issue for issue in open_issues if issue.code.startswith("MISSING_ASSEMBLY")
    )
    approved = tuple(approval for approval in approvals if approval.decision == "approved")
    scopes = tuple(sorted({
        *(approval.scope for approval in approved),
        *(scope for artifact in artifacts for scope in artifact.approved_scopes),
    }))

    lines = [
        "# Paper-Doll Document and Contract Foundation Review",
        "",
        "## 1. Intake summary",
        "",
        f"- Documents: {len(documents)}",
        f"- Duplicate observations: {duplicate_count}",
        f"- Inspected documents: {len(inspections)}",
        f"- Spec-ready contracts: {len(spec_ready)}",
        f"- Open blockers: {len(blockers)}",
        "",
        "## 2. Documents and rendered pages",
        "",
        f"- Rendered pages: {rendered_pages}",
    ]
    if documents:
        for document in documents:
            inspection = inspections.get(document.id)
            links = []
            if inspection is not None:
                for page_name in inspection["page_paths"]:
                    page = root / "evidence" / document.id / page_name
                    links.append(f"[{page_name}]({_relative_link(destination, page)})")
            evidence = ", ".join(links) if links else "no rendered-page evidence"
            names = ", ".join(f"`{name}`" for name in document.observed_names) or "none"
            lines.append(
                f"- `{document.id}` — status `{document.status}`; names: {names}; {evidence}."
            )
    else:
        lines.append("- No document records.")

    lines.extend([
        "",
        "## 3. Identity reconciliation",
        "",
        f"- Documents represented by contracts: {len(referenced_documents)}",
        f"- Documents still needing identity reconciliation: {len(unresolved_documents)}",
    ])
    for document in unresolved_documents:
        lines.append(f"- `{document.id}` remains unresolved; no product identity is implied.")

    bottle_finish = tuple(
        contract for contract in contracts if contract.contract_type in {"bottle", "finish"}
    )
    lines.extend([
        "",
        "## 4. Draft bottle/finish contracts",
        "",
        f"- Bottle/finish contracts: {len(bottle_finish)}",
        f"- Spec-ready contracts: {len(spec_ready)}",
    ])
    for contract in bottle_finish:
        lines.append(
            f"- `{contract.id}` — `{contract.contract_type}` / "
            f"`{contract.sold_product_key}` / status `{contract.status}`; "
            f"candidate dimensions: {len(contract.dimensions)}."
        )
    if not bottle_finish:
        lines.append("- No bottle or finish contract records.")

    lines.extend([
        "",
        "## 5. Missing fitment/component/assembly evidence",
        "",
        f"- Missing fitments: {len(missing_fitments)}",
        f"- Missing components: {len(missing_components)}",
        f"- Missing assemblies: {len(missing_assemblies)}",
    ])
    missing = missing_fitments + missing_components + missing_assemblies
    for issue in missing:
        lines.append(f"- `{issue.entity_id}` — {issue.message}")
    if not missing:
        lines.append("- No open missing-evidence issues.")

    lines.extend([
        "",
        "## 6. Conflicts and blockers",
        "",
        f"- Open issues: {len(open_issues)}",
        f"- Open blockers: {len(blockers)}",
    ])
    for issue in open_issues:
        lines.append(
            f"- `{issue.id}` / `{issue.code or 'UNCLASSIFIED'}` / "
            f"`{issue.severity}` — {issue.message}"
        )
    if not open_issues:
        lines.append("- No open issues.")

    lines.extend([
        "",
        "## 7. Legacy scene inventory and scoped approvals",
        "",
        f"- Legacy scenes: {len(artifacts)}",
        f"- Status counts: {_status_counts(artifacts)}",
        "- Approved scopes: " + (
            ", ".join(f"`{scope}`" for scope in scopes) if scopes else "none"
        ),
    ])
    for artifact in artifacts:
        artifact_scopes = (
            ", ".join(f"`{scope}`" for scope in artifact.approved_scopes)
            if artifact.approved_scopes else "none"
        )
        lines.append(
            f"- `{artifact.id}` — status `{artifact.status}`; scopes: "
            f"{artifact_scopes}; evidence: {artifact.evidence_note or 'none'}; "
            f"source: {artifact.reviewer_source or 'none'}."
        )
    for approval in approved:
        lines.append(
            f"- Approval `{approval.id}` applies only to `{approval.scope}` on "
            f"hash `{approval.artifact_hash}`."
        )
    if not artifacts and not approved:
        lines.append("- No legacy artifacts or approvals recorded.")

    lines.extend([
        "",
        "## 8. Eligible next decisions",
        "",
    ])
    for contract in draft_reviewable:
        lines.append(
            f"- Review candidate dimensions for `{contract.id}`; this packet does "
            "not grant dimensional or geometry approval."
        )
    if not draft_reviewable:
        lines.append("- No source-backed draft bottle/finish contract is ready for review.")
    if blockers:
        lines.append(
            f"- Resolve {len(blockers)} open blocker(s) before assembly or final-asset decisions."
        )
    lines.append("")

    _atomic_write_text(destination, "\n".join(lines))
    return destination
