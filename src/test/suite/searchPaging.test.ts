import * as assert from 'assert';
import {
    filterUniqueSearchResults,
    getSearchPageOffset,
    splitSearchPage,
} from '../../process/searchPaging';

suite('Search paging', () => {
    test('calculates a stable result offset for each page', () => {
        assert.strictEqual(getSearchPageOffset(1, 50), 0);
        assert.strictEqual(getSearchPageOffset(2, 50), 50);
        assert.strictEqual(getSearchPageOffset(3, 50), 100);
        assert.strictEqual(getSearchPageOffset(0, 50), 0);
    });

    test('uses the extra fetched result to detect the next page', () => {
        assert.deepStrictEqual(splitSearchPage([1, 2, 3], 2), {
            results: [1, 2],
            hasNext: true,
        });
        assert.deepStrictEqual(splitSearchPage([1, 2], 2), {
            results: [1, 2],
            hasNext: false,
        });
    });

    test('deduplicates pages by topic id instead of the repeated object key', () => {
        const seenIds = new Set<string>();
        const firstResponse = {
            0: { tid: '101', title: '第一帖' },
            1: { tid: '102', title: '第二帖' },
        };
        const secondResponse = {
            0: { tid: '103', title: '第三帖' },
            1: { tid: '104', title: '第四帖' },
        };
        const firstPage = filterUniqueSearchResults(
            Object.keys(firstResponse).map((key) => firstResponse[Number(key) as 0 | 1]),
            seenIds,
            (topic) => topic.tid,
        );
        const secondPage = filterUniqueSearchResults(
            Object.keys(secondResponse).map((key) => secondResponse[Number(key) as 0 | 1]),
            seenIds,
            (topic) => topic.tid,
        );
        assert.deepStrictEqual(firstPage.map((topic) => topic.tid), ['101', '102']);
        assert.deepStrictEqual(secondPage.map((topic) => topic.tid), ['103', '104']);
    });
});
