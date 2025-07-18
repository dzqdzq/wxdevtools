import { contain, endWith, evalCss } from "../third_party/licia.js";
export function autoShowAudits() {
  const I = navigator.userAgent;

  if (contain(I, "autoaudits")) {
    wxMain.on(WxMain.Events.tabAdded, (I) => {
      if (endWith(I, "Audits")) {
        wxMain.emit(WxMain.Events.showView, "Audits");
      }
    });
  }
}
export function reportPerf() {
  if (window.__global && window.__global.alert) {
    window.__global.alert("FMP");
  } else {
    alert("FMP");
  }
}
export function consoleHoverHighlight() {
  evalCss(".console-message-wrapper:hover{background:rgba(56,121,217, 0.1)}");
}
export function monitorClick() {
  window.addEventListener("click", () => {
    wxMain.getMessenger().send({ command: "CLICK" });
  });
}
export function showMockContextMenu() {
  const I = wxMain.getMessenger();
  I.registerCallback((i) => {
    const { command: n, data: d } = i;

    if (n === "API_MOCK_ON_CONTEXTMENU_TO_DEVTOOLS") {
      wxMain.emit(
        WxMain.Events.showContextMenu,
        d.clientX,
        d.clientY + 25,
        d.menuItems,
        (i) => {
          I.send({
            command: "API_MOCK_CONTEXTMENU_CLICK_FROM_DEVTOOLS",
            data: i,
          });
        }
      );
    }
  });
}
export function consoleApiWaitSync() {
  evalCss(
    '\n    #console-prompt .CodeMirror-lines.__sync[role="presentation"]:before {\n    content: \' \';\n    display: inline-block;\n    vertical-align: middle;\n    width: 24px;\n    height: 20px;\n    -webkit-mask: url(data:image/svg+xml;base64,PHN2ZyBjbGFzcz0ibGRzLXNwaW5uZXIiIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCIgc3R5bGU9ImJhY2tncm91bmQ6MCAwIj48cmVjdCB4PSI0NyIgeT0iMjQiIHJ4PSI5LjQiIHJ5PSI0LjgiIHdpZHRoPSI2IiBoZWlnaHQ9IjEyIiBmaWxsPSIjYjNiM2IzIj48YW5pbWF0ZSBhdHRyaWJ1dGVOYW1lPSJvcGFjaXR5IiB2YWx1ZXM9IjE7MCIgZHVyPSIxcyIgYmVnaW49Ii0wLjkxNjY2NjY2NjY2NjY2NjZzIiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIvPjwvcmVjdD48cmVjdCB4PSI0NyIgeT0iMjQiIHJ4PSI5LjQiIHJ5PSI0LjgiIHdpZHRoPSI2IiBoZWlnaHQ9IjEyIiBmaWxsPSIjYjNiM2IzIiB0cmFuc2Zvcm09InJvdGF0ZSgzMCA1MCA1MCkiPjxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9Im9wYWNpdHkiIHZhbHVlcz0iMTswIiBkdXI9IjFzIiBiZWdpbj0iLTAuODMzMzMzMzMzMzMzMzMzNHMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIi8+PC9yZWN0PjxyZWN0IHg9IjQ3IiB5PSIyNCIgcng9IjkuNCIgcnk9IjQuOCIgd2lkdGg9IjYiIGhlaWdodD0iMTIiIGZpbGw9IiNiM2IzYjMiIHRyYW5zZm9ybT0icm90YXRlKDYwIDUwIDUwKSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIxOzAiIGR1cj0iMXMiIGJlZ2luPSItMC43NXMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIi8+PC9yZWN0PjxyZWN0IHg9IjQ3IiB5PSIyNCIgcng9IjkuNCIgcnk9IjQuOCIgd2lkdGg9IjYiIGhlaWdodD0iMTIiIGZpbGw9IiNiM2IzYjMiIHRyYW5zZm9ybT0icm90YXRlKDkwIDUwIDUwKSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIxOzAiIGR1cj0iMXMiIGJlZ2luPSItMC42NjY2NjY2NjY2NjY2NjY2cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3JlY3Q+PHJlY3QgeD0iNDciIHk9IjI0IiByeD0iOS40IiByeT0iNC44IiB3aWR0aD0iNiIgaGVpZ2h0PSIxMiIgZmlsbD0iI2IzYjNiMyIgdHJhbnNmb3JtPSJyb3RhdGUoMTIwIDUwIDUwKSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIxOzAiIGR1cj0iMXMiIGJlZ2luPSItMC41ODMzMzMzMzMzMzMzMzM0cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3JlY3Q+PHJlY3QgeD0iNDciIHk9IjI0IiByeD0iOS40IiByeT0iNC44IiB3aWR0aD0iNiIgaGVpZ2h0PSIxMiIgZmlsbD0iI2IzYjNiMyIgdHJhbnNmb3JtPSJyb3RhdGUoMTUwIDUwIDUwKSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIxOzAiIGR1cj0iMXMiIGJlZ2luPSItMC41cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3JlY3Q+PHJlY3QgeD0iNDciIHk9IjI0IiByeD0iOS40IiByeT0iNC44IiB3aWR0aD0iNiIgaGVpZ2h0PSIxMiIgZmlsbD0iI2IzYjNiMyIgdHJhbnNmb3JtPSJyb3RhdGUoMTgwIDUwIDUwKSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIxOzAiIGR1cj0iMXMiIGJlZ2luPSItMC40MTY2NjY2NjY2NjY2NjY3cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3JlY3Q+PHJlY3QgeD0iNDciIHk9IjI0IiByeD0iOS40IiByeT0iNC44IiB3aWR0aD0iNiIgaGVpZ2h0PSIxMiIgZmlsbD0iI2IzYjNiMyIgdHJhbnNmb3JtPSJyb3RhdGUoMjEwIDUwIDUwKSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIxOzAiIGR1cj0iMXMiIGJlZ2luPSItMC4zMzMzMzMzMzMzMzMzMzMzcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3JlY3Q+PHJlY3QgeD0iNDciIHk9IjI0IiByeD0iOS40IiByeT0iNC44IiB3aWR0aD0iNiIgaGVpZ2h0PSIxMiIgZmlsbD0iI2IzYjNiMyIgdHJhbnNmb3JtPSJyb3RhdGUoMjQwIDUwIDUwKSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIxOzAiIGR1cj0iMXMiIGJlZ2luPSItMC4yNXMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIi8+PC9yZWN0PjxyZWN0IHg9IjQ3IiB5PSIyNCIgcng9IjkuNCIgcnk9IjQuOCIgd2lkdGg9IjYiIGhlaWdodD0iMTIiIGZpbGw9IiNiM2IzYjMiIHRyYW5zZm9ybT0icm90YXRlKDI3MCA1MCA1MCkiPjxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9Im9wYWNpdHkiIHZhbHVlcz0iMTswIiBkdXI9IjFzIiBiZWdpbj0iLTAuMTY2NjY2NjY2NjY2NjY2NjZzIiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIvPjwvcmVjdD48cmVjdCB4PSI0NyIgeT0iMjQiIHJ4PSI5LjQiIHJ5PSI0LjgiIHdpZHRoPSI2IiBoZWlnaHQ9IjEyIiBmaWxsPSIjYjNiM2IzIiB0cmFuc2Zvcm09InJvdGF0ZSgzMDAgNTAgNTApIj48YW5pbWF0ZSBhdHRyaWJ1dGVOYW1lPSJvcGFjaXR5IiB2YWx1ZXM9IjE7MCIgZHVyPSIxcyIgYmVnaW49Ii0wLjA4MzMzMzMzMzMzMzMzMzMzcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3JlY3Q+PHJlY3QgeD0iNDciIHk9IjI0IiByeD0iOS40IiByeT0iNC44IiB3aWR0aD0iNiIgaGVpZ2h0PSIxMiIgZmlsbD0iI2IzYjNiMyIgdHJhbnNmb3JtPSJyb3RhdGUoMzMwIDUwIDUwKSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIxOzAiIGR1cj0iMXMiIGJlZ2luPSIwcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3JlY3Q+PC9zdmc+) no-repeat 50% 50%;\n    -webkit-mask-size: cover;\n    background-color: white;\n  }\n\n  #console-prompt .CodeMirror-lines.__sync[role="presentation"]:after {\n    content: "等待同步 API " attr(data-sdkname) " 调用";\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: auto;\n    background: #de0000;\n    line-height: 20px;\n    font-size: 12px;\n    padding: 0 30px;\n    z-index: -1;\n    color: white;\n    text-shadow: 0 1px 1px #000;\n  }'
  );
}
export function devtoolsReady() {
  wxMain.runOnMainLoaded(() => {
    wxMain.getMessenger().send({ command: "DEVTOOLS_ON_MAIN_LOADED" });
  });
}
