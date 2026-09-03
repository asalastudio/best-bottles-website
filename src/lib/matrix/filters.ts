export type MatrixFilterState = {
    search: string;
    size: string;
    finish: string;
    neck: string;
    closure: string;
};

export function emptyMatrixFilters(): MatrixFilterState {
    return { search: "", size: "", finish: "", neck: "", closure: "" };
}
