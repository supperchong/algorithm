import { existsSync, mkdirSync } from 'fs';

import os = require('os');
import path = require('path');
import { window, workspace, ConfigurationChangeEvent, OutputChannel, Uri, commands } from 'vscode';
import { Lang, AskForImportState } from './model/common'
import { cache } from './cache';
import { QuestionsProvider } from './provider/questionsProvider';
import { CodeLang } from './common/langConfig'
import * as cp from 'child_process'
import * as fs from 'fs'
import * as https from 'https'
import * as compressing from "compressing";
import axios from 'axios'
import { promisify } from 'util'
import { downloadNpm, unionArr, uniqueArrByKey } from './common/util'
import { MemoFile, MemoFolder } from './model/memo'
const rename = promisify(fs.rename)
const rmdir = promisify(fs.rmdir)
const execFileAsync = promisify(cp.execFile)
const customConfig = workspace.getConfiguration("algorithm");
const defaultCodeLang = CodeLang.JavaScript
const defaultNodeBinPath = 'node'
const defaultLang = Lang.en
const defaultBaseDir = path.join(os.homedir(), '.alg')
export const log = window.createOutputChannel('algorithm');
export const InstallState = {
    installEsbuild: false,
    installAlgm: false
}
interface BaseDir {
    algDir: string;
    cacheDir: string;
    questionDir: string
}

interface AlgorithmEnv {
    hasInstallEsbuild: boolean
    askForImportState: AskForImportState
    memo: MemoFolder[]
}

// the esbuild install in the extension dir and the extension dir change with the version change 
interface EnvFile {
    askForImportState: AskForImportState
    installEsbuildArr: string[]
    memo?: MemoFolder[]
}
export interface Config extends BaseDir {
    baseDir: string
    lang: Lang;
    cookiePath: string;
    log: OutputChannel;
    questionPath: string;
    tagPath: string;
    dbDir: string;
    nodeBinPath: string;
    codeLang: CodeLang
    // algorithmPath: string
    debugOptionsFilePath: string
    autoImportStr: string
    autoImportAlgm: boolean
    cacheBaseDir: string
    existAlgmModule: boolean,
    //the node_module dir
    moduleDir: string
    // the node_module/algm dir
    algmModuleDir: string
    env: AlgorithmEnv
    hasAskForImport: boolean
}
type UpdateConfigKey = keyof Pick<Config, 'lang' | 'nodeBinPath' | 'codeLang' | 'autoImportAlgm'>
function initConfig(): Config {

    const codeLang: CodeLang = customConfig.get('codeLang') || defaultCodeLang
    const autoImportStr: string = customConfig.get('autoImportStr') || ''
    const lang: Lang = customConfig.get("lang") || defaultLang
    const baseDir: string = customConfig.get("baseDir") || defaultBaseDir
    const algDir: string = path.join(baseDir, lang);
    const cacheBaseDir: string = path.join(os.homedir(), '.algcache');
    const cacheDir: string = path.join(os.homedir(), '.algcache', lang);
    const questionDir = path.join(baseDir, lang, codeLang)

    const cookiePath: string = path.join(cacheDir, 'cookie.json');
    const questionPath: string = path.join(cacheDir, 'question.json');
    const tagPath: string = path.join(cacheDir, 'tag.json');
    const dbDir: string = path.join(cacheDir, 'db')
    const nodeBinPath: string = workspace.getConfiguration("algorithm").get("nodePath") || defaultNodeBinPath;
    // const algorithmPath = path.join(__dirname, '../node_modules/algm')
    // const algorithmPath = path.join(cacheDir, 'node_modules/algm')
    const debugOptionsFilePath = path.join(baseDir, '.vscode/debugParams.json')
    const autoImportAlgm: boolean = customConfig.get('autoImportAlgm') || false
    const moduleDir: string = path.join(baseDir, 'node_modules')
    const algmModuleDir: string = path.join(moduleDir, 'algm')
    const existAlgmModule = fs.existsSync(algmModuleDir)
    const env = getEnv(cacheBaseDir)
    const hasAskForImport = false
    return {
        baseDir,
        lang,
        algDir,
        cacheBaseDir,
        cacheDir,
        cookiePath,
        log,
        questionPath,
        tagPath,
        dbDir,
        nodeBinPath,
        // algorithmPath,
        questionDir,
        codeLang,
        debugOptionsFilePath,
        autoImportStr,
        autoImportAlgm,
        moduleDir,
        algmModuleDir,
        existAlgmModule,
        env,
        hasAskForImport
    }
}
function init() {
    checkNodePath()
    initDir()
    checkAlgm()
    checkEsbuildDir()
}

