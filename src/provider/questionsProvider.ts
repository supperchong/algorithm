import * as vscode from 'vscode';
import { QuestionPreview } from '../webview/questionPreview';
import { config } from '../config'
import { resolverEn, ResolverFn, ResolverParam, ResolverType } from './resolver'
import { resolverCn } from './resolver.cn'
import * as path from 'path'

export class QuestionsProvider implements vscode.TreeDataProvider<QuestionTree> {
  private _onDidChangeTreeData: vscode.EventEmitter<QuestionTree | undefined> = new vscode.EventEmitter<QuestionTree | undefined>();
  readonly onDidChangeTreeData: vscode.Event<QuestionTree | undefined> = this._onDidChangeTreeData.event;
  constructor(private workspaceRoot: ReadonlyArray<vscode.WorkspaceFolder> | undefined, private _extensionPath: string) { }
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
  async previewQuestion(element: QuestionTree) {
  }
  getTreeItem(element: QuestionTree): vscode.TreeItem {
    return element;
  }
  getChildren(element?: QuestionTree): Thenable<QuestionTree[]> {
    let resolver: ResolverType
    if (config.lang === 'en') {
      resolver = resolverEn
    } else {
      resolver = resolverCn
    }
    if (element) {
      const type = element.type;
      const key = element.key;
      const param = element.param || {}
      let fn: ResolverFn
      if (key) {
        fn = resolver[type][key];
      } else {
        fn = resolver[type] as ResolverFn;
      }
      return Promise.resolve(fn(param))
        .then(arr => {
          if (!arr.length) { return [] }
          const isLastChild = arr[0].isLast
          if (isLastChild) {
            return arr.map(v => {

              let dep = new QuestionTree(v.label, v.id, vscode.TreeItemCollapsibleState.None, v.type, v.key, v.param, { title: 'QuestionPreview', command: QuestionPreview, arguments: [v.param] });
              if (v.paidOnly) {
                dep.iconPath = new vscode.ThemeIcon('lock')
              } else {
                // dep.iconPath = v.isAC ? new vscode.ThemeIcon('check') : ''
                dep.iconPath = v.isAC ? path.join(__dirname, '..', '..', 'media', 'ac.svg') : ''
              }
              dep.contextValue = 'memo'
              return dep;
            }
            );
          } else {
            return arr.map(v => new QuestionTree(v.label, v.id, vscode.TreeItemCollapsibleState.Collapsed, v.type, v.key, v.param || {}));
          }

        }).catch(err => {
          console.log(err)
          return []
        })

    } else {
      return Promise.resolve(resolver.Query()).then(arr => arr.map(v => new QuestionTree(v.label, v.id, vscode.TreeItemCollapsibleState.Collapsed, v.type, v.key, v.param || {})));
    }
  }

}


export class QuestionTree extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly id: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: string,
    public readonly key?: string,
    public readonly param?: Partial<ResolverParam>,
    public readonly command?: vscode.Command,
  ) {
    super(label, collapsibleState);
  }

}