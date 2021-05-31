const vscode = acquireVsCodeApi();
let activeItem = null;
let activeDiv = null;
let state = {
    originData: {
        id: null,
        answerData: null,
        localSubmit: null,
        remoteSubmit: null,
    },
    remoteSubmits: [],
    codeId: -1,
    navIndex: 0,
    activeIndex: -1,
    code: "",
};
const HistoryTypeMap = ["answer", "localSubmit", "remoteSubmit"];
function setNavIndex(index) {
    state.navIndex = index;
    vscode.setState({ ...state });
}
function setCodeId(id) {
    state.codeId = id;
    vscode.setState({ ...state });
}
function setActiveIndex(index) {
    state.activeIndex = index;
    vscode.setState({ ...state });
}
function setOriginData(data) {
    state.originData = data;
    vscode.setState({ ...state });
}
function setRemoteData(data) {
    state.originData.remoteSubmit = data;
    vscode.setState({ ...state });
}
function setCode(code) {
    state.code = code;
    vscode.setState({ ...state });
}
function restore() {
    const previousState = vscode.getState();
    if (previousState) {
        state = previousState;
        vscode.setState({ ...state });
    }
}
function clearState() {
    setCode("");
    setActiveIndex(-1);
    setNavIndex(0);
    setCodeId(-1);
    clearCodeView();
}
function clearCodeView() {
    const viewDiv = document.getElementById("history-code");
    viewDiv.innerHTML = state.code;
}
function init() {
    const nav = document.getElementById("nav");
    const children = nav.children;
    removeOnclick(nav);
    removeChildrenClass(nav);
    for (let i = 0; i < children.length; i++) {
        const item = children[i];
        item.onclick = () => {
            if (activeItem && activeItem !== item) {
                activeItem.className = "";
                item.className = "active";
            }
            activeItem = item;
            switchView(i);
        };
    }
    activeItem = children[state.navIndex];
    activeItem.className = "active";
    switchView(state.navIndex);
    if (state.code) {
        const viewDiv = document.getElementById("history-code");
        viewDiv.innerHTML = state.code;
        hljs.highlightBlock(viewDiv);
        setCode(state.code);
    }
}

function removeOnclick(container) {
    for (let i = container.children.length - 1; i >= 0; i--) {
        container.children[i].onclick = null;
    }
}
function removeChildrenClass(container) {
    for (let i = container.children.length - 1; i >= 0; i--) {
        container.children[i].className = "";
    }
}
function removeChildren(container) {
    for (let i = container.children.length - 1; i >= 0; i--) {
        container.children[i].onclick = null;
        container.removeChild(container.children[i]);
    }
}
function switchView(type) {
    setCodeId(-1);
    if (state.navIndex !== type) {
        setActiveIndex(-1);
    }
    setNavIndex(type);

    const config = ["answerData", "localSubmit", "remoteSubmit"];
    const key = config[type];

    const container = document.getElementById("container");
    removeChildren(container);
    const data = state.originData[key];
    if (data) {
        const header = data.header;
        const arr = data.arr;
        initHeader(container, header);
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            const obj = item.obj;
            const code = item.code;
            const id = type + item.id;

            initDiv(container, obj, code, header, type, i);
        }
    }
}

function initHeader(father, headerArr) {
    const boxDiv = document.createElement("div");
    boxDiv.className = "item-header";
    father.appendChild(boxDiv);
    for (let i = 0; i < headerArr.length; i++) {
        const config = headerArr[i];
        const label = config.label;
        const newDiv = document.createElement("div");
        newDiv.textContent = label;
        boxDiv.appendChild(newDiv);
    }
    const newDiv = document.createElement("div");
    newDiv.textContent = "operation";
    boxDiv.appendChild(newDiv);
}
function initDiv(father, itemObj, code, headerArr, type, index) {
    const boxDiv = document.createElement("div");
    boxDiv.className = "item";
    father.appendChild(boxDiv);
    let descDiv = null;
    for (let i = 0; i < headerArr.length; i++) {
        const config = headerArr[i];
        const key = config.key;
        if (["comment", "desc"].includes(key)) {
            const div = document.createElement("div");
            const newDiv = document.createElement("input");
            newDiv.value = itemObj[key] || "";
            newDiv.disabled = true;
            descDiv = newDiv;
            div.appendChild(newDiv);
            boxDiv.appendChild(div);
        } else {
            const newDiv = document.createElement("div");
            newDiv.textContent = itemObj[key] || "";
            boxDiv.appendChild(newDiv);
        }
    }
    const editDiv = document.createElement("div");
    editDiv.textContent = "edit";
    editDiv.className = "operate-box";
    boxDiv.appendChild(editDiv);
    const operateBox = document.createElement("div");
    const saveDiv = document.createElement("div");
    saveDiv.textContent = "save";

    const cancelDiv = document.createElement("div");
    cancelDiv.textContent = "cancel";
    operateBox.appendChild(saveDiv);
    operateBox.appendChild(cancelDiv);
    operateBox.className = "hide";
    const container = document.createElement("div");
    container.appendChild(editDiv);
    container.appendChild(operateBox);
    boxDiv.appendChild(container);
    let originValue;
    boxDiv.id = itemObj.id;
    boxDiv.onclick = function (e) {
        if (e.target === editDiv) {
            editDiv.className = "hide";
            operateBox.className = "operate-box";
            descDiv.disabled = false;
            originValue = descDiv.value;
        } else if (e.target === saveDiv) {
            editDiv.className = "operate-box";
            operateBox.className = "hide";
            const params = {
                id: itemObj.id,
                comment: descDiv.value,
                questionId: state.originData.id,
            };
            updateComment(HistoryTypeMap[type], params).then((v) => {
                descDiv.disabled = true;
                updateCommentData(type, params);
            });
        } else if (e.target === cancelDiv) {
            editDiv.className = "operate-box";
            operateBox.className = "hide";
            descDiv.disabled = true;
            descDiv.value = originValue;
        } else {
            if (boxDiv === activeDiv) {
                return;
            } else {
                if (activeDiv) {
                    activeDiv.className = "item";
                }
                setActiveIndex(index);
                let newCodeId = type + itemObj.id;
                setCodeId(newCodeId);
                const viewDiv = document.getElementById("history-code");
                boxDiv.className = "item active";
                activeDiv = boxDiv;
                if (type === 2) {
                    getQuestionCode(itemObj.id)
                        .then((code) => {
                            if (state.codeId === newCodeId) {
                                viewDiv.innerHTML = code;

                                hljs.highlightBlock(viewDiv);
                                setCode(code);
                            }
                        })
                        .catch((err) => {
                            if (codeId === newCodeId) {
                                viewDiv.innerHTML = err;
                                hljs.highlightBlock(viewDiv);
                                setCode(err);
                            }
                        });
                } else {
                    viewDiv.innerHTML = code;
                    hljs.highlightBlock(viewDiv);
                    setCode(code);
                }
            }
        }
    };
    if (state.navIndex === type && index === state.activeIndex) {
        boxDiv.click();
    }
}
function sleep(time) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, time, "timeout");
    });
}
const pMap = {};
function getQuestionCode(id) {
    const uuid = Math.random().toString();
    vscode.postMessage({
        command: "getSubmissionCode",
        id: id,
        uuid: uuid,
    });
    const p = new Promise((resolve, reject) => {
        pMap[uuid] = { resolve, reject };
    });
    return Promise.race([sleep(15000), p]);
}
function updateComment(type, params) {
    const uuid = Math.random().toString();
    vscode.postMessage({
        command: "updateComment",
        uuid: uuid,
        type,
        params,
    });
    const p = new Promise((resolve, reject) => {
        pMap[uuid] = { resolve, reject };
    });
    return Promise.race([sleep(15000), p]);
}
function updateCommentData(type, params) {
    switch (type) {
        case 0: {
            const arr = state.originData.answerData.arr;
            const item = arr.find((v) => v.obj.id === params.id);
            if (item) {
                item.obj.desc = params.comment;
            }
            break;
        }
        case 1: {
            const arr = state.originData.localSubmit.arr || [];
            const item = arr.find((v) => v.obj.id === params.id);
            if (item) {
                item.obj.comment = params.comment;
            }
            break;
        }
        case 2: {
            const arr = state.originData.remoteSubmit.arr || [];
            const item = arr.find((v) => v.obj.id === params.id);
            if (item) {
                item.obj.comment = params.comment;
            }
            break;
        }
    }
    vscode.setState({ ...state });
}
restore();
init();
window.addEventListener("message", (event) => {
    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case "init": {
            clearState();
            setOriginData(message.data);
            init();
            break;
        }

        case "remoteStorageData": {
            setRemoteData(message.data);
            if (state.navIndex === 2) {
                switchView(2);
            }
            break;
        }

        case "submissionDetail": {
            let code = message.data.code;
            let uuid = message.data.uuid;
            if (pMap[uuid]) {
                pMap[uuid].resolve(code);
                delete pMap[uuid];
            } else {
                console.log("uuid not found");
            }
            break;
        }

        case "updateComment": {
            const code = message.data.code;
            const uuid = message.data.uuid;
            const msg = message.data.msg;
            if (pMap[uuid]) {
                if (code === 200) {
                    pMap[uuid].resolve();
                } else {
                    pMap[uuid].reject(msg);
                }
                delete pMap[uuid];
            } else {
                console.log("uuid not found");
            }
        }
    }
});