function initDir() {
    const dirKeys: (keyof BaseDir)[] = ['cacheDir']
    dirKeys.forEach(key => {
        const dir = config[key]
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
        }
    })
}
function ensureMemoUnique(folders: MemoFolder[]) {
    if (folders.length <= 1) {return}
    uniqueArrByKey(folders, 'name')
    folders.forEach(folder => uniqueArrByKey(folder.children, 'name'))
}
function getEnv(cacheBaseDir: string): AlgorithmEnv {
    const envPath = path.join(cacheBaseDir, 'env.json')
    const defaultEnv: AlgorithmEnv = {
        hasInstallEsbuild: false,
        askForImportState: AskForImportState.Later,
        memo: []
    }
    try {
        const env: EnvFile = require(envPath)

        const dir = __dirname
        const installEsbuild = env.installEsbuildArr.find(v => v === dir)
        let askForImportState = env.askForImportState
        let memo = env.memo || []
        ensureMemoUnique(memo)
        const hasInstallEsbuild = !!installEsbuild
        return {
            ...defaultEnv,
            hasInstallEsbuild,
            askForImportState,
            memo
        }
    } catch (err) {
        return defaultEnv
    }

}
export function updateEnv<T extends keyof AlgorithmEnv>(key: T, value: AlgorithmEnv[T]) {
    config.env[key] = value
    const envPath = path.join(config.cacheBaseDir, 'env.json')
    const dir = __dirname
    const hasInstallEsbuild = config.env.hasInstallEsbuild
    let installEsbuildArr: string[] = []
    if (hasInstallEsbuild) {
        installEsbuildArr.push(dir)
    }
    let envFile: EnvFile = {
        askForImportState: config.env.askForImportState,
        installEsbuildArr: installEsbuildArr,
        memo: config.env.memo
    }
    try {
        const data = fs.readFileSync(envPath, { encoding: 'utf8' })
        const originEnvFile: EnvFile = JSON.parse(data)
        envFile.askForImportState = originEnvFile.askForImportState || envFile.askForImportState
        let originInstallEsbuildArr = originEnvFile.installEsbuildArr
        if (Array.isArray(originInstallEsbuildArr)) {
            envFile.installEsbuildArr = unionArr(installEsbuildArr, originInstallEsbuildArr)
        }
    } catch (err) {

    }
    fs.writeFileSync(envPath, JSON.stringify(envFile))
}
export const config = initConfig()


export function onChangeConfig(questionsProvider: QuestionsProvider, e: ConfigurationChangeEvent) {
    if (e.affectsConfiguration('algorithm.nodePath')) {
        updateNodePath()
    }
    if (e.affectsConfiguration('algorithm.lang')) {
        updateLang()
        initDir()
        cache.removeCache()
        questionsProvider.refresh()
    }
    if (e.affectsConfiguration('algorithm.codeLang')) {
        updateCodeLang()
        initDir()
    }
    if (e.affectsConfiguration('algorithm.autoImportStr')) {
        updateAutoImportStr()
    }
    if (e.affectsConfiguration('algorithm.baseDir')) {
        updateBaseDir()
        /**
         * do not init baseDir, as user change the baseDir,
         * and then do something activating the extension,
         * finally change the baseDir again.
         * All these baseDirs may be initialized even if no question file open.
         * Check the dir when question file open instead.
         */
    }
    if (e.affectsConfiguration('algorithm.autoImportAlgm')) {
        updateAutoImportAlgm()
    }
}

