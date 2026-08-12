"""Human-readable foundation decision packets derived from strict records."""

from __future__ import annotations

from dataclasses import dataclass
import html
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Iterator
from urllib.parse import quote

from .approvals import (
    _approval_scope,
    _artifact_hash,
    _aware_timestamp,
    _decision,
    _human_reviewer,
    _required_string,
)
from .ids import content_hash
from .models import (
    ApprovalRecord,
    ArtifactRecord,
    ContractRecord,
    DocumentRecord,
    IssueRecord,
    SCHEMA_VERSION,
)
from .paths import resolve_descendant, safe_record_id


_LINE_BREAKS = re.compile(r"[\r\n\v\f\x1c-\x1e\x85\u2028\u2029]+")
_REQUIRED_SOURCE_DIRECTORIES = (
    Path("documents/records"),
    Path("issues/records"),
    Path("artifacts/records"),
)


@dataclass(frozen=True)
class _EntityAuthority:
    entity_type: str
    artifact_hash: str


def _normalize(value: object) -> str:
    return _LINE_BREAKS.sub(" ", str(value))


def _text(value: object) -> str:
    escaped = html.escape(_normalize(value), quote=False).replace("`", "&#96;")
    result = []
    for character in escaped:
        if character in {"\\", "[", "]", "|"}:
            result.append("\\")
        result.append(character)
    return "".join(result)


def _code(value: object) -> str:
    escaped = html.escape(_normalize(value), quote=False)
    for character, entity in (
        ("`", "&#96;"), ("|", "&#124;"), ("[", "&#91;"), ("]", "&#93;"),
    ):
        escaped = escaped.replace(character, entity)
    return f"`{escaped}`"


def _pipeline_root(path: Path) -> Path:
    configured = Path(path)
    if not configured.exists() or not configured.is_dir():
        raise ValueError("pipeline_root must be an existing directory")
    root = configured.resolve(strict=True)
    for relative_path in _REQUIRED_SOURCE_DIRECTORIES:
        source = root / relative_path
        if source.is_symlink() or not source.is_dir():
            raise ValueError(
                f"required source directory is missing or unsafe: {relative_path}"
            )
        resolve_descendant(root, source, "required source directory")
    return root


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


def _relative_link(root: Path, output: Path, target: Path) -> str:
    resolved = resolve_descendant(root, target, "review evidence link target")
    if not resolved.is_file():
        raise ValueError("review evidence link target must be a regular file")
    relative = Path(os.path.relpath(resolved, output.parent)).as_posix()
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


def _entity_authorities(
    documents: tuple[DocumentRecord, ...],
    contracts: tuple[ContractRecord, ...],
    artifacts: tuple[ArtifactRecord, ...],
) -> dict[str, _EntityAuthority]:
    authorities: dict[str, _EntityAuthority] = {}

    def add(entity_id: str, entity_type: str, artifact_hash: str) -> None:
        if entity_id in authorities:
            raise ValueError(f"duplicate review entity ID: {entity_id!r}")
        try:
            validated_hash = _artifact_hash(artifact_hash)
        except ValueError as error:
            raise ValueError(f"invalid hash on review entity: {entity_id!r}") from error
        authorities[entity_id] = _EntityAuthority(entity_type, validated_hash)

    for document in documents:
        add(document.id, "document", document.sha256)
    for contract in contracts:
        add(contract.id, "contract", content_hash(contract.to_dict()))
    for artifact in artifacts:
        add(artifact.id, "artifact", artifact.sha256)
    return authorities


def _current_decisions(
    approvals: tuple[ApprovalRecord, ...],
    authorities: dict[str, _EntityAuthority],
) -> tuple[ApprovalRecord, ...]:
    current = {}
    for approval in approvals:
        try:
            approval_id = _required_string(approval.id, "approval id")
            entity_type = _required_string(approval.entity_type, "approval entity_type")
            entity_id = _required_string(approval.entity_id, "approval entity_id")
            scope = _approval_scope(approval.scope)
            artifact_hash = _artifact_hash(approval.artifact_hash)
            _human_reviewer(approval.reviewer)
            decided_at = _aware_timestamp(approval.decided_at)
            _decision(approval.decision)
            if not isinstance(approval.notes, str):
                raise ValueError("approval notes must be a string")
        except (AttributeError, TypeError, ValueError):
            continue
        authority = authorities.get(entity_id)
        if authority is None or (
            authority.entity_type != entity_type
            or authority.artifact_hash != artifact_hash
        ):
            continue
        stream = (entity_id, scope, artifact_hash)
        candidate = (decided_at, approval_id, approval)
        if stream not in current or candidate[:2] > current[stream][:2]:
            current[stream] = candidate
    return tuple(
        value[2] for _, value in sorted(current.items(), key=lambda item: item[0])
    )


