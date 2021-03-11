# algorithm

An excellent vscode extension for leetcode.

## Quick Start

![Quick Start](./images/debug.gif)

## Main Features

**currently only support javascript and typescript,will support other language soon**

- write testcase in the file and run test in local, support link list and tree

- debug the testcase

- support import module, bundle code and copy the build code

- contain contest (Do not submit directly when you attending weekly contest,
  copy the code and submit in browser instead.)

## Other Features

- search question
- contain daily challenge
- support login in https://leetcode.com/ and https://leetcode-cn.com/

## pick a question

Click the question in the `algorithm view`

## shortcut buttons

> Just click the shortcut button in the `view toolbar` to

- fresh question
- search question
- login in
- switch endpoint
- collapse all

![shortcut buttons](./images/shortcut.png)

## switch endpoint

### current support:

- leetcode.com
- leetcode-cn.com

> Note: The accounts of different endpoints are not shared.

## login in

The way to login in referred to the official extension [vscode-leetcode](https://github.com/LeetCode-OpenSource/vscode-leetcode).

- leetcode.com support github and cookie login.
- leetcode-cn.com support account,github and cookie login.

## test in the file

The code contains default testcase.

Click the test codelens hover in the vscode to run the test in **local**.

You can add customized testcase like `// @test(param)=result`
![test](./images/test.png)

## debug

You can just set a breakpoint at the testcase line and set breakpoint for the code.

:tada: Then enjoying debug.

![debug](./images/debug.png)

## submit

Click the submit hover to submit your code.

![build.png](./images/build.png)

## Weekly Contest

When you participate in Weekly Contest, you may choose c++,java,python. Because they have the built-in library like STL that contains priority queue,order set etc.

Now you have another choice.

### **Attention!**

Do not submit directly when you attend weekly contest,click `build` and then
click `copy` to copy code , finally paste the code in browser and submit.

### build code & copy code

This is useful in the weekly contest.

- click the build codelens hover.

![build.png](./images/build.png)

- focus the code view then click the copy icon.

![copy.png](./images/copy.png)

> The code import module [algm](https://github.com/supperchong/algm) which contains many useful function and data structure, such as `priority queue`,`Segment tree`, `union–find` ,`skip list`. :rocket: Thanks to treeshake and rollup, the bundle code is very clean.

## Thanks

Thanks to the official extension [vscode-leetcode](https://github.com/LeetCode-OpenSource/vscode-leetcode), the algorithm extension
has reference some design and the login method.
