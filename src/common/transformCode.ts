import * as recast from 'recast'
import * as acorn from 'acorn'
import { builders, namedTypes } from 'ast-types'
import { FunctionDeclarationKind, VariableDeclarationKind } from 'ast-types/gen/kinds'

function addAstComment(ast: namedTypes.File, comment: string, funName: string) {
	const visitor = {
		FunctionDeclaration: (node: FunctionDeclarationKind) => {
			if (node.id && node.id.name === funName) {
				insertLineComment(node, comment)
			}
		},
		VariableDeclaration: (node: VariableDeclarationKind) => {
			if (
				node.declarations.find((declaration) => {
					return (
						declaration.type === 'VariableDeclarator' &&
						declaration.id.type === 'Identifier' &&
						declaration.id.name === funName
					)
				})
			) {
				insertLineComment(node, comment)
			}
		},
	}
	const body = ast.program.body
	for (const node of body) {
		let fn = visitor[node.type]
		if (fn) {
			fn(node)
		}
	}
}
function insertLineComment(node: VariableDeclarationKind | FunctionDeclarationKind, comment: string) {
	const commentNode = builders.commentLine(comment, true)
	let originComments = node.comments || []
	let mergeComments = [commentNode, ...originComments]

	node.comments = mergeComments
}
export function addComment(source: string, comment: string, funName: string) {
	const ast: namedTypes.File = recast.parse(source, {
		parser: acorn,
	})
	addAstComment(ast, comment, funName)
	const output = recast.print(ast).code
	return output
}
