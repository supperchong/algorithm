import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as myExtension from '../../extension';
import { getTestCaseList } from '../../common/util';
const cases = [
    `// @algorithm @lc id=1576 lang=javascript weekname=weekly-contest-191
// @title reorder-routes-to-make-all-paths-lead-to-the-city-zero

// @test(6,[[0,1],[1,3],[2,3],[4,0],[4,5]])=3
// @test(5,[[1,0],[1,2],[3,2],[3,4]])=2
// @test(3,[[1,0],[2,0]])=0
/**
 * @param {number} n
 * @param {number[][]} connections
 * @return {number}
 */
var minReorder = function (n, connections) {
}
`
];
suite('Util Test Suite', () => {

    test('test getTestCaseList', () => {

        const testCaseList = getTestCaseList(cases[0]);
        assert.equal(testCaseList.length, 1);
        const { testCase, funcName, paramsTypes, resultType } = testCaseList[0];
        assert.deepEqual(testCase, ['// @test(6,[[0,1],[1,3],[2,3],[4,0],[4,5]])=3', '// @test(5,[[1,0],[1,2],[3,2],[3,4]])=2', '// @test(3,[[1,0],[2,0]])=0']);
    });
});

