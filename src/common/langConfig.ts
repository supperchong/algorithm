const langsConfig = {
    algorithms: [
        {
            "lang": "C++",
            "langSlug": "cpp",
            "ext": ".cpp",
            comment: '//'
        },
        {
            "lang": "Java",
            "langSlug": "java",
            "ext": ".java",
            comment: '//'
        },
        {
            "lang": "Python",
            "langSlug": "python",
            "ext": ".py",
            comment: '#'
        },
        {
            "lang": "Python3",
            "langSlug": "python3",
            "ext": ".py",
            comment: '#'
        },
        {
            "lang": "C",
            "langSlug": "c",
            "ext": ".c",
            comment: '//'
        },
        {
            "lang": "C#",
            "langSlug": "csharp",
            "ext": ".cs",
            comment: '//'
        },
        {
            "lang": "JavaScript",
            "langSlug": "javascript",
            "ext": ".js",
            comment: '//'
        },
        {
            "lang": "Ruby",
            "langSlug": "ruby",
            "ext": ".rb",
            comment: '#'

        },
        {
            "lang": "Swift",
            "langSlug": "swift",
            "ext": ".swift",
            comment: '//'
        },
        {
            "lang": "Go",
            "langSlug": "golang",
            "ext": ".go",
            comment: '//'
        },
        {
            "lang": "Scala",
            "langSlug": "scala",
            "ext": ".scala",
            comment: '//'
        },
        {
            "lang": "Kotlin",
            "langSlug": "kotlin",
            "ext": ".kt",
            comment: '//'
        },
        {
            "lang": "Rust",
            "langSlug": "rust",
            "ext": ".rs",
            comment: '//'
        },
        {
            "lang": "PHP",
            "langSlug": "php",
            "ext": ".php",
            comment: '//'
        },
        {
            "lang": "TypeScript",
            "langSlug": "typescript",
            "ext": ".ts",
            comment: '//'
        },
    ],
    database: [{
        lang: 'MySQL',
        langSlug: 'mysql',
        ext: '.sql',
        comment: '#'
    }, {
        lang: 'MS SQL Server',
        langSlug: 'mssql',
        ext: '.sql',
        comment: '#'
    }, {
        lang: 'Oracle',
        langSlug: 'oraclesql',
        ext: '.sql',
        comment: '#'
    }],
    shell: [{
        "lang": "Bash",
        "langSlug": "bash",
        "ext": ".sh",
        comment: '#'
    }],
};
export interface LangBase {
    lang: CodeLang
    langSlug: string
    ext: string
    comment: string
}
export interface LangMap {
    [langSlug: string]: LangBase
}
interface LangExtMap {
    [ext: string]: LangBase
}
const allLangs = Object.values(langsConfig).reduce((prev, cur) => prev.concat(cur));
export const langMap: LangMap = allLangs.reduce((prev, cur) => (prev[cur.langSlug] = cur) && prev, {});
export const langExtMap: LangExtMap = allLangs.reduce((prev, cur) => (prev[cur.ext] = cur) && prev, {});
export enum CodeLang {
    'C++' = 'C++',
    'C#' = 'C#',
    Java = 'Java',
    Python = 'Python',
    Python3 = 'Python3',
    C = 'C',
    JavaScript = 'JavaScript',
    Ruby = 'Ruby',
    Swift = 'Swift',
    Go = 'Go',
    Scala = 'Scala',
    Kotlin = 'Kotlin',
    Rust = 'Rust',
    PHP = 'PHP',
    TypeScript = 'TypeScript'
}
