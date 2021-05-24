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
    handleArgsType,
} from "../common/util";
import { outBoundArrayPlugin } from '../babelPlugin'
import { Script } from "vm";
import { handleMsg } from '../common/util'
import { langExtMap, LangBase, CodeLang, getFileLang } from '../common/langConfig'
import presetTs = require('@babel/preset-typescript')
import { TestOptions, LanguageMetaData } from "../common/lang";
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
async function execTestCase(options:TestOptions) {
    const {
        caseList,
        originCode,
        filePath,
        metaData
    } = options;
    const lang = getFileLang(filePath)
    if (!supportCodeLang.includes(lang)) {
        return `${lang} is currently not supported`
    }
    const output = await buildCode(filePath, lang)
    const code = output[0].code;
    const list: TestResult[] = [];
    for (const { args, result: expect } of caseList) {
        const originArgs = [...args]
 
        const finalCode = handleArgsType(metaData,code,args)
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
                result:result,
            });
        } catch (err) {
            return handleErrPosition(err, output[0].map as rollup.SourceMap, originArgs)
        }

    }
    return handleMsg(list)
}

async function buildCode(filePath: string, lang: CodeLang) {
    if (lang === CodeLang.TypeScript) {
        return buildTsCode(filePath)
    }
    return buildJsCode(filePath)
}
async function buildJsCode(filePath: string) {
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
        input: filePath,
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

async function buildTsCode(filePath: string) {
    const code = fs.readFileSync(filePath, { encoding: 'utf8' })
    const fileDir = path.parse(filePath).dir
    const entry = transformSync(code, {
        filename: filePath,
        comments: false,
        cwd: fileDir,
        presets: [[presetTs, { onlyRemoveTypeImports: true }]],
        plugins: [outBoundArrayPlugin]
    })

    const bundle = await rollup.rollup({
        input: 'entry',
        treeshake: false,
        plugins: [
            virtual({
                entry: entry?.code
            }),
            resolve({ rootDir: fileDir, browser: false }),

        ]
    });
    const { output } = await bundle.generate({});
    return output
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