"""Explicit drawing-to-product reconciliation and conservative contract drafts."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from .ids import stable_id
from .models import SCHEMA_VERSION, ContractRecord, DocumentRecord, IssueRecord
from .paths import resolve_descendant, safe_record_id
from .store import atomic_write_json, iter_records, write_record


DOCUMENT_ROLES = frozenset({"bottle_drawing", "print_area_only"})
REVIEW_STATUSES = frozenset({"matched", "needs_review"})
CONTRACT_DIRECTORIES = {
    "bottle": Path("bottles"),
    "fitment": Path("fitments"),
    "component": Path("components"),
}


def _string(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field_name} must be a non-empty string")
    return value


@dataclass(frozen=True)
class IdentityRule:
    source_pattern: str
    family: str
    sold_product_key: str
    source_capacity_label: str
    sold_capacity_label: str
    document_role: str
    review_status: str
    aliases: tuple[str, ...] = ()
    finish_context: str = ""

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "IdentityRule":
        if not isinstance(value, dict):
            raise ValueError("identity rule must be a dictionary")
        required = {
            "source_pattern", "family", "sold_product_key", "source_capacity_label",
            "sold_capacity_label", "document_role", "review_status",
        }
        optional = {"aliases", "finish_context"}
        supplied = set(value)
        if not required <= supplied or supplied - required - optional:
            missing = sorted(required - supplied)
            unknown = sorted(supplied - required - optional)
            details = []
            if missing:
                details.append(f"missing fields: {missing}")
            if unknown:
                details.append(f"unknown fields: {unknown}")
            raise ValueError("invalid identity rule fields (" + "; ".join(details) + ")")

        aliases = value.get("aliases", ())
        if not isinstance(aliases, (list, tuple)) or not all(
            isinstance(alias, str) and alias for alias in aliases
        ):
            raise ValueError("aliases must contain non-empty strings")
        role = _string(value["document_role"], "document_role")
        if role not in DOCUMENT_ROLES:
            raise ValueError(f"unknown document role: {role!r}")
        review_status = _string(value["review_status"], "review_status")
        if review_status not in REVIEW_STATUSES:
            raise ValueError(f"unknown review status: {review_status!r}")
        finish_context = value.get("finish_context", "")
        if not isinstance(finish_context, str):
            raise ValueError("finish_context must be a string")

        return cls(
            source_pattern=_string(value["source_pattern"], "source_pattern"),
            family=_string(value["family"], "family"),
            sold_product_key=_string(value["sold_product_key"], "sold_product_key"),
            source_capacity_label=_string(
                value["source_capacity_label"], "source_capacity_label",
            ),
            sold_capacity_label=_string(
                value["sold_capacity_label"], "sold_capacity_label",
            ),
            document_role=role,
            review_status=review_status,
            aliases=tuple(aliases),
            finish_context=finish_context,
        )

    def matches(self, observed_name: str) -> bool:
        return observed_name == self.source_pattern or observed_name in self.aliases


@dataclass(frozen=True)
class ReconciliationResult:
    document_ids: tuple[str, ...]
    family: str
    sold_product_key: str
    source_capacity_label: str
    sold_capacity_label: str
    document_role: str
    status: str
    matched_source_patterns: tuple[str, ...] = ()
    matched_observed_names: tuple[str, ...] = ()
    finish_contexts: tuple[str, ...] = ()


@dataclass(frozen=True)
class ReconciliationReport:
    reconciled: int
    needs_review: int
    skipped: int
    document_records: tuple[DocumentRecord, ...]
    results: tuple[ReconciliationResult, ...]
    contract_records: tuple[ContractRecord, ...]
    issues: tuple[IssueRecord, ...]

    @property
    def contracts(self) -> tuple[ContractRecord, ...]:
        return self.contract_records


def load_identity_rules(path: Path) -> tuple[IdentityRule, ...]:
    """Load the versioned runtime rule registry without consulting Markdown."""
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict) or set(value) != {"schema_version", "rules"}:
        raise ValueError("identity rule registry must contain schema_version and rules")
    if type(value["schema_version"]) is not int or value["schema_version"] != SCHEMA_VERSION:
        raise ValueError(f"unsupported schema version: {value['schema_version']!r}")
    if not isinstance(value["rules"], list):
        raise ValueError("identity rules must be a list")

    rules = tuple(IdentityRule.from_dict(item) for item in value["rules"])
    patterns = [rule.source_pattern for rule in rules]
    match_names = [name for rule in rules for name in (rule.source_pattern, *rule.aliases)]
    if len(set(patterns)) != len(patterns):
        raise ValueError("identity source patterns must be unique")
    if len(set(match_names)) != len(match_names):
        raise ValueError("identity source patterns and aliases must be unique")
    return rules


def _observed_names(document: DocumentRecord) -> tuple[str, ...]:
    values = list(document.observed_names)
    values.extend(Path(path).name for path in document.observed_paths)
    return tuple(sorted(set(values)))


def suggest_identity(
    document: DocumentRecord, rules: Iterable[IdentityRule],
) -> ReconciliationResult:
    """Match every observed filename while retaining one content-backed document ID."""
    rules = tuple(rules)
    names = _observed_names(document)
    matched_pairs = tuple(
        (name, rule)
        for name in names
        for rule in rules
        if rule.matches(name)
    )
    if not matched_pairs:
        return ReconciliationResult(
            document_ids=(document.id,),
            family="",
            sold_product_key="",
            source_capacity_label="",
            sold_capacity_label="",
            document_role="unknown",
            status="needs_review",
        )

    matched_rules = tuple(rule for _, rule in matched_pairs)
    identities = {
        (
            rule.family, rule.sold_product_key, rule.source_capacity_label,
            rule.sold_capacity_label,
        )
        for rule in matched_rules
    }
    if len(identities) != 1:
        return ReconciliationResult(
            document_ids=(document.id,),
            family="",
            sold_product_key="",
            source_capacity_label="",
            sold_capacity_label="",
            document_role="conflict",
            status="needs_review",
            matched_source_patterns=tuple(sorted({
                rule.source_pattern for rule in matched_rules
            })),
            matched_observed_names=tuple(sorted({name for name, _ in matched_pairs})),
            finish_contexts=tuple(sorted({
                rule.finish_context for rule in matched_rules if rule.finish_context
            })),
        )

    family, sold_product_key, source_label, sold_label = identities.pop()
    roles = {rule.document_role for rule in matched_rules}
    document_role = "bottle_drawing" if "bottle_drawing" in roles else "print_area_only"
    status = (
        "matched"
        if all(rule.review_status == "matched" for rule in matched_rules)
        else "needs_review"
    )
    return ReconciliationResult(
        document_ids=(document.id,),
        family=family,
        sold_product_key=sold_product_key,
        source_capacity_label=source_label,
        sold_capacity_label=sold_label,
        document_role=document_role,
        status=status,
        matched_source_patterns=tuple(sorted({rule.source_pattern for rule in matched_rules})),
        matched_observed_names=tuple(sorted({name for name, _ in matched_pairs})),
        finish_contexts=tuple(sorted({
            rule.finish_context for rule in matched_rules if rule.finish_context
        })),
    )


def _inspection_candidates(
    document: DocumentRecord, inspection: dict[str, Any],
) -> tuple[dict[str, Any], ...]:
    if not isinstance(inspection, dict):
        raise ValueError("inspection must be a dictionary")
    if type(inspection.get("schema_version")) is not int or (
        inspection["schema_version"] != SCHEMA_VERSION
    ):
        raise ValueError("inspection has an unsupported schema version")
    if inspection.get("document_id") != document.id:
        raise ValueError("inspection document ID does not match document record")
    if inspection.get("source_sha256") != document.sha256:
        raise ValueError("inspection source hash does not match document record")
    candidates = inspection.get("candidates")
    if not isinstance(candidates, (list, tuple)):
        raise ValueError("inspection candidates must be a list or tuple")

    dimensions = []
    for candidate in candidates:
        if not isinstance(candidate, dict):
            raise ValueError("inspection candidate must be a dictionary")
        dimensions.append({
            **candidate,
            "source_document_id": document.id,
            "source_sha256": document.sha256,
            "status": "candidate",
        })
    return tuple(dimensions)


def _contract_id(
    contract_type: str, document: DocumentRecord, result: ReconciliationResult,
) -> str:
    return stable_id("contract", {
        "contract_type": contract_type,
        "document_ids": result.document_ids,
        "sold_product_key": result.sold_product_key,
        "source_sha256": document.sha256,
    })


def draft_contract(
    document: DocumentRecord,
    inspection: dict[str, Any],
    result: ReconciliationResult,
) -> ContractRecord:
    """Create a source-backed bottle draft without approving extracted candidates."""
    if result.status != "matched" or not result.sold_product_key:
        raise ValueError("cannot draft a contract from an unresolved identity")
    if result.document_ids != (document.id,):
        raise ValueError("reconciliation result does not retain the source document ID")
    geometry_authority = result.document_role == "bottle_drawing"
    return ContractRecord(
        id=_contract_id("bottle", document, result),
        contract_type="bottle",
        document_ids=result.document_ids,
        sold_product_key=result.sold_product_key,
        source_capacity_label=result.source_capacity_label,
        sold_capacity_label=result.sold_capacity_label,
        geometry_authority=geometry_authority,
        dimensions=_inspection_candidates(document, inspection),
        status="draft" if geometry_authority else "blocked",
    )


def _blocked_contract(
    contract_type: str, document: DocumentRecord, result: ReconciliationResult,
) -> ContractRecord:
    return ContractRecord(
        id=_contract_id(contract_type, document, result),
        contract_type=contract_type,
        document_ids=result.document_ids,
        sold_product_key=result.sold_product_key,
        source_capacity_label=result.source_capacity_label,
        sold_capacity_label=result.sold_capacity_label,
        geometry_authority=False,
        dimensions=(),
        status="blocked",
    )


def _issue(entity_id: str, code: str, message: str) -> IssueRecord:
    payload = {"entity_id": entity_id, "code": code, "message": message}
    return IssueRecord(
        id=stable_id("issue", payload),
        entity_id=entity_id,
        severity="blocked",
        message=message,
        status="open",
        code=code,
    )


def _write_contract(pipeline_root: Path, contract: ContractRecord) -> Path:
    try:
        directory = CONTRACT_DIRECTORIES[contract.contract_type]
    except KeyError as error:
        raise ValueError(f"unsupported contract type: {contract.contract_type!r}") from error
    contract_id = safe_record_id(contract.id, "contract id")
    root = pipeline_root.resolve()
    contracts_root = resolve_descendant(root, root / "contracts", "contracts root")
    contract_directory = resolve_descendant(
        contracts_root, contracts_root / directory, "contract directory",
    )
    path = resolve_descendant(
        contracts_root, contract_directory / f"{contract_id}.json", "contract path",
    )
    atomic_write_json(path, contract.to_dict())
    return path


def _read_inspection(pipeline_root: Path, document: DocumentRecord) -> dict[str, Any]:
    document_id = safe_record_id(document.id, "document id")
    root = pipeline_root.resolve()
    evidence_root = resolve_descendant(root, root / "evidence", "evidence root")
    path = resolve_descendant(
        evidence_root,
        evidence_root / document_id / "inspection.json",
        "inspection path",
    )
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("inspection record must be a dictionary")
    return value


def reconcile_pending_documents(pipeline_root: Path) -> ReconciliationReport:
    """Draft contracts and blockers for inspected documents using JSON rule truth."""
    rules = load_identity_rules(pipeline_root / "reconciliation/identity-rules.json")
    results = []
    contracts = []
    issues = []
    reconciled_documents = []
    reconciled = 0
    needs_review = 0
    skipped = 0

    for document in iter_records(pipeline_root, "documents", DocumentRecord):
        if document.status not in {"inspected", "needs_reconciliation"}:
            skipped += 1
            continue
        result = suggest_identity(document, rules)
        results.append(result)
        reconciled_documents.append(document)
        if result.status != "matched":
            needs_review += 1
            issue = _issue(
                document.id,
                "UNRESOLVED_PRODUCT_IDENTITY",
                "No unambiguous identity rule matched this document's observed filenames.",
            )
            write_record(pipeline_root, "issues", issue)
            issues.append(issue)
            continue

        inspection = _read_inspection(pipeline_root, document)
        bottle = draft_contract(document, inspection, result)
        document_contracts = [bottle]
        document_issues = []
        if not bottle.geometry_authority:
            document_issues.append(_issue(
                bottle.id,
                "MISSING_BOTTLE_DRAWING",
                "The matched source is print-area-only; a dimensional bottle drawing is required.",
            ))

        for contract_type, code in (
            ("fitment", "MISSING_FITMENT_DRAWING"),
            ("component", "MISSING_COMPONENT_DRAWING"),
        ):
            placeholder = _blocked_contract(contract_type, document, result)
            document_contracts.append(placeholder)
            document_issues.append(_issue(
                placeholder.id,
                code,
                f"No source-backed {contract_type} drawing is available for "
                f"{result.sold_product_key}; dimensions were not inferred.",
            ))

        for contract in document_contracts:
            _write_contract(pipeline_root, contract)
        for issue in document_issues:
            write_record(pipeline_root, "issues", issue)
        contracts.extend(document_contracts)
        issues.extend(document_issues)
        reconciled += 1

    return ReconciliationReport(
        reconciled=reconciled,
        needs_review=needs_review,
        skipped=skipped,
        document_records=tuple(reconciled_documents),
        results=tuple(results),
        contract_records=tuple(contracts),
        issues=tuple(issues),
    )
