package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// ListNode Definition for singly-linked list.
type ListNode struct {
	Val  int
	Next *ListNode
}

// TreeNode Definition for a binary tree node.
type TreeNode struct {
	Val   int
	Left  *TreeNode
	Right *TreeNode
}

func serializeInterface(data interface{}) string {
	r2, _ := json.Marshal(data)
	return string(r2)
}

func deserializeTreeNode(data string) *TreeNode {
	length := len(data)
	if length <= 2 {
		return nil
	}

	arr := strings.Split(data[1:length-1], ",")
	val, _ := strconv.Atoi(arr[0])
	arr = arr[1:]
	root := &TreeNode{Val: val}
	queue := []*TreeNode{root}
	for len(queue) > 0 {
		node := queue[0]
		queue = queue[1:]
		if len(arr) == 0 {
			return root
		}

		leftVal := arr[0]
		arr = arr[1:]
		if leftVal != "null" {
			val, _ := strconv.Atoi(leftVal)
			left := &TreeNode{Val: val}
			node.Left = left
			queue = append(queue, left)
		}
		if len(arr) == 0 {
			return root
		}
		rightVal := arr[0]
		arr = arr[1:]
		if rightVal != "null" {
			val, _ := strconv.Atoi(rightVal)
			right := &TreeNode{Val: val}
			node.Right = right
			queue = append(queue, right)
		}

	}
	return root

}
func deserializeTreeNodeArr(data string) []*TreeNode {
	length := len(data)
	if length <= 4 {
		return []*TreeNode{}
	}
	str := data[1 : length-1]
	r := []*TreeNode{}
	for i := 0; i < len(str); i++ {
		if str[i:i+1] == "[" {
			flag := false
			j := i + 1
			for ; j < len(str); j++ {
				if str[j:j+1] == "]" {
					r = append(r, deserializeTreeNode(str[i:j+1]))
					flag = true
					break
				}
			}
			if !flag {
				fmt.Print("parse error")
				return []*TreeNode{}
			}
			i = j
		}
	}
	return r

}
func serializeTreeNode(root *TreeNode) string {
	if root == nil {
		return "[]"
	}
	var arr []string
	queue := []*TreeNode{root}
	for len(queue) > 0 {
		node := queue[0]
		queue = queue[1:]
		if node != nil {
			arr = append(arr, strconv.Itoa(node.Val))
			queue = append(queue, node.Left)
			queue = append(queue, node.Right)
		} else {
			arr = append(arr, "null")
		}

	}
	var i = len(arr) - 1
	for arr[i] == "null" {
		i--
	}
	arr = arr[0 : i+1]
	return "[" + strings.Join(arr, ",") + "]"
}

func serializeTreeNodeArr(arr []*TreeNode) string {
	strArr := "["
	for i := 0; i < len(arr); i++ {
		strArr += serializeTreeNode(arr[i])
		if i != len(arr)-1 {
			strArr += ","
		}
	}
	strArr += "]"
	return strArr
}

func deserializeListNode(data string) *ListNode {
	length := len(data)
	if length <= 2 {
		return nil
	}
	arr := strings.Split(data[1:length-1], ",")

	c := arr[0]
	arr = arr[1:]
	val, _ := strconv.Atoi(c)
	root := &ListNode{Val: val}
	p := root
	for len(arr) > 0 {

		c := arr[0]
		arr = arr[1:]
		val, _ := strconv.Atoi(c)
		node := &ListNode{Val: val}
		p.Next = node
		p = node
	}
	return root
}

func deserializeListNodeArr(data string) []*ListNode {
	length := len(data)
	if length <= 4 {
		return []*ListNode{}
	}
	str := data[1 : length-1]
	r := []*ListNode{}
	for i := 0; i < len(str); i++ {
		if str[i:i+1] == "[" {
			flag := false
			j := i + 1
			for ; j < len(str); j++ {
				if str[j:j+1] == "]" {
					r = append(r, deserializeListNode(str[i:j+1]))
					flag = true
					break
				}
			}
			if !flag {
				//解析错误
				fmt.Print("解析错误")
				return []*ListNode{}
			}
			i = j
		}
	}
	return r
}
func serializeListNode(root *ListNode) string {
	var arr []string
	p := root
	for p != nil {
		arr = append(arr, strconv.Itoa(p.Val))
		p = p.Next
	}
	return "[" + strings.Join(arr, ",") + "]"
}
func serializeListNodeArr(arr []*ListNode) string {
	newArr := []string{}
	for i := 0; i < len(arr); i++ {
		newArr = append(newArr, serializeListNode(arr[i]))
	}
	return "[" + strings.Join(newArr, ",") + "]"
}

func parseInteger(param string) int {
	num, err := strconv.Atoi(param)
	if err != nil {
		panic(err)
	}
	return num
}
func parseString(param string) string {
	var r string
	json.Unmarshal([]byte(param), &r)
	return r
}
func parseFloat(param string) float64 {
	num, err := strconv.ParseFloat(param, 64)
	if err != nil {
		panic(err)
	}
	return num
}
func parseIntegerArr(param string) []int {
	var r []int
	json.Unmarshal([]byte(param), &r)
	return r
}
func parseStringArr(param string) []string {
	var r []string
	json.Unmarshal([]byte(param), &r)
	return r
}
func parseIntegerArrArr(param string) [][]int {
	var r [][]int
	json.Unmarshal([]byte(param), &r)
	return r
}

func parseStringArrArr(param string) [][]string {
	var r [][]string
	json.Unmarshal([]byte(param), &r)
	return r
}
func serializeFloat(a float64) string {
	return strconv.FormatFloat(a, 'f', 5, 64)
}
