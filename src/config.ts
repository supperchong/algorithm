import { existsSync, mkdirSync } from 'fs';

import os = require('os');
import path = require('path');
import { window, workspace, ConfigurationChangeEvent, OutputChannel, Uri, commands } from 'vscode';
import { Lang } from './model/common'
import { cache } from './cache';
import { QuestionsProvider } from './provider/questionsProvider';
import { CodeLang } from './common/langConfig'
import * as cp from 'child_process'
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
    algorithmPath: string
    debugOptionsFilePath: string
    autoImportStr: string
}

function initConfig(): Config {
    const log = window.createOutputChannel('algorithm');
    const codeLang: CodeLang = customConfig.get('codeLang') || defaultCodeLang
    const autoImportStr: string = customConfig.get('autoImportStr') || ''
    const lang: Lang = customConfig.get("lang") || defaultLang
    const baseDir: string = customConfig.get("baseDir") || defaultBaseDir
    const algDir: string = path.join(baseDir, lang);
    const cacheDir: string = path.join(os.homedir(), '.algcache', lang);
    const questionDir = path.join(baseDir, lang, codeLang)

    const cookiePath: string = path.join(cacheDir, 'cookie.json');
    const questionPath: string = path.join(cacheDir, 'question.json');
    const tagPath: string = path.join(cacheDir, 'tag.json');
    const dbDir: string = path.join(cacheDir, 'db')
    const nodeBinPath: string = workspace.getConfiguration("algorithm").get("nodePath") || defaultNodeBinPath;
    const algorithmPath = path.join(__dirname, '../node_modules/algm')
    const debugOptionsFilePath = path.join(baseDir, '.vscode/debugParams.json')

    return {
        baseDir,
        lang,
        algDir,
        cacheDir,
        cookiePath,
        log,
        questionPath,
        tagPath,
        dbDir,
        nodeBinPath,
        algorithmPath,
        questionDir,
        codeLang,
        debugOptionsFilePath,
        autoImportStr
    }
}
function init() {
    checkNodePath()
    initDir()
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
}
function checkNodePath() {
    const { nodeBinPath } = config
    cp.execFile(nodeBinPath, ['-v'], (err, data) => {
        if (err) {
            window.showInformationMessage('please set the node.js executable path')
        }
    })
}


init()