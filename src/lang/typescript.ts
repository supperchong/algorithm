import { CaseList, getFuncNames, readFileAsync } from '../common/util'
import { config } from '../config'
import * as vscode from 'vscode'
import { BaseLang } from './base'
import { execTestChildProcess } from '../execTestCode'
import { TestOptions, LanguageMetaData, DebugOptions } from '../common/lang'
import { buildTsCode, main } from '../debugTask/index'
import * as path from 'path'
import babel = require('@babel/core');
import presetTs = require('@babel/preset-typescript')
import { outBoundArrayPlugin } from '../babelPlugin'
import rollup = require('rollup');
import virtual = require('@rollup/plugin-virtual');
import resolve from '@rollup/plugin-node-resolve';
import rollupBabelPlugin from '@rollup/plugin-babel';
import { window } from 'vscode';
import strip = require('@rollup/plugin-strip');
export class TypescriptParse extends BaseLang {
    static getPreImport() {
        return ''
    }
    funcRegExp = /^(?:(\s*function)|(.*=\s*function))/
    testRegExp = /\/\/\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/

    async runMultiple(caseList: CaseList, originCode: string, funcName: string) {
        const metaData = (await this.getQuestionMeta()) as LanguageMetaData | undefined
        if (!metaData) {
            throw new Error('question meta not found')
        }
        const options: TestOptions = {
            caseList,
            originCode,
            filePath: this.filePath,
            metaData: metaData
        }
        return await execTestChildProcess(options)
    }
    async buildCode() {
        try {
            const filePath = this.filePath
            let text = this.text!
            text= text.split('\n').filter(line =>!this.shouldRemoveInBuild(line)).join('\n')

            const dir = path.parse(filePath).dir
            const { funcNames, questionMeta } = getFuncNames(text, filePath);
            const funcRunStr = 'console.log(' + funcNames.map(f => f + '()').join('+') + ')';
            // The rollup will not transform code in virtual entry
            let entry: any = await babel.transformAsync(text, {
                filename: filePath,
                comments: false,
                compact: false,
                presets: [presetTs],
                plugins: [outBoundArrayPlugin]
            });
            entry = entry?.code + `\n${funcRunStr}`;
            const bundle = await rollup.rollup({
                input: 'entry',

                treeshake: true,
                plugins: [
                    // It use virtual entry because treeshake will remove unuse code.
                    virtual({
                        entry: entry
                    }),
                 
                    resolve({ rootDir: dir, modulesOnly: true }),
                  
                    rollupBabelPlugin({
                        babelHelpers: 'bundled',
                        comments: false,
                        shouldPrintComment: () => false,
                    },
                    )
                ]
            });
            const { output } = await bundle.generate({});
            let code = output[0].code;
            code = code.replace(funcRunStr, '').replace(/;\s*$/, '');
            return {
                code,
                questionMeta
            };

        } catch (err) {
            console.log('err:', err);
            window.showInformationMessage(`parse params err: ${err}`);
            return {
                code: '',
                questionMeta: {}
            };
        }
    }
    shouldRemoveInBuild(line: string): boolean {
        return /import\s*{\s*(ListNode|TreeNode)\s*}\s*from\s*'algm'/.test(line.trimLeft())
    }

    async runInNewContext(args: string[], originCode: string, funcName: string) {
        return ''
    }
    async handlePreImport() {
    }

    // do some thing before debug,eg. get testcase 
    async beforeDebug(breaks: vscode.SourceBreakpoint[]) {
        const args = await this.resolveArgsFromBreaks(breaks)
        const metaData = (await this.getQuestionMeta()) as LanguageMetaData | undefined
        if (!metaData) {
            throw new Error('question meta not found')
        }
        const originCode = await readFileAsync(this.filePath, { encoding: 'utf8' })
        const options: DebugOptions = {
            originCode,
            filePath: this.filePath,
            metaData: metaData
        }
        await this.writeTestCase(options, args)
    }
    async writeTestCase(options: DebugOptions, args: string[]) {
        return main(options, args)
    }

    getDebugConfig() {
        const { nodeBinPath } = config

        return {
            "type": "node",
            "request": "launch",
            "name": "debug question",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "program": "${workspaceFolder}/out/code.js",
            "outFiles": [
                "${workspaceFolder}/out/*.js"
            ],
            "runtimeVersion": "default",
            "runtimeExecutable": nodeBinPath,
            "sourceMaps": true,
            "args": [
                "${file}"
            ],
            // "preLaunchTask": "algorithm: build"
        }
    }

}