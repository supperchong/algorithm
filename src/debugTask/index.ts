import { writeFileSync, readFileSync, fstat, promises } from 'fs'
import { outBoundArrayPlugin } from '../babelPlugin'
import rollup = require("rollup");
import resolve from "@rollup/plugin-node-resolve";
import rollupBabelPlugin from "@rollup/plugin-babel";
import * as path from 'path'
import babel = require('@babel/core');
import presetTs = require('@babel/preset-typescript')
import virtual = require('@rollup/plugin-virtual');
import { CodeLang, getFileLang } from '../common/langConfig';
import { TestOptions, LanguageMetaData, DebugOptions } from '../common/lang';
import { tag } from 'pretty-tag'
import { handleArgsType } from '../common/util';

export async function main(options:DebugOptions,args:string[]) {
    const mainFilePath =options.filePath
    const dir = path.resolve(mainFilePath,'..','..','..')

    const outputDir = path.join(dir, 'out')
    const codeLang = getFileLang(mainFilePath)
    if (![CodeLang.JavaScript, CodeLang.TypeScript].includes(codeLang)) {
        console.log('only support JavaScript and TypeScript')
        return
    }
    await promises.mkdir(outputDir, { recursive: true })
    const codePath = path.join(outputDir, 'code.js')
    const codeMapPath = path.join(outputDir, 'code.js.map')

    const mainFileCode =options.originCode

    const meta=options.metaData
    let funName = meta.name
  
    if (codeLang === CodeLang.TypeScript) {

        const finalCode=mainFileCode+'\n'+handleArgsType(meta,'',args,true)
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
    const { output } = await bundle.generate({
        sourcemap: true, sourcemapPathTransform: (r, s) => {
            return path.join(path.parse(s).dir, r)
        }
    });
    let code = output[0].code;
    let map = output[0].map
    if (funName) {
        code += handleArgsType(meta,'',args)+'\n'
    }

    code = code + '//# sourceMappingURL=code.js.map'
    if (map?.file) {
        map.file = 'code.js'
    }

    writeFileSync(codePath, code)
    writeFileSync(codeMapPath, JSON.stringify(map))
}

export async function buildTsCode(text: string, filePath: string, dir: string) {
    return require('esbuild')
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