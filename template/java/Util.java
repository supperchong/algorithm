package algm;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.LinkedList;
import java.util.Queue;

public class Util {
    static public int parseInteger(String param) {
        return Integer.parseInt(param);
    }

    static public Float parseFloat(String param) {
        return Float.parseFloat(param);
    }

    static public String parseString(String param) {
        int len = param.length();
        assert param.charAt(0) == '"';
        String out = "";
        for (int i = 1; i < len; i++) {
            if (param.charAt(i) == '\\') {
                if (i == len - 2) {
                    throw new RuntimeException("parse string error");
                }
                char nextChar = param.charAt(i + 1);
                if (nextChar == 'u') {
                    String escapeStr = param.substring(i + 2, i + 6);

                    String pattern = "^[0-9a-fA-F]{4}$";
                    boolean isMatch = Pattern.matches(pattern, escapeStr);
                    if (!isMatch) {
                        throw new RuntimeException("parse string error in " + param.substring(0, i + 5));
                    }
                    int num = Integer.parseInt(escapeStr, 16);
                    out += (char) num;
                    i += 5;

                } else {
                    char[] echars = new char[] { '"', '\\', '/', 'b', 'f', 'n', 'r', 't' };
                    char[] realChars = new char[] { '"', '\\', '/', '\b', '\f', '\n', '\r', '\t' };
                    boolean has = false;
                    for (int j = 0; j < echars.length; j++) {
                        if (echars[j] == nextChar) {
                            has = true;
                            out += realChars[j];
                            i++;
                            break;
                        }
                    }
                    if (!has) {
                        throw new RuntimeException("parse string error in " + param.substring(0, i + 1));
                    }
                }
            } else if (param.charAt(i) == '"') {
                return out;
            } else {
                out += param.charAt(i);
            }
        }
        throw new RuntimeException("parse string error in " + param);

    }

    static public int[] parseIntegerArr(String param) {
        int[] r = {};
        int len = param.length();
        assert param.charAt(0) == '[';
        assert param.charAt(len - 1) == ']';
        if (len == 2) {
            return r;
        }
        List<Integer> list = new ArrayList<Integer>();
        String subStr = param.substring(1, len - 1);
        String[] arr = subStr.split(",");
        for (int i = 0; i < arr.length; i++) {
            list.add(Integer.parseInt(arr[i]));
        }
        r = list.stream().mapToInt(Integer::valueOf).toArray();

        return r;
    }

    static public List<Integer> parseIntegerList(String param) {
        List<Integer> list = new ArrayList<Integer>();
        int len = param.length();
        assert param.charAt(0) == '[';
        assert param.charAt(len - 1) == ']';
        if (len == 2) {
            return list;
        }

        String subStr = param.substring(1, len - 1);
        String[] arr = subStr.split(",");
        for (int i = 0; i < arr.length; i++) {
            list.add(Integer.parseInt(arr[i]));
        }
        return list;
    }

    static public List<List<Integer>> parseIntegerListList(String param) {
        List<List<Integer>> list = new ArrayList<List<Integer>>();
        int len = param.length();
        if (len <= 4) {
            return list;
        }

        for (int i = 1; i < len - 1; i++) {
            if (param.charAt(i) == '[') {
                String temp = "";
                i++;
                while (param.charAt(i) != ']') {
                    temp += param.charAt(i++);
                }
                list.add(parseIntegerList("[" + temp + "]"));
            }
        }
        return list;
    }

    static public int[][] parseIntegerArrArr(String param) {
        int len = param.length();
        int[][] r = {};
        if (len <= 4) {
            return r;
        }
        List<int[]> list = new ArrayList<int[]>();

        for (int i = 1; i < len - 1; i++) {
            if (param.charAt(i) == '[') {
                String temp = "";
                i++;
                while (param.charAt(i) != ']') {
                    temp += param.charAt(i++);
                }
                list.add(parseIntegerArr("[" + temp + "]"));
            }
        }
        r = new int[list.size()][];
        list.toArray(r);
        return r;
    }

    static public String[] parseStringArr(String param) {

        List<String> list = new ArrayList<String>();
        int len = param.length();
        assert param.charAt(0) == '[';
        assert param.charAt(len - 1) == ']';
        if (len == 2) {
            return new String[] {};
        }
        Pattern p = Pattern.compile("\"(\\\\.|[^\"\\\\])*\"");
        String subStr = param.substring(1, len - 1);
        Matcher m = p.matcher(subStr);
        while (m.find()) {
            list.add(parseString(subStr.substring(m.start(), m.end())));

        }
        String[] r = new String[list.size()];

        list.toArray(r);
        return r;
    }

    static public List<String> parseStringList(String param) {
        List<String> list = new ArrayList<String>();
        int len = param.length();
        assert param.charAt(0) == '[';
        assert param.charAt(len - 1) == ']';
        if (len == 2) {
            return list;
        }
        Pattern p = Pattern.compile("\"(\\\\.|[^\"\\\\])*\"");
        String subStr = param.substring(1, len - 1);
        Matcher m = p.matcher(subStr);
        while (m.find()) {
            list.add(parseString(subStr.substring(m.start(), m.end())));

        }

        return list;
    }

    static public String[][] parseStringArrArr(String param) {

        List<String[]> list = new ArrayList<String[]>();
        int len = param.length();
        assert param.charAt(0) == '[';
        assert param.charAt(len - 1) == ']';
        if (len == 4) {
            return new String[][] { new String[] {} };
        }
        Pattern p = Pattern.compile("\"(\\\\.|[^\"\\\\])*\"");
        String subStr = param.substring(1, len - 1);
        Matcher m = p.matcher(subStr);
        for (int i = 0; i < subStr.length(); i++) {
            // System.out.print(subStr.charAt(i));
            char curChar = subStr.charAt(i);
            char nextChar = subStr.charAt(i + 1);
            List<String> temp = new ArrayList<String>();
            if (curChar == '[') {
                while (nextChar != ']' && m.find()) {

                    temp.add(parseString(subStr.substring(m.start(), m.end())));

                    i = m.end();
                    nextChar = subStr.charAt(i);
                }
                String[] tempArr = new String[temp.size()];

                temp.toArray(tempArr);
                list.add(tempArr);
            }
        }

        String[][] r = new String[list.size()][];
        return list.toArray(r);
    }

    static public List<List<String>> parseStringListList(String param) {
        List<List<String>> list = new ArrayList<List<String>>();
        int len = param.length();
        assert param.charAt(0) == '[';
        assert param.charAt(len - 1) == ']';
        if (len == 4) {
            return list;
        }
        Pattern p = Pattern.compile("\"(\\\\.|[^\"\\\\])*\"");
        String subStr = param.substring(1, len - 1);
        Matcher m = p.matcher(subStr);
        for (int i = 0; i < subStr.length(); i++) {
            char curChar = subStr.charAt(i);
            char nextChar = subStr.charAt(i + 1);
            List<String> temp = new ArrayList<String>();
            if (curChar == '[') {
                while (nextChar != ']' && m.find()) {

                    temp.add(parseString(subStr.substring(m.start(), m.end())));

                    i = m.end();
                    nextChar = subStr.charAt(i);
                }
                list.add(temp);
            }
        }

        return list;
    }

    static public String serializeInteger(int param) {
        return Integer.toString(param);
    }

    static public String serializeBool(boolean param) {
        if (param == true) {
            return "true";
        } else {
            return "false";
        }
    }

    static public String serializeFloat(double param) {
        String r = param + "";
        String[] arr = r.split("\\.");
        if (arr.length == 1) {
            return r + ".00000";
        } else {
            String decimalStr = arr[1] + "00000";
            return arr[0] + "." + decimalStr.substring(0, 5);
        }
    }

    static public String serializeIntegerArr(int[] param) {
        List<String> list = new ArrayList<String>();
        for (int i = 0; i < param.length; i++) {
            list.add(serializeInteger(param[i]));
        }
        return "[" + String.join(",", list) + "]";
    }

    static public String serializeIntegerList(List<Integer> param) {
        List<String> list = new ArrayList<String>();
        for (int i = 0; i < param.size(); i++) {
            list.add(serializeInteger(param.get(i)));
        }
        return "[" + String.join(",", list) + "]";
    }

    static public String serializeIntegerArrArr(int[][] param) {
        List<String> list = new ArrayList<String>();
        for (int i = 0; i < param.length; i++) {
            list.add(serializeIntegerArr(param[i]));
        }
        return "[" + String.join(",", list) + "]";
    }

    static public String serializeIntegerListList(List<List<Integer>> param) {
        List<String> list = new ArrayList<String>();
        for (int i = 0; i < param.size(); i++) {
            list.add(serializeIntegerList(param.get(i)));
        }
        return "[" + String.join(",", list) + "]";
    }

    static public String serializeString(String param) {
        String out = param.replaceAll("(\\|\")", "\\$1");
        return "\"" + out + "\"";
    }

    static public String serializeStringArr(String[] param) {
        List<String> list = new ArrayList<String>();
        for (int i = 0; i < param.length; i++) {
            list.add(serializeString(param[i]));
        }
        return "[" + String.join(",", list) + "]";
    }

    static public String serializeStringList(List<String> param) {
        List<String> list = new ArrayList<String>();
        for (int i = 0; i < param.size(); i++) {
            list.add(serializeString(param.get(i)));
        }
        return "[" + String.join(",", list) + "]";
    }

