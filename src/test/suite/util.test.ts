import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as myExtension from '../../extension';
import { getTestCaseList, unionArr } from '../../common/util';
import { addComment } from '../../common/transformCode'

interface UnionArrDemo<T> {
    params: T[][],
    result: T[]
}
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
`,
    `// @algorithm 

//@test([1,2])
/**
 * @param {TreeNode} root 
 * @return {void}
 */
var func = function(root) {
}
`,
    `// @algorithm

// @test([4,2,7,1,3],2)=[2,1,3]
/**
 * Definition for a binary tree node.
 * function TreeNode(val) {
 *     this.val = val;
 *     this.left = this.right = null;
 * }
 */
/**
 * @param {TreeNode} root
 * @param {number} val
 * @return {TreeNode}
 */
var searchBST = function (root, val) {
};`

];
suite('Util Test Suite', () => {

    test('test getTestCaseList', () => {

        const testCaseList = getTestCaseList(cases[0]);
        assert.equal(testCaseList.length, 1);
        const { testCase, funcName, paramsTypes, resultType } = testCaseList[0];
        assert.deepEqual(testCase, ['// @test(6,[[0,1],[1,3],[2,3],[4,0],[4,5]])=3', '// @test(5,[[1,0],[1,2],[3,2],[3,4]])=2', '// @test(3,[[1,0],[2,0]])=0']);
        assert.equal(funcName, 'minReorder');
        assert.deepEqual(paramsTypes, ['number', 'number[][]']);
        assert.equal(resultType, 'number');
    });
    test('test void return', () => {

        const testCaseList = getTestCaseList(cases[1]);
        const { testCase, funcName, paramsTypes, resultType } = testCaseList[0];
        assert.equal(testCaseList.length, 1);
        assert.equal(resultType, 'void');
        assert.deepEqual(paramsTypes, ['TreeNode']);
    });
    test('test ', () => {

        const testCaseList = getTestCaseList(cases[2]);
        const { testCase, funcName, paramsTypes, resultType } = testCaseList[0];
        assert.equal(testCaseList.length, 1);
        // assert.equal(resultType, 'void')
        // assert.deepEqual(paramsTypes, ['TreeNode'])
    });
    test('test add comment', () => {
        const source = `
        //this is a test
        /**
         * this is a test too
         */
        function main() {

        }
        `
        let result = `
        //hhh
        //this is a test
        /**
         * this is a test too
         */
        function main() {

        }
        `
        let out = addComment(source, 'hhh', 'main')
        assert.deepStrictEqual(out, result)
    })
    test('test unionArr', () => {
        const list: UnionArrDemo<string>[] = [{
            params: [['xiao', 'li'], ['li', 'wang']],
            result: ['xiao', 'li', 'wang']
        }, {
            params: [['xiao', 'li'], []],
            result: ['xiao', 'li']
        }, {
            params: [[], []],
            result: []
        }, {
            params: [[], ['abc']],
            result: ['abc']
        }
        ]
        list.forEach(({ params, result }) => assert.deepStrictEqual(unionArr(params[0], params[1]), result))
    })
});
