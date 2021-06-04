function renderCode(code){
    const buildCodeDiv=document.getElementById('buildCode')
    buildCodeDiv.innerHTML=code
}
window.addEventListener("message", (event) => {
    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case "newCode": {
            renderCode(message.data)
            break;
        }
    }
});
