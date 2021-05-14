#include "parse.h"
#include <iostream>
#include "algm.h"
using namespace std;

string transformBool(bool t)
{
    if (t == 1)
    {
        return "ok";
    }
    else
    {
        return "fail";
    }
}

bool deepEqual(vector<int> &a, vector<int> &b)
{
    if (a.size() != b.size())
    {
        return false;
    }
    for (int i = 0; i < a.size(); i++)
    {
        if (a[i] != b[i])
        {
            return false;
        }
    }
    return true;
}
bool deepEqual(vector<string> &a, vector<string> &b)
{
    if (a.size() != b.size())
    {
        return false;
    }
    for (int i = 0; i < a.size(); i++)
    {
        if (a[i] != b[i])
        {
            return false;
        }
    }
    return true;
}
bool deepEqual(vector<vector<int>> &a, vector<vector<int>> &b)
{
    if (a.size() != b.size())
    {
        return false;
    }
    for (int i = 0; i < a.size(); i++)
    {
        if (!deepEqual(a[i], b[i]))
        {
            return false;
        }
    }
    return true;
}
bool deepEqual(vector<vector<string>> &a, vector<vector<string>> &b)
{
    if (a.size() != b.size())
    {
        return false;
    }
    for (int i = 0; i < a.size(); i++)
    {
        if (!deepEqual(a[i], b[i]))
        {
            return false;
        }
    }
    return true;
}
int main()
{
    int num = parseInteger("1");
    cout << "test parseInteger: " << transformBool(num == 1) << endl;

    vector<int> nums = parseIntegerArr("[1,2,3]");
    vector<int> target{1, 2, 3};
    cout << "test parseIntegerArr: " << transformBool(deepEqual(nums, target)) << endl;

    vector<vector<int>> nums2 = parseIntegerArrArr("[[1,2,3],[4,5,6]]");
    vector<vector<int>> target2{vector<int>{1, 2, 3}, vector<int>{4, 5, 6}};
    cout << "test parseIntegerArrArr: " << transformBool(deepEqual(nums2, target2)) << endl;

    string str3 = parseString("\"abc\\\"\"");
    string target3 = "abc\"";
    cout << "test parseString: " << transformBool(str3 == target3) << endl;

    vector<string> str4 = parseStringArr("[\"abc\\\"\"]");
    vector<string> target4{"abc\""};
    cout << "test parseStringArr: " << transformBool(deepEqual(str4, target4)) << endl;

    vector<vector<string>> str5 = parseStringArrArr("[[\"1\",\"2\",\"3\"],[\"4\",\"5\",\"6\"]]");
    vector<vector<string>> target5{vector<string>{"1", "2", "3"}, vector<string>{"4", "5", "6"}};
    cout << "test parseStringArrArr: " << transformBool(deepEqual(str5, target5)) << endl;

    string origin6 = "[1,2,null,3]";
    TreeNode *treeNode6 = parseTreeNode("[1,2,null,3]");
    string target6 = serializeTreeNode(treeNode6);
    cout << "test parseTreeNode: " << transformBool(origin6 == target6) << endl;

    string origin7 = "[1,2,3]";
    ListNode *listNode7 = parseListNode(origin7);
    string target7 = serializeListNode(listNode7);
    cout << "test parseListNode: " << transformBool(origin7 == target7) << endl;

    string origin8 = "[[1,2,3]]";
    vector<ListNode *> listNodeArr8 = parseListNodeArr(origin8);
    string target8 = serializeListNodeArr(listNodeArr8);
    cout << "test parseListNodeArr: " << transformBool(origin8 == target8) << endl;

    string origin9 = "[[1,2,null,3],[1,2,3]]";
    vector<TreeNode *> listNodeArr9 = parseTreeNodeArr(origin9);
    string target9 = serializeTreeNodeArr(listNodeArr9);
    cout << "test parseTreeNodeArr: " << transformBool(origin9 == target9) << endl;

    string origin10="2.00000";
    double num10=parseFloat(origin10);
    string target10=serializeFloat(num10);
    cout << "test serializeFloat: " << transformBool(origin10==target10 ) << endl;
}