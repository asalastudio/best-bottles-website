/**
 * The pilot's rows as the register records them: which SKUs, which glass,
 * and each SKU's own parts. Shared by the Phase 4 scripts.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const ROOT = resolve(__dirname, "..", "..", "..");
export const PILOT_BODY_ID = "cylinder-9ml-17-415";

export type PilotAssembly = {
    graceSku: string;
    websiteSku: string;
    glass: string;
    fitmentType: string;
    capColor: string;
    status: string;
    buildStatus: string;
    /** [{ role, componentId }] parsed from "roller:LIB-17-415-MtlRollon; cap:CMP-ROC-BLK-17415-DOT" */
    buildParts: { role: string; componentId: string }[];
};

/** A minimal CSV reader for the register's files (no embedded newlines; quotes only around commas). */
export function readCsv(path: string): Record<string, string>[] {
    const lines = readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line.length > 0);
    const parse = (line: string): string[] => {
        const cells: string[] = [];
        let cell = "", quoted = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (quoted) {
                if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
                else if (ch === '"') quoted = false;
                else cell += ch;
            } else if (ch === '"') quoted = true;
            else if (ch === ",") { cells.push(cell); cell = ""; }
            else cell += ch;
        }
        cells.push(cell);
        return cells;
    };
    const header = parse(lines[0]);
    return lines.slice(1).map((line) => Object.fromEntries(parse(line).map((value, i) => [header[i], value])));
}

export function pilotAssemblies(): PilotAssembly[] {
    return readCsv(resolve(ROOT, "data", "register", "assemblies.csv"))
        .filter((row) => row.bodyId === PILOT_BODY_ID)
        .map((row) => ({
            graceSku: row.graceSku,
            websiteSku: row.websiteSku,
            glass: row.glass,
            fitmentType: row.fitmentType,
            capColor: row.capColor,
            status: row.status,
            buildStatus: row.buildStatus,
            buildParts: row.buildParts.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
                const [role, componentId] = part.split(":");
                return { role: role.trim(), componentId: componentId.trim() };
            }),
        }));
}
