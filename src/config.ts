import { existsSync, mkdirSync } from 'fs';

import os = require('os');
import path = require('path');
import { window, workspace, ConfigurationChangeEvent, OutputChannel, Uri, commands } from 'vscode';
import { Lang } from './model/common'
import { cache } from './cache';
import { QuestionsProvider } from './provider/questionsProvider';
import { CodeLang } from './common/langConfig'
import * as cp from 'child_process'
import * as fs from 'fs'
import * as https from 'https'
import * as compressing from "compressing";
import axios from 'axios'
import { promisify } from 'util'
import { downloadNpm } from './common/util'
const rename = promisify(fs.rename)
const rmdir = promisify(fs.rmdir)
const execFileAsync = promisify(cp.execFile)
const customConfig = workspace.getConfiguration("algorithm");
const defaultCodeLang = CodeLang.JavaScript
const defaultNodeBinPath = 'node'
const defaultLang = Lang.en
const defaultBaseDir = path.join(os.homedir(), '.alg')
export const log = window.createOutputChannel('algorithm');

interface BaseDir {
    algDir: string;
    cacheDir: string;
    questionDir: string
}
interface AlgorithmEnv{
    hasInstallEsbuild:boolean
}
type UpdateConfigKey = 'lang' | 'nodeBinPath' | 'codeLang'
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
    autoImportAlgm: boolean | undefined
    cacheBaseDir: string
    existAlgmModule: boolean,
    //the node_module dir
    moduleDir: string
    // the node_module/algm dir
    algmModuleDir: string
    env:AlgorithmEnv
}

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
    const env=getEnv(cacheBaseDir)
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
        env
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
function getEnv(cacheBaseDir:string):AlgorithmEnv{
    const envPath=path.join(cacheBaseDir,'env.json')
    const defaultEnv={
        hasInstallEsbuild:false
    }
    try{
        const env= require(envPath)
        return env
    }catch(err){
        return defaultEnv
    }
    
}
function updateEnv<T extends keyof AlgorithmEnv>(key:T,value:AlgorithmEnv[T]){
    config.env[key]=value
    const envPath=path.join(config.cacheBaseDir,'env.json')
    fs.writeFileSync(envPath,JSON.stringify(config.env))
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
}


export function updateConfig(section: UpdateConfigKey, value: string, questionsProvider: QuestionsProvider) {
    if (config[section] !== value) {
        workspace.getConfiguration("algorithm").update(section, value, true)
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
        log.appendLine('installing algm...')
        log.show()
        await downloadNpm(name, moduleDir)
        log.appendLine('install algm success')
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
    if(!fs.existsSync(targetDir)){
        await downloadNpm('esbuild', moduleDir)
    }
    
    const installFile = path.join(targetDir, 'install.js')
    if (fs.existsSync(installFile)) {
        const nodeBinPath = config.nodeBinPath
        const { stderr } = await execFileAsync(nodeBinPath, [installFile])
        if (stderr) {
            log.appendLine(stderr)
        } else {
            updateEnv('hasInstallEsbuild',true)
            log.appendLine('install esbuild success')
        }
    }
}

init()