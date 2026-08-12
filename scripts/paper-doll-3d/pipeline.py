#!/usr/bin/env python3
"""Command-line dispatcher for the paper-doll document-contract foundation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

from pipeline_lib.index import rebuild_index
from pipeline_lib.inspection import inspect_pending_documents
from pipeline_lib.intake import intake_documents
from pipeline_lib.legacy import inventory_pending_legacy_assets
from pipeline_lib.orchestrator import (
    foundation_status,
    index_summary,
    inspection_summary,
    intake_summary,
    legacy_summary,
    reconciliation_summary,
    run_foundation,
    run_summary,
)
from pipeline_lib.reconciliation import reconcile_pending_documents
from pipeline_lib.review import write_foundation_review


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PIPELINE_ROOT = REPOSITORY_ROOT / "pipeline/paper-doll-3d"
DEFAULT_SOURCE = DEFAULT_PIPELINE_ROOT / "specs"


def _pipeline_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--pipeline-root", type=Path, default=DEFAULT_PIPELINE_ROOT,
        help="paper-doll pipeline root",
    )


def _source_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--source", type=Path, default=DEFAULT_SOURCE,
        help="read-only manufacturer PDF directory",
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    intake = commands.add_parser("intake", help="archive source PDFs by hash")
    _source_argument(intake)
    _pipeline_argument(intake)

    inspect = commands.add_parser("inspect", help="generate visual inspection evidence")
    _pipeline_argument(inspect)

    reconcile = commands.add_parser("reconcile", help="draft contracts and blockers")
    _pipeline_argument(reconcile)

    inventory = commands.add_parser(
        "inventory-legacy", help="inventory existing Blender scenes without opening Blender",
    )
    _pipeline_argument(inventory)
    inventory.add_argument(
        "--master-root", type=Path,
        help="explicit read-only master root (defaults to PIPELINE_ROOT/master)",
    )

    rebuild = commands.add_parser("rebuild-index", help="rebuild the disposable SQLite index")
    _pipeline_argument(rebuild)

    review = commands.add_parser("review", help="write the foundation review packet")
    _pipeline_argument(review)

    status = commands.add_parser("status", help="report authoritative foundation status")
    _pipeline_argument(status)
    status.add_argument("--json", action="store_true", help="emit machine-readable JSON")

    run = commands.add_parser("run", help="advance foundation stages through review")
    _source_argument(run)
    _pipeline_argument(run)
    run.add_argument(
        "--mirror-dir", type=Path,
        help="explicit read-only specs mirror (defaults to PIPELINE_ROOT/specs)",
    )
    run.add_argument(
        "--master-root", type=Path,
        help="explicit read-only master root (defaults to PIPELINE_ROOT/master)",
    )
    return parser


def _print_json(value: object) -> None:
    print(json.dumps(value, sort_keys=True, indent=2))


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    root = args.pipeline_root
    if args.command == "intake":
        value = intake_summary(intake_documents(args.source, root))
    elif args.command == "inspect":
        value = inspection_summary(inspect_pending_documents(root))
    elif args.command == "reconcile":
        value = reconciliation_summary(reconcile_pending_documents(root))
    elif args.command == "inventory-legacy":
        value = legacy_summary(
            inventory_pending_legacy_assets(root, master_root=args.master_root),
        )
    elif args.command == "rebuild-index":
        value = index_summary(rebuild_index(root, root / "indexes/pipeline.sqlite"))
    elif args.command == "review":
        review_path = write_foundation_review(
            root, root / "reviews/foundation/document-contract-foundation.md",
        )
        value = {"command": "review", "review_path": str(review_path)}
    elif args.command == "status":
        value = foundation_status(root)
    else:
        value = run_summary(run_foundation(
            args.source,
            root,
            mirror_dir=args.mirror_dir,
            master_root=args.master_root,
        ))
    _print_json(value)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