export function updateConfig<T extends UpdateConfigKey>(section: T, value: Config[T], isSync: boolean = false) {
    if (config[section] !== value) {
        workspace.getConfiguration("algorithm").update(section, value, true)
    }
    if (isSync) {
        config[section] = value
    }
}
function updateLang() {
    const baseDir = config.baseDir
    config.lang = workspace.getConfiguration("algorithm").get('lang') || defaultLang
    config.algDir = path.join(baseDir, config.lang);
    config.questionDir = path.join(baseDir, config.lang, config.codeLang)
    config.cacheDir = path.join(os.homedir(), '.algcache', config.lang);
    config.cookiePath = path.join(config.cacheDir, 'cookie.json');
    config.questionPath = path.join(config.cacheDir, 'question.json');
    config.tagPath = path.join(config.cacheDir, 'tag.json');
    config.dbDir = path.join(config.cacheDir, 'db')
}
function updateCodeLang() {
    const baseDir = config.baseDir
    config.codeLang = workspace.getConfiguration("algorithm").get('codeLang') || defaultCodeLang
    config.questionDir = path.join(baseDir, config.lang, config.codeLang)
}
function updateNodePath() {
    config.nodeBinPath = workspace.getConfiguration("algorithm").get("nodePath") || defaultNodeBinPath;
}
function updateAutoImportStr() {
    config.autoImportStr = workspace.getConfiguration("algorithm").get("autoImportStr") || ''
}
function updateBaseDir() {
    const baseDir: string = workspace.getConfiguration("algorithm").get("baseDir") || defaultBaseDir
    config.baseDir = baseDir
    config.algDir = path.join(baseDir, config.lang);
    config.questionDir = path.join(baseDir, config.lang, config.codeLang)
    config.debugOptionsFilePath = path.join(baseDir, '.vscode/debugParams.json')
    config.moduleDir = path.join(baseDir, 'node_modules')
    config.algmModuleDir = path.join(config.moduleDir, 'algm')
    config.existAlgmModule = fs.existsSync(config.algmModuleDir)
}
function updateAutoImportAlgm() {
    config.autoImportAlgm = workspace.getConfiguration("algorithm").get("autoImportAlgm") || false
    checkAlgm()
}
function checkNodePath() {
    const { nodeBinPath } = config
    cp.execFile(nodeBinPath, ['-v'], (err, data) => {
        if (err) {
            window.showInformationMessage('please set the node.js executable path')
        }
    })
}

async function checkAlgm() {
    if (config.autoImportAlgm) {
        const moduleDir = config.moduleDir
        const targetDir = config.algmModuleDir
        const name = 'algm'
        if (existsSync(targetDir)) {
            return
        }
        if (!InstallState.installAlgm) {
            InstallState.installAlgm = true
            log.appendLine('installing algm...')
            log.show()
            try {
                await downloadNpm(name, moduleDir)
                log.appendLine('install algm success')
            } catch (err) {
                console.log(err)
                log.appendLine('install algm fail')
            }
            InstallState.installAlgm = false
        }

    }
}


function checkEsbuildDir() {
    if (config.env.hasInstallEsbuild) {
        return
    }
    installEsbuild()
}
async function installEsbuild() {
    const name = 'esbuild'
    const moduleDir = path.join(__dirname, '..', 'node_modules')
    const targetDir = path.join(moduleDir, name)
    log.appendLine('installing esbuild from npm...')
    log.show()
    InstallState.installEsbuild = true
    try {
        if (!fs.existsSync(targetDir)) {
            await downloadNpm('esbuild', moduleDir)
        }

        const installFile = path.join(targetDir, 'install.js')
        if (fs.existsSync(installFile)) {
            const nodeBinPath = config.nodeBinPath
            const { stderr } = await execFileAsync(nodeBinPath, [installFile])
            if (stderr) {
                log.appendLine(stderr)
                log.appendLine('install esbuild fail')
            } else {
                updateEnv('hasInstallEsbuild', true)
                log.appendLine('install esbuild success')
            }

        }
    } catch (err) {
        log.appendLine(err)
        log.appendLine('install esbuild fail')
    }
    InstallState.installEsbuild = false


}

init()