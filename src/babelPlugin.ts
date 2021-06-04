import { types as t } from '@babel/core'
const regexp = /^@get\((-?\d+|Infinity|-Infinity)\)$/

function generatelogicalExpression(arr: any[]) {
	if (arr.length === 2) {
		return t.logicalExpression('&&', arr[0], arr[1])
	} else if (arr.length > 2) {
		return t.logicalExpression('&&', arr[0], generatelogicalExpression(arr.slice(1)))
	} else {
		return arr[0]
	}
}

function toBinaryExpression(node) {
	return t.binaryExpression('>=', node, t.numericLiteral(0))
}
type NumberProperty = t.Identifier | t.NumericLiteral | t.BinaryExpression
type ComputeProperty = t.Identifier | t.BinaryExpression
function isValidNumberProperty(property: t.Expression | t.Identifier | t.PrivateName): property is NumberProperty {
	return property.type === 'Identifier' || property.type === 'NumericLiteral' || property.type === 'BinaryExpression'
}
function isValidComputeProperty(property: NumberProperty): property is ComputeProperty {
	return property.type === 'Identifier' || property.type === 'BinaryExpression'
}
export function outBoundArrayPlugin() {
	return {
		visitor: {
			VariableDeclaration(path: babel.NodePath<babel.types.Node>) {
				if (
					t.isVariableDeclaration(path.node) &&
					path.node.leadingComments &&
					path.node.leadingComments.find((v) => regexp.test(v.value))
				) {
					let comment = path.node.leadingComments.find((v) => regexp.test(v.value)) as t.Comment
					const regexpResult = regexp.exec(comment.value) as RegExpExecArray
					const numStr = regexpResult[1]
					let numNode: t.Identifier | t.UnaryExpression | t.NumericLiteral
					if (numStr === 'Infinity') {
						numNode = t.identifier('Infinity')
					} else if (numStr === '-Infinity') {
						numNode = t.unaryExpression('-', t.identifier('Infinity'))
					} else {
						numNode = t.numericLiteral(parseInt(numStr))
					}
					const declaration = path.node.declarations[0]
					const id = declaration.id
					if (!t.isIdentifier(id)) {
						return
					}
					const name = id.name
					const bind = path.scope.bindings[name]
					const referencePaths = bind.referencePaths
					referencePaths.forEach((r) => {
						let nodes: ComputeProperty[] = []
						while (r.parentPath.node.type === 'MemberExpression' && r.parentPath.node.computed) {
							const node = r.parentPath.node
							if (!isValidNumberProperty(node.property)) {
								return
							}
							if (isValidComputeProperty(node.property)) {
								nodes.push(node.property)
							}

							r = r.parentPath
						}

						if (nodes.length && !(r.key === 'left' && r.parentPath.type === 'AssignmentExpression')) {
							nodes = nodes.map((node) => toBinaryExpression(node))
							r.replaceWith(
								t.conditionalExpression(
									generatelogicalExpression(nodes),
									r.node as t.MemberExpression,
									numNode
								)
							)
						}
					})
				}
			},
		},
	}
}

export function generateAddTestCommentPlugin(funcName: string, comment: string) {
	return function addTestCommentPlugin() {
		return {
			visitor: {
				VariableDeclaration(path: babel.NodePath<babel.types.VariableDeclaration>) {
					const funcDeclaration = path.node.declarations.find((dec) => {
						return (
							dec.id.type === 'Identifier' &&
							dec.id.name === funcName &&
							dec.init?.type === 'FunctionExpression'
						)
					})
					if (funcDeclaration) {
						path.addComment('leading', comment, true)
						path.stop()
					}
				},
				FunctionDeclaration(path: babel.NodePath<babel.types.FunctionDeclaration>) {
					const name = path.node.id?.name
					if (name === funcName) {
						path.addComment('leading', comment, true)
						path.stop()
					}
				},
			},
		}
	}
}

export function removeExtraTypePlugin() {
	return {
		visitor: {
			ClassDeclaration(path: babel.NodePath<babel.types.DeclareClass>) {
				const extraTypes = ['ListNode', 'TreeNode']
				if (path.node.id && extraTypes.includes(path.node.id.name)) {
					path.remove()
				}
			},
		},
	}
}
