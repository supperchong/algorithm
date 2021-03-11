import { writeFileSync, readFileSync, fstat, promises } from 'fs'
import { outBoundArrayPlugin } from '../babelPlugin'
import rollup = require("rollup");
import resolve from "@rollup/plugin-node-resolve";
import rollupBabelPlugin from "@rollup/plugin-babel";
import * as path from 'path'
import babel = require('@babel/core');
import presetTs = require('@babel/preset-typescript')
import virtual = require('@rollup/plugin-virtual');
import { getFuncNames } from '../common/util'
import esbuild = require("esbuild")
interface DebugOption {
    path: string
    lines: number[]
}
async function main() {
    const mainFilePath = process.argv[2]
    const dir = path.resolve(process.argv[3], '../../')
    const debugOptionsFilePath = process.argv[3]
    const file = readFileSync(debugOptionsFilePath, { encoding: 'utf8' })
    const outputDir = path.join(dir, 'out')
    await promises.mkdir(outputDir, { recursive: true })
    const codePath = path.join(outputDir, 'code.js')
    const codeMapPath = path.join(outputDir, 'code.js.map')
    const customBreakPoints: DebugOption[] = JSON.parse(file)
    const customBreakPoint = customBreakPoints.find(c => c.path.toLowerCase() === mainFilePath.toLowerCase())
    if (!customBreakPoint) {
        writeFileSync(codePath, '')
        writeFileSync(codeMapPath, '')
        console.log('breakpoint not found, please set breakpoint first')
        return
    }
    const lines = customBreakPoint.lines
    const mainFileCode = readFileSync(mainFilePath, { encoding: 'utf8' })
    let codeLines = mainFileCode.split('\n')
    const testRegExp = /\/\/\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/
    const funcNameRegExp = /^(?:\s*function\s*([\w]+)\s*|\s*(?:(?:var|let|const)\s+([\w]+)\s*=\s*)?function)/;

    const line = lines.find(num => testRegExp.test(codeLines[num]))
    let funName = ''
    let testCase = ''
    if (Number.isInteger(line)) {
        let match = codeLines[(line as number)].match(testRegExp)
        if (match) {
            testCase = match[1]
        }
        for (let i = (line as number) + 1; i < codeLines.length; i++) {
            let match = codeLines[i].match(funcNameRegExp);
            if (match) {
                funName = match[1] || match[2];
                break
            }

        }
    } else {
        writeFileSync(codePath, '')
        writeFileSync(codeMapPath, '')
        console.log('please select the test case')
        return
    }
    if (!funName) {
        writeFileSync(codePath, '')
        writeFileSync(codeMapPath, '')
        console.log('funName not found')
        return
    }
    // console.log('funName', funName)
    console.log('testCase', testCase)
    if (mainFilePath.endsWith('.ts')) {
        const finalCode = mainFileCode + '\n' + `${funName}(${testCase})`
        return buildTsCode(finalCode, mainFilePath, path.join(dir, 'out'))
    }

    const bundle = await rollup.rollup({
        input: mainFilePath,

        treeshake: false,
        plugins: [
            resolve(),
            rollupBabelPlugin({
                babelHelpers: "bundled",
                comments: false,
                plugins: [
                    outBoundArrayPlugin
                ],
            }),
        ],
    });
    const randomNumber = Math.random().toString().slice(2)
    const { output } = await bundle.generate({
        sourcemap: true, sourcemapPathTransform: (r, s) => {
            return path.join(path.parse(s).dir, r)
        }
    });
    let code = output[0].code;
    let map = output[0].map
    if (funName) {
        code += `${funName}(${testCase})\n`
    }

    code = code + '//# sourceMappingURL=code.js.map'
    if (map?.file) {
        map.file = 'code.js'
    }

    writeFileSync(codePath, code)
    writeFileSync(codeMapPath, JSON.stringify(map))
}
main()

export async function buildTsCode(text: string, filePath: string, dir: string) {
    return esbuild
        .build({
            stdin: {
                contents: text,
                loader: "ts",
                resolveDir: dir,
                sourcefile: filePath,
            },
            platform: "node",
            mainFields: ["module", "main"],
            bundle: true,
            format: "esm",
            treeShaking: true,
            outfile: "code.js",
            absWorkingDir: dir,
            sourcemap: "inline",
        })
        .catch((err) => {
            console.log(err)
        })

}