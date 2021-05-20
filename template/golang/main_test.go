package main

import (
	"testing"

	. "github.com/franela/goblin"
)

func Test(t *testing.T) {
	g := Goblin(t)
	g.Describe("test parse", func() {
		g.It("should parse integer", func() {
			a := parseInteger("12")
			g.Assert(a).Equal(12)
		})
		g.It("should parse string", func() {
			a := parseString("\"12\"")
			g.Assert(a).Equal("12")
		})
		g.It("should parse float", func() {
			a := parseFloat("1.22")
			g.Assert(a).Equal(1.22)
		})
		g.It("should parse integer[]", func() {
			a := parseIntegerArr("[1,2,3]")
			g.Assert(a).Equal([]int{1, 2, 3})
		})
		g.It("should parse string[]", func() {
			a := parseStringArr("[\"1\",\"2\",\"3\"]")
			g.Assert(a).Equal([]string{"1", "2", "3"})
		})
		g.It("should parse integer[][]", func() {
			a := parseIntegerArrArr("[[1,2,3],[4,5,6]]")
			g.Assert(a).Equal([][]int{[]int{1, 2, 3}, []int{4, 5, 6}})
		})
		g.It("should parse string[][]", func() {
			a := parseStringArrArr("[[\"1\",\"2\",\"3\"],[\"4\",\"5\",\"6\"]]")
			g.Assert(a).Equal([][]string{[]string{"1", "2", "3"}, []string{"4", "5", "6"}})
		})
	})
	g.Describe("test serialize", func() {
		g.It("should serialize integer", func() {
			a := serializeInterface(12)
			g.Assert(a).Equal("12")
		})
		g.It("should serialize string", func() {
			a := serializeInterface("12")
			g.Assert(a).Equal("\"12\"")
		})
		g.It("should serialize double", func() {
			a := serializeFloat(1.22)
			g.Assert(a).Equal("1.22000")
		})
		g.It("should serialize integer[]", func() {
			a := serializeInterface([]int{1, 2, 3})
			g.Assert(a).Equal("[1,2,3]")
		})
		g.It("should serialize string[]", func() {
			a := serializeInterface([]string{"1", "2", "3"})
			g.Assert(a).Equal("[\"1\",\"2\",\"3\"]")
		})
		g.It("should serialize integer[][]", func() {
			a := serializeInterface([][]int{[]int{1, 2, 3}, []int{4, 5, 6}})
			g.Assert(a).Equal("[[1,2,3],[4,5,6]]")
		})
		g.It("should serialize string[][]", func() {
			a := serializeInterface([][]string{[]string{"1", "2", "3"}, []string{"4", "5", "6"}})
			g.Assert(a).Equal("[[\"1\",\"2\",\"3\"],[\"4\",\"5\",\"6\"]]")
		})
		g.It("should serialize list<integer>", func() {
			a := serializeInterface([]int{1, 2, 3})
			g.Assert(a).Equal("[1,2,3]")
		})

		g.It("should serialize list<string>", func() {
			a := serializeInterface([]string{"1", "2", "3"})
			g.Assert(a).Equal("[\"1\",\"2\",\"3\"]")
		})
		g.It("should serialize list<list<integer>>", func() {
			a := serializeInterface([][]int{[]int{1, 2, 3}, []int{4, 5, 6}})
			g.Assert(a).Equal("[[1,2,3],[4,5,6]]")
		})
		g.It("should serialize list<list<string>>", func() {
			a := serializeInterface([][]string{[]string{"1", "2", "3"}, []string{"4", "5", "6"}})
			g.Assert(a).Equal("[[\"1\",\"2\",\"3\"],[\"4\",\"5\",\"6\"]]")
		})
		g.It("should serialize TreeNode", func() {
			treeNode := deserializeTreeNode("[1,2,3,null,null,4,5]")
			str := serializeTreeNode(treeNode)
			g.Assert(str).Equal("[1,2,3,null,null,4,5]")

		})
		g.It("should serialize ListNode", func() {
			treeNode := deserializeListNode("[1,2,3,4,5]")
			str := serializeListNode(treeNode)
			g.Assert(str).Equal("[1,2,3,4,5]")
		})
		g.It("should serialize list<TreeNode>", func() {
			data := "[[1,2,3,null,null,4,5],[1,2,3]]"
			t1 := deserializeTreeNodeArr(data)
			str := serializeTreeNodeArr(t1)
			g.Assert(str).Equal(data)
		})
		g.It("should serialize list<ListNode>", func() {
			data := "[[4,5,6],[1,2,3]]"
			t1 := deserializeListNodeArr(data)
			str := serializeListNodeArr(t1)
			g.Assert(str).Equal(data)
		})
	})
}
