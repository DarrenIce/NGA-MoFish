export interface SearchPage<T> {
    results: T[];
    hasNext: boolean;
}

export function getSearchPageOffset(page: number, pageSize: number): number {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 1;
    return (safePage - 1) * safePageSize;
}

/** 调用方多取一条结果，用它判断下一页是否存在。 */
export function splitSearchPage<T>(results: T[], pageSize: number): SearchPage<T> {
    const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 1;
    return {
        results: results.slice(0, safePageSize),
        hasNext: results.length > safePageSize,
    };
}

/** NGA 每页返回对象的键可能重复，必须使用帖子自身的 tid 去重。 */
export function filterUniqueSearchResults<T>(
    results: T[],
    seenIds: Set<string>,
    getId: (result: T) => string | number | undefined | null,
): T[] {
    const unique: T[] = [];
    for (const result of results) {
        const id = getId(result);
        if (id === undefined || id === null || String(id) === '') {
            continue;
        }
        const normalizedId = String(id);
        if (seenIds.has(normalizedId)) {
            continue;
        }
        seenIds.add(normalizedId);
        unique.push(result);
    }
    return unique;
}