    static public String serializeStringArrArr(String[][] param) {
        List<String> list = new ArrayList<String>();
        for (int i = 0; i < param.length; i++) {
            list.add(serializeStringArr(param[i]));
        }
        return "[" + String.join(",", list) + "]";
    }

    static public String serializeStringListList(List<List<String>> param) {
        List<String> list = new ArrayList<String>();
        for (int i = 0; i < param.size(); i++) {
            list.add(serializeStringList(param.get(i)));
        }
        return "[" + String.join(",", list) + "]";
    }

    static public TreeNode parseTreeNode(String param) {
        int len = param.length();
        assert param.charAt(0) == '[';
        assert param.charAt(len - 1) == ']';
        if (len <= 2) {
            return null;
        }
        String[] nodeData = param.substring(1, len - 1).split(",");
        int i = 0;
        String val = nodeData[i++];
        TreeNode root = new TreeNode(parseInteger(val));
        Queue<TreeNode> queue;
        queue = new LinkedList<TreeNode>();
        queue.offer(root);

        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();
            if (i == nodeData.length) {
                return root;
            }

            String leftVal = nodeData[i++];
            if (!leftVal.equals("null")) {
                TreeNode left = new TreeNode(parseInteger(leftVal));
                node.left = left;
                queue.offer(left);
            }
            if (i == nodeData.length) {
                return root;
            }
            String rightVal = nodeData[i++];
            if (!rightVal.equals("null")) {
                TreeNode right = new TreeNode(parseInteger(rightVal));
                node.right = right;
                queue.offer(right);
            }
        }
        return root;
    }

    static public ListNode parseListNode(String param) {
        int len = param.length();
        assert param.charAt(0) == '[';
        assert param.charAt(len - 1) == ']';
        if (len <= 2) {
            return null;
        }
        int[] arr = parseIntegerArr(param);
        ListNode root = new ListNode(arr[0]);
        ListNode p = root;
        for (int i = 1; i < arr.length; i++) {
            p.next = new ListNode(arr[i]);
            p = p.next;
        }
        return root;
    }

    static public String serializeListNode(ListNode root) {
        String out = "";
        ListNode p = root;
        while (p != null) {
            out += p.val;

            p = p.next;
            if (p != null) {
                out += ",";
            }
        }
        return "[" + out + "]";
    }

    static public String serializeTreeNode(TreeNode root) {
        if (root == null) {
            return "[]";
        }
        List<String> list = new ArrayList<String>();
        Queue<TreeNode> queue;
        queue = new LinkedList<TreeNode>();
        queue.offer(root);
        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();
            if (node != null) {
                list.add(Integer.toString(node.val));
                queue.offer(node.left);
                queue.offer(node.right);
            } else {
                list.add(null);
            }
        }
        int i = list.size() - 1;
        while (list.get(i) == null) {
            i--;
        }
        return "[" + String.join(",", list.subList(0, i + 1)) + "]";

    }

    static public String serializeListNodeArr(ListNode[] arr) {
        String out = "";
        for (int i = 0; i < arr.length; i++) {
            if (i == arr.length - 1) {
                out += serializeListNode(arr[i]);
            } else {
                out += serializeListNode(arr[i]) + ",";
            }

        }
        return "[" + out + "]";
    }

    static public ListNode[] parseListNodeArr(String param) {
        int len = param.length();
        ListNode[] r = {};
        if (len <= 4) {
            return r;
        }

        List<ListNode> list = new ArrayList<ListNode>();
        for (int i = 1; i < len - 1; i++) {
            if (param.charAt(i) == '[') {
                String temp = "";
                i++;
                while (param.charAt(i) != ']') {
                    temp += param.charAt(i++);
                }
                list.add(parseListNode("[" + temp + "]"));
            }
        }
        r = new ListNode[list.size()];
        list.toArray(r);
        return r;
    }

    static public String serializeTreeNodeArr(TreeNode[] arr) {
        String out = "";
        for (int i = 0; i < arr.length; i++) {
            out += serializeTreeNode(arr[i]);
            if (i != arr.length - 1) {
                out += ',';
            }
        }
        return "[" + out + "]";
    }

    static public TreeNode[] parseTreeNodeArr(String param) {
        int len = param.length();
        TreeNode[] r = {};
        if (len <= 4) {
            return r;
        }

        List<TreeNode> list = new ArrayList<TreeNode>();
        for (int i = 1; i < len - 1; i++) {
            if (param.charAt(i) == '[') {
                String temp = "";
                i++;
                while (param.charAt(i) != ']') {
                    temp += param.charAt(i++);
                }
                list.add(parseTreeNode("[" + temp + "]"));
            }
        }
        r = new TreeNode[list.size()];
        list.toArray(r);
        return r;
    }

}