def _effective_artifact_scopes(
    artifact: ArtifactRecord, decisions: tuple[ApprovalRecord, ...],
) -> tuple[str, ...]:
    scopes = set(artifact.approved_scopes)
    for approval in decisions:
        if (
            approval.entity_id == artifact.id
            and approval.artifact_hash == artifact.sha256
        ):
            if approval.decision == "approved":
                scopes.add(approval.scope)
            else:
                scopes.discard(approval.scope)
    return tuple(sorted(scopes))


def _missing_entities(
    issues: tuple[IssueRecord, ...], code_prefix: str,
) -> tuple[IssueRecord, ...]:
    by_entity = {}
    for issue in issues:
        if issue.code.startswith(code_prefix):
            by_entity.setdefault(issue.entity_id, issue)
    return tuple(by_entity[entity_id] for entity_id in sorted(by_entity))


def write_foundation_review(pipeline_root: Path, output: Path) -> Path:
    """Atomically write the deterministic eight-section foundation review."""
    root = _pipeline_root(Path(pipeline_root))
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

    duplicate_count = sum(max(0, len(document.observed_paths) - 1) for document in documents)
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
    missing_fitments = _missing_entities(open_issues, "MISSING_FITMENT")
    missing_components = _missing_entities(open_issues, "MISSING_COMPONENT")
    missing_assemblies = _missing_entities(open_issues, "MISSING_ASSEMBLY")
    authorities = _entity_authorities(documents, contracts, artifacts)
    current_decisions = _current_decisions(approvals, authorities)
    effective_scopes_by_artifact = {
        artifact.id: _effective_artifact_scopes(artifact, current_decisions)
        for artifact in artifacts
    }
    scopes = tuple(sorted({
        *(approval.scope for approval in current_decisions if approval.decision == "approved"),
        *(scope for values in effective_scopes_by_artifact.values() for scope in values),
    }))
    legacy_artifacts = tuple(
        artifact for artifact in artifacts if artifact.kind == "legacy_scene"
    )

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
                    links.append(
                        f"[{_text(page_name)}]({_relative_link(root, destination, page)})"
                    )
            evidence = ", ".join(links) if links else "no rendered-page evidence"
            names = ", ".join(_code(name) for name in document.observed_names) or "none"
            lines.append(
                f"- {_code(document.id)} — status {_code(document.status)}; "
                f"names: {names}; {evidence}."
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
        lines.append(
            f"- {_code(document.id)} remains unresolved; no product identity is implied."
        )

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
            f"- {_code(contract.id)} — {_code(contract.contract_type)} / "
            f"{_code(contract.sold_product_key)} / status {_code(contract.status)}; "
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
        lines.append(f"- {_code(issue.entity_id)} — {_text(issue.message)}")
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
            f"- {_code(issue.id)} / {_code(issue.code or 'UNCLASSIFIED')} / "
            f"{_code(issue.severity)} — {_text(issue.message)}"
        )
    if not open_issues:
        lines.append("- No open issues.")

    lines.extend([
        "",
        "## 7. Legacy scene inventory and scoped approvals",
        "",
        f"- Legacy scenes: {len(legacy_artifacts)}",
        f"- Status counts: {_status_counts(legacy_artifacts)}",
        "- Approved scopes: " + (
            ", ".join(_code(scope) for scope in scopes) if scopes else "none"
        ),
    ])
    for artifact in legacy_artifacts:
        artifact_scopes_text = (
            ", ".join(
                _code(scope) for scope in effective_scopes_by_artifact[artifact.id]
            )
            if effective_scopes_by_artifact[artifact.id] else "none"
        )
        lines.append(
            f"- {_code(artifact.id)} — status {_code(artifact.status)}; scopes: "
            f"{artifact_scopes_text}; evidence: "
            f"{_text(artifact.evidence_note or 'none')}; "
            f"source: {_text(artifact.reviewer_source or 'none')}."
        )
    for approval in current_decisions:
        lines.append(
            f"- Current decision {_code(approval.id)}: decision "
            f"{_code(approval.decision)} for {_code(approval.scope)} on "
            f"{_code(approval.entity_id)} at hash {_code(approval.artifact_hash)}."
        )
    if not legacy_artifacts and not current_decisions:
        lines.append("- No legacy artifacts or approvals recorded.")

    lines.extend([
        "",
        "## 8. Eligible next decisions",
        "",
    ])
    for contract in draft_reviewable:
        lines.append(
            f"- Review candidate dimensions for {_code(contract.id)}; this packet does "
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
