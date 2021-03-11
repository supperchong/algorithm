import rollup = require("rollup");
import resolve from "@rollup/plugin-node-resolve";
import rollupBabelPlugin from "@rollup/plugin-babel";
import { transformSync } from '@babel/core'
import virtual = require('@rollup/plugin-virtual');

import * as path from 'path'
import * as fs from 'fs'
import sourceMap = require("source-map")
import {
    parseTestCase,
    TestResult,
    normalize,
    getResultType,
    deserializeParam,
} from "../common/util";
import { outBoundArrayPlugin } from '../babelPlugin'
import { Script } from "vm";
import { Args } from '../common/util'
import { langExtMap, LangBase, CodeLang } from '../common/langConfig'
import presetTs = require('@babel/preset-typescript')
const defaultTimeout = 10000;
const supportCodeLang = [CodeLang.JavaScript, CodeLang.TypeScript]
let options = ''
process.stdin.on('data', data => {
    options += data
});
process.stdin.on('end', async () => {
    try {
        const msg = await execTestCase(JSON.parse(options.toString()));
        console.log(msg);
    } catch (err) {
        console.log(err);
    }
})
async function execTestCase(options) {
    const {
        line,
        testCase,
        funcName,
        paramsTypes,
        resultType,
        filepath,
    } = options;
    const fileParse = path.parse(filepath)
    const filename = fileParse.name
    const ext = fileParse.ext
    const langItem = langExtMap[ext]
    if (!langItem) {
        return 'file extension is invalid'
    }
    if (!supportCodeLang.includes(langItem.lang)) {
        return `${langItem.lang} is currently not supported`
    }
    const output = await buildCode(filepath, langItem)
    const code = output[0].code;
    const caseList = parseTestCase(testCase);
    const list: TestResult[] = [];
    for (const { args, result: expect } of caseList) {
        const originArgs = [...args]
        const { hasTree, hasList } = deserializeParam(args, paramsTypes);
        const rt = getResultType(resultType);
        const finalCode = formatCodeOutput(code, funcName, rt, args)

        const script = new Script(finalCode, {});
        try {
            const result = script.runInNewContext(
                {
                    console,
                },
                {
                    timeout: defaultTimeout,
                    displayErrors: true,
                    lineOffset: 0,
                }
            );
            list.push({
                args: originArgs.join(","),
                expect: expect,
                result: normalize(result, rt),
            });
        } catch (err) {
            return handleErrPosition(err, output[0].map as rollup.SourceMap, originArgs)
        }

    }
    return handleMsg(list, caseList)
}

async function buildCode(filepath: string, langItem: LangBase) {
    if (langItem.lang === CodeLang.TypeScript) {
        return buildTsCode(filepath)
    }
    return buildJsCode(filepath)
}
async function buildJsCode(filepath: string) {
    let plugins = [
        resolve(),
        rollupBabelPlugin({
            babelHelpers: "bundled",
            comments: false,
            plugins: [
                outBoundArrayPlugin
            ],
        })
    ]
    const bundle = await rollup.rollup({
        input: filepath,
        treeshake: false,
        plugins,
    });
    const { output } = await bundle.generate({
        sourcemap: true, sourcemapPathTransform: (r, s) => {
            return path.join(path.parse(s).dir, r)
        }
    });
    return output
}

async function buildTsCode(filepath: string) {
    const code = fs.readFileSync(filepath, { encoding: 'utf8' })
    const entry = transformSync(code, {
        filename: filepath,
        comments: false,
        presets: [presetTs],
        plugins: [outBoundArrayPlugin]
    })
    const bundle = await rollup.rollup({
        input: 'entry',

        treeshake: false,
        plugins: [
            virtual({
                entry: entry
            }),
            resolve(),
        ]
    });
    const { output } = await bundle.generate({});
    return output
}

function formatCodeOutput(code: string, funcName: string, rt: string, args: string[]) {
    let funExecExpression = `${funcName}(${args.join(",")})`;
    if (rt === "TreeNode") {
        funExecExpression = `treeNode.serialize(${funExecExpression})`;
    } else if (rt === "ListNode") {
        funExecExpression = `listNode.serialize(${funExecExpression})`;
    }
    const finalCode = code + `;${funExecExpression}`;
    return finalCode
}
function handleMsg(testResultList: TestResult[], caseList: Args[]) {
    const success = testResultList.every(
        (v) => (v.expect && v.expect.trim()) === (v.result && v.result.trim())
    );
    let msg = "";
    if (success) {
        msg = `✓ ${caseList.length} tests complete`;
    } else {
        msg =
            testResultList
                .map((v) => {
                    if (v.expect === v.result) {
                        return `✓ @test(${v.args})\n`;
                    } else {
                        return `× @test(${v.args})  result: ${v.result} ,expect: ${v.expect}\n`;
                    }
                })
                .join("") + "\n";

    }
    return msg;
}
async function handleErrPosition(err: Error, map: sourceMap.RawSourceMap, args: string[]) {
    const consumer = await new sourceMap.SourceMapConsumer(map)

    const regexp = /evalmachine\.<anonymous>\:(\d+)\:?(\d+)?/g
    let msg = `× @test(${args.join(',')})\n`
    const stack: string = err.stack as string
    msg += stack.replace(regexp, (_, line, column) => {
        line = parseInt(line)
        column = parseInt(column) || 0
        let originPosition = consumer.originalPositionFor({
            line: line,
            column: column,
        })
        if (originPosition.source) {
            if (column) {
                return originPosition.source + ':' + originPosition.line + ':' + originPosition.column
            } else {
                return originPosition.source + ':' + originPosition.line
            }
        }
        return _
    })
    consumer.destroy()
    return msg
}