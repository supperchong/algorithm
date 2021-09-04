#include <vector>
#include <string>
#include <regex>
#include <iostream>
#include <queue>
#include "algm.h"
// #include "ListNode.h"
// #include "TreeNode.h"
using namespace std;

void split(string param, char seg, vector<string> &arr)
{
    string temp = "";
    for (auto it = param.begin(); it != param.end(); it++)
    {
        if (*it == seg)
        {
            arr.push_back(temp);
            temp = "";
        }
        else
        {
            temp += *it;
        }
    }
    arr.push_back(temp);
}
int parseInteger(string param)
{
    return atoi(param.data());
}
double parseFloat(string param)
{
    string::size_type size;
    return stod(param, &size);
}
string serializeFloat(double param)
{
    string str = to_string(param);
    return str.substr(0, str.length() - 1);
}
string serializeBool(bool t)
{
    if (t == true)
    {
        return "true";
    }
    return "false";
}
vector<int> parseIntegerArr(string param)
{
    vector<int> nums;
    if (param.length() <= 2)
    {
        return nums;
    }
    string temp = "";
    string::iterator it;
    for (it = param.begin() + 1; it != param.end() - 1; it++)
    {
        if (*it == ',')
        {
            nums.push_back(stoi(temp));
            temp = "";
        }
        else
        {
            temp += *it;
        }
    }
    if (temp != "")
    {
        nums.push_back(stoi(temp));
    }
    return nums;
}
vector<vector<int>> parseIntegerArrArr(string param)
{
    vector<vector<int>> nums;
    int len = param.length();
    if (len <= 4)
    {
        return nums;
    }
    string subStr = param.substr(1, len - 2);
    for (int i = 1; i < len - 1; i++)
    {
        if (param[i] == '[')
        {
            string temp = "";
            temp += param[i++];
            while (param[i] != ']')
            {
                temp += param[i++];
            }
            temp += param[i++];
            vector<int> arr = parseIntegerArr(temp);
            nums.push_back(arr);
        }
    }
    return nums;
}
string parseString(string param)
{
    if (param.length() <= 2)
    {
        return "";
    }
    string out = "";
    string::iterator it;
    for (int i = 1; i < param.length(); i++)
    {
        char c = param[i];
        if (c == '\\')
        {
            char n = param[i + 1];
            if (n == 'u')
            {
                string unicodeStr = param.substr(i + 2, 4);
                char16_t num = strtol(unicodeStr.data(), NULL, 16);
                out += num;
                i += 5;
            }
            else
            {
                char echars[8] = {'"', '\\', '/', 'b', 'f', 'n', 'r', 't'};
                char realChars[8] = {'"', '\\', '/', '\b', '\f', '\n', '\r', '\t'};
                bool has = false;
                for (int j = 0; j < 8; j++)
                {
                    if (echars[j] == n)
                    {
                        has = true;
                        out += realChars[j];
                        i++;
                        break;
                    }
                }
                if (!has)
                {
                    throw "parse string error in " + param.substr(0, i + 1);
                }
            }
        }
        else if (c == '"')
        {
            return out;
        }
        else
        {
            out += c;
        }
    }
    throw "parse string error in " + param;
}
vector<string> parseStringArr(string param)
{
    vector<string> strs;
    int len = param.length();

    if (len <= 2)
    {
        return strs;
    }
    regex e("\"(\\\\.|[^\"\\\\])*\"");
    std::regex_iterator<std::string::iterator> rit(param.begin(), param.end(), e);
    std::regex_iterator<std::string::iterator> rend;

    while (rit != rend)
    {
        string str = rit->str();
        strs.push_back(parseString(str));
        ++rit;
    }
    return strs;
}
vector<vector<string>> parseStringArrArr(string param)
{
    vector<vector<string>> strs;
    int len = param.length();
    if (len <= 4)
    {
        return strs;
    }
    regex e("\"(\\\\.|[^\"\\\\])*\"");
    regex_iterator<string::iterator> rit(param.begin(), param.end(), e);
    regex_iterator<string::iterator> rend;
    for (int i = 1; i < len - 1; i++)
    {
        if (param[i] == '[')
        {
            char nextChar = param[i + 1];
            string temp = "[";
            i++;
            while ((i < len - 1) && nextChar != ']')
            {

                int start = rit->position();
                int end = start + rit->length();
                i = end;
                nextChar = param[end];
                temp += param.substr(start, +rit->length());
                rit++;
            }
            i++;
            temp += "]";

            vector<string> arr = parseStringArr(temp);
            strs.push_back(arr);
        }
    }
    return strs;
}

char parseChar(string param)
{
    string str = parseString(param);
    return str.at(0);
}

vector<char> parseCharArr(string param)
{
    vector<char> r;
    vector<string> strArr = parseStringArr(param);
    for (auto it = strArr.begin(); it != strArr.end(); it++)
    {
        r.push_back((*it).at(0));
    }
    return r;
}

vector<vector<char>> parseCharArrArr(string param)
{
    vector<vector<char>> r;
    vector<vector<string>> strArrArr = parseStringArrArr(param);
    for (auto it = strArrArr.begin(); it != strArrArr.end(); it++)
    {
        vector<string> strArr = *it;
        vector<char> item;
        for (auto it2 = strArr.begin(); it2 != strArr.end(); it2++)
        {
            item.push_back((*it2).at(0));
        }
        r.push_back(item);
    }
    return r;
}

string serializeChar(char param)
{
    string r = "\"";
    if (param == '\\' || param == '"')
    {

        r += '\\';
    }
    r += param;
    r += '"';
    return r;
}
string serializeCharArr(vector<char> param)
{
    string r = "[";
    for (auto it = param.begin(); it != param.end(); it++)
    {
        if (it != param.begin())
        {
            r += ",";
        }
        r += serializeChar(*it);
    }
    r += "]";
    return r;
}
string serializeCharArrArr(vector<vector<char>> param)
{
    string r = "[";
    for (auto it = param.begin(); it != param.end(); it++)
    {
        if (it != param.begin())
        {
            r += ",";
        }
        r += serializeCharArr(*it);
    }
    r += "]";
    return r;
}
TreeNode *parseTreeNode(string param)
{
    int len = param.length();
    if (len <= 2)
    {
        return nullptr;
    }
    vector<string> nodeData;
    split(param.substr(1, len - 2), ',', nodeData);
    if (nodeData.size() == 0)
    {
        return nullptr;
    }

    int i = 0;
    int val = stoi(nodeData[i++]);
    TreeNode *root = new TreeNode(val);
    queue<TreeNode *> q;
    q.push(root);
    while (q.size() > 0)
    {
        TreeNode *node = q.front();
        q.pop();
        if (i == nodeData.size())
        {
            return root;
        }

        string leftVal = nodeData[i++];
        if (leftVal != "null")
        {

            node->left = new TreeNode(stoi(leftVal));
            q.push(node->left);
        }
        if (i == nodeData.size())
        {
            return root;
        }
        string rightVal = nodeData[i++];
        if (rightVal != "null")
        {

            node->right = new TreeNode(stoi(rightVal));
            q.push(node->right);
        }
    }
    return root;
}
ListNode *parseListNode(string param)
{
    int len = param.length();
    if (len <= 2)
    {
        return nullptr;
    }
    vector<string> arr;
    split(param.substr(1, len - 2), ',', arr);
    ListNode *head = new ListNode();
    ListNode *p = head;

    for (auto it = arr.begin(); it != arr.end(); it++)
    {
        p->next = new ListNode(stoi(*it));
        p = p->next;
    }

    return head->next;
}
vector<ListNode *> parseListNodeArr(string param)
{
    vector<ListNode *> result;
    int len = param.length();
    if (len <= 4)
    {
        return result;
    }
    string subStr = param.substr(1, len - 2);
    for (int i = 1; i < len - 1; i++)
    {
        if (param[i] == '[')
        {
            string temp = "";
            temp += param[i++];
            while (param[i] != ']')
            {
                temp += param[i++];
            }
            temp += param[i++];
            ListNode *arr = parseListNode(temp);
            result.push_back(arr);
        }
    }
    return result;
}
vector<TreeNode *> parseTreeNodeArr(string param)
{
    vector<TreeNode *> result;
    int len = param.length();
    if (len <= 4)
    {
        return result;
    }
    string subStr = param.substr(1, len - 2);
    for (int i = 1; i < len - 1; i++)
    {
        if (param[i] == '[')
        {
            string temp = "";
            temp += param[i++];
            while (param[i] != ']')
            {
                temp += param[i++];
            }
            temp += param[i++];
            TreeNode *arr = parseTreeNode(temp);
            result.push_back(arr);
        }
    }
    return result;
}

string serializeInteger(int param)
{
    string str = to_string(param);
    return str;
}
string serializeIntegerArr(vector<int> &arr)
{
    string out = "";
    for (auto it = arr.begin(); it != arr.end(); it++)
    {
        if (it == arr.end() - 1)
        {
            out += serializeInteger(*it);
        }
        else
        {
            out += serializeInteger(*it) + ",";
        }
    }
    return "[" + out + "]";
}
string serializeIntegerArrArr(vector<vector<int>> &arr)
{
    string out = "";
    for (auto it = arr.begin(); it != arr.end(); it++)
    {
        if (it == arr.end() - 1)
        {
            out += serializeIntegerArr(*it);
        }
        else
        {
            out += serializeIntegerArr(*it) + ",";
        }
    }
    return "[" + out + "]";
}
string serializeString(string param)
{
    int pos = 0;
    string out = "";
    for (auto it = param.begin(); it != param.end(); it++)
    {
        if (*it == '\\' || *it == '"')
        {
            out += "\\" + *it;
        }
        else
        {
            out += *it;
        }
    }
    return "\"" + out + "\"";
}
string serializeStringArr(vector<string> &param)
{
    string out = "";
    for (auto it = param.begin(); it != param.end(); it++)
    {
        if (it == param.end() - 1)
        {
            out += serializeString(*it);
        }
        else
        {
            out += serializeString(*it) + ",";
        }
    }
    return "[" + out + "]";
}
string serializeStringArrArr(vector<vector<string>> &param)
{
    string out = "";
    for (auto it = param.begin(); it != param.end(); it++)
    {
        if (it == param.end() - 1)
        {
            out += serializeStringArr(*it);
        }
        else
        {
            out += serializeStringArr(*it) + ",";
        }
    }
    return "[" + out + "]";
}
string serializeListNode(ListNode *head)
{
    string out = "";
    while (head != nullptr)
    {
        out += to_string(head->val);
        head = head->next;
        if (head != nullptr)
        {
            out += ",";
        }
    }
    return "[" + out + "]";
}
string serializeTreeNode(TreeNode *root)
{
    if (root == nullptr)
    {
        return "[]";
    }

    vector<string> arr;
    queue<TreeNode *> q;
    q.push(root);
    while (q.size() > 0)
    {

        TreeNode *node = q.front();
        q.pop();
        if (node == nullptr)
        {
            arr.push_back("null");
        }
        else
        {
            arr.push_back(to_string(node->val));
            q.push(node->left);
            q.push(node->right);
        }
    }

    while (arr.back() == "null")
    {
        arr.pop_back();
    }
    string out = "";
    for (auto it = arr.begin(); it != arr.end(); it++)
    {
        if (it == arr.end() - 1)
        {
            out += *it;
        }
        else
        {
            out += *it + ",";
        }
    }
    return "[" + out + "]";
}
string serializeListNodeArr(vector<ListNode *> &lists)
{
    string out = "";
    for (auto it = lists.begin(); it != lists.end(); it++)
    {
        if (it == lists.end() - 1)
        {
            out += serializeListNode(*it);
        }
        else
        {
            out += serializeListNode(*it) + ",";
        }
    }
    return "[" + out + "]";
}
string serializeTreeNodeArr(vector<TreeNode *> &arr)
{
    string out = "";
    for (auto it = arr.begin(); it != arr.end(); it++)
    {
        if (it == arr.end() - 1)
        {
            out += serializeTreeNode(*it);
        }
        else
        {
            out += serializeTreeNode(*it) + ",";
        }
    }
    return "[" + out + "]";
}
