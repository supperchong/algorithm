
import { parse } from 'pretty-object-string';
import { escape2html } from './util';
const isSpace = c => /\s/.test(c);
const isWord = c => /\w/.test(c);
function delComment(src) {
    var commentRegExp = /(\/\*([\s\S]*?)\*\/|('.*?')|(".*?")|\/\/(.*)$)/mg;
    return src.replace(commentRegExp, commentReplace);
}
function commentReplace(match, multi, multiText, singlePrefix, double) {
    return singlePrefix || double || '';
}
interface Demo {
    input: Input[],
    output: any
}
enum Kind {
    scanContinue,
    scanBeginTag,
    scanTagText,
    scanEndTag,
    scanWord,
    scanSpace,
    scanInputFlag,
    Identify,
    scanEqual,
    scanParam,
    scanResult
}
interface Input {
    key?: string
    value?: string
}
//TODO refactor
export class ParseContent {

    public step: (char: string, next: string, i: number) => Kind = this.stateBegin;
    public prevStep: (char: string, next?: string) => Kind = this.stateBegin;
    public word: string = '';
    public words: string[] = [];
    public tagStatus: number = 0;
    public exampleState: number = 0;
    public demos: Demo[] = [];
    constructor(
        public readonly content: string,
    ) {
        this.content = delComment(escape2html(content.replace(/<[^>]*>/g, '')));
        this.init();
    }
    init() {
        this.step = this.stateBegin;
        let word = '';
        let input: Input[] = [];
        const inputFlag = 'Input';
        const linkReg = /^\s*-?\d+->/;
        let demos: Demo[] = [];
        let identify;
        let i = 0;
        try {
            for (; i < this.content.length; i++) {
                const c = this.content[i];
                const n = this.content[i + 1];

                const out = this.step(c, n, i);
                if (out === Kind.Identify) {
                    identify = this.word;
                    this.word = '';
                } else if (out === Kind.scanParam) {
                    let value = this.content.slice(i, i + 10);
                    let index, output;
                    if (linkReg.test(value)) {
                        const result = this.parseLink(i);
                        index = result.index;
                        output = result.output;
                    } else {
                        value = this.content.slice(i);
                        const result = parse(value, { partialIndex: true, compress: true });
                        index = result.index;
                        output = result.output;
                    }
                    input.push({
                        key: identify,
                        value: output
                    });

                    i = i + index - 1;
                    this.step = this.stateInputIdentity2;
                } else if (out === Kind.scanResult) {
                    let value = this.content.slice(i, i + 10);
                    let index, output;
                    if (linkReg.test(value)) {
                        const result = this.parseLink(i);
                        index = result.index;
                        output = result.output;
                    } else {
                        value = this.content.slice(i);
                        const result = parse(value, { partialIndex: true, compress: true });
                        index = result.index;
                        output = result.output;

                    }
                    i = i + index - 1;
                    demos.push({
                        input,
                        output: output
                    });
                    input = [];
                    this.word = '';
                    identify = '';
                    this.step = this.stateWord;
                }


            }
        } catch (err) {
            console.log('content', this.content);
            console.log(this.content.slice(i - 20, i));
            console.log(err);
        }
        this.demos = demos;
    }
    static getTestCases(content: string) {
        const p = new ParseContent(content);
        return p.demos;
    }
    parseLink(index) {
        let str = '';
        let numStr = '';
        let output: number[] = [];
        let start = index;

        while (index < this.content.length && isSpace(this.content[index])) {
            index++;
        }
        while (index < this.content.length && /[\d->N]/.test(this.content[index])) {
            let char = this.content[index];
            str += char;
            if (/\d/.test(char)) {
                numStr += char;
            } else if (char === '-') {
                const nextChar = this.content[index + 1];
                if (nextChar === '>') {
                    output.push(parseInt(numStr));
                    numStr = '';
                } else if (/\d/.test(nextChar)) {
                    numStr = char;
                }

            } else if (char === 'N') {
                if (this.content.slice(index, index + 4) !== 'NULL') {
                    throw new Error('parse link error');
                }
                return {
                    index: index + 4 - start,
                    output: JSON.stringify(output)
                };
            }
            index++;
        }
        output.push(parseInt(numStr));
        return {
            index: index - start,
            output: JSON.stringify(output)
        };

    }
    lineEndAt(position) {
        let i = position;
        while (this.content[i++]) {
            if (this.content[i] === '\n') {
                return i;
            }
        }
        return i;

    }
    stateBegin(char: string): Kind {
        if (isSpace(char)) {
            return Kind.scanContinue;
        }

        this.step = this.stateWord;
        return this.stateWord(char);
    }
    stateWord(char: string): Kind {
        if (isSpace(char)) {

            this.word = '';
            return Kind.scanSpace;
        }
        this.word += char;
        if (this.exampleState === 1 && this.word === 'Input:') {
            this.word = '';
            this.exampleState = 0;
            this.step = this.stateInputIdentityOrValue;
        } else if (this.word === 'Example') {
            this.exampleState = 1;
        }
        return Kind.scanWord;
    }
    stateInputIdentityOrValue(char: string, n: string, i: number): Kind {
        if (isSpace(char)) {
            return Kind.scanSpace;
        }
        if (!/[a-zA-Z_]/.test(char) || /(true|false|null)/.test(this.content.slice(i, i + 6))) {
            return Kind.scanParam;
        }
        if (this.content.slice(i, i + 7) === 'Output:') {
            //Compatibility Special Conditions id:53
            /**
             * content Given an integer array nums, find the contiguous subarray (containing at least one number) which has the largest sum and return its sum.

                Example:


                Input: [-2,1,-3,4,-1,2,1,-5,4],
                Output: 6
                Explanation: [4,-1,2,1] has the largest sum = 6.

             */
            this.step = this.stateOut;
            return this.step(char, n, i);
        }
        this.step = this.stateInputIdentity;
        return this.step(char, n, i);
    }
    stateInputIdentity(char: string, n: string, i: number): Kind {
        if (isSpace(char)) {
            if (!this.word) {
                return Kind.scanSpace;
            }
            this.step = this.stateEqual;
            return Kind.Identify;
        }
        if (!isWord(char)) {
            throw new Error('input identity invalid');
        }
        this.word += char;
        return Kind.scanWord;

    }
    stateEqual(char: string): Kind {
        if (isSpace(char)) {
            return Kind.scanSpace;
        }
        if (char === '=') {
            this.step = this.stateParam;
            return Kind.scanEqual;
        }
        throw new Error('parse equal error');
    }
    stateParam(char: string): Kind {
        if (isSpace(char)) {
            return Kind.scanSpace;
        }
        return Kind.scanParam;
    }
    stateInputIdentity2(char: string, n: string, i: number): Kind {
        if (isSpace(char)) {
            return Kind.scanSpace;
        }
        if (char === ',') {
            this.step = this.stateInputIdentityOrValue;
            return Kind.scanContinue;
        }
        this.step = this.stateOut;
        return this.step(char, n, i);

    }
    stateOut(char: string): Kind {
        if (isSpace(char)) {
            return Kind.scanSpace;
        }
        this.word += char;
        if (this.word === 'Output:') {
            this.word = '';
            this.step = this.stateResult;
            return Kind.scanContinue;
        }
        return Kind.scanContinue;


    }
    stateResult(char: string): Kind {
        this.word += char;
        return Kind.scanResult;
    }


}