"""Paths for the hero pipeline. Override with environment variables; nothing else is hardcoded.

    BB_HERO_WORK     working folder for bases, renders, sized files, proofs (default ~/BestBottles/hero-work)
    BB_PSD_LIBRARY   the master PSD library (default ~/Projects/Clients/Nemat-International/BB-PSD-Files-Master)
REPO is found by walking up from this file to package.json.
"""
import os

WORK = os.environ.get("BB_HERO_WORK") or os.path.expanduser("~/BestBottles/hero-work")
PSD_LIBRARY = os.environ.get("BB_PSD_LIBRARY") or os.path.expanduser("~/Projects/Clients/Nemat-International/BB-PSD-Files-Master")
_root = os.path.dirname(os.path.abspath(__file__))
while _root != "/" and not os.path.exists(os.path.join(_root, "package.json")):
    _root = os.path.dirname(_root)
REPO = _root
os.makedirs(WORK, exist_ok=True)
