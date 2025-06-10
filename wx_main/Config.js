import {
  each,
  isStr,
  contain,
  extend,
  cmpVersion,
} from "../third_party/licia.js";
import {
  isGameEngineIDEShow,
  getGameEnvType,
  getProxyPort,
  isRemoteDebugGame,
  isWebWorker,
  isGameEngine,
  getChromeVersion,
} from "./util.js";
import {
  consoleLink,
  whenUrlChanged,
  setCloudRequestData,
  getStackTrace,
  getStackTraceById,
  handleNetworkLog,
  addQuickOpen,
  ensureDevtoolsSetting,
} from "./Features.js";
import {
  autoShowAudits,
  reportPerf,
  consoleHoverHighlight,
  monitorClick,
  showMockContextMenu,
  consoleApiWaitSync,
  devtoolsReady,
} from "./FeaturesPure.js";
import {
  setTimestampOffset,
  addCustomRequest,
  addDebuggee,
  hideRemoteDebugResources,
  monitorDebugger,
  hideWebSocket,
  transTimestamp,
  getResponseBody,
  disableTouchWhenInspect,
  hideWebdebuggerRequest,
  hideOpenTagResources,
  correctLogStack,
  disableMsgToCrashedWebView,
} from "./FeaturesConnection.js";
const commonFeatures = [
    "hideNodeIndicator",
    "monitorMainLoaded",
    "monitorAppUICreated",
    "dispatchMessage",
    "sendMessage",
    "disableReloadWarning",
    "setMaxLogLen",
    "setMaxRequestLen",
    "showEventStream",
    "setTheme",
    "customDevtoolsUI",
    "reportConsoleBadges",
    "disableGetTokenForLargeFile",
    "fixBreakpoint",
    "customExtensionUrl",
    "fixImageViewSave",
    {
      name: "hideResponseHeaders",
      options: {
        headers: ["for-weapp-devtools"],
        textRegs: [/\nfor-weapp-devtools:[^\n]*/g],
      },
    },
    ensureDevtoolsSetting,
  ],
  chromeVersion = getChromeVersion();
cmpVersion(chromeVersion, "81") > 0 && commonFeatures.push("compatibility91"),
  isWebWorker() || commonFeatures.push("sentry");
const AppService = toFeatureMap([
    ...commonFeatures,
    "customPanel",
    "popupButton",
    "moveDownResizer",
    "showView",
    "loadPanel",
    "monitorTab",
    "showWxml",
    "addCloudResourceCategories",
    "monitorNetworkReset",
    "monitorCompileEvent",
    "monitorSecurityDetails",
    "customDebuggerMask",
    "showContextMenu",
    "disableContextSelector",
    "customProfiler",
    "autoRevealInstanceFrame",
    "hideRequest",
    "correctContext",
    "cleanScripts",
    "saveToTempVariable",
    "cloudExplainTab",
    "replaceOpenInNewTab",
    "hackReload",
    "restoreMissingLog",
    "errorOccursDisplayIDEInfo",
    "deleteIframe",
    "hideWxapplib",
    "hackTimeline",
    "importTrace",
    "gatewayPromo",
    consoleLink,
    addQuickOpen,
    "wxmlToolbar",
    {
      name: "handleConsoleStackTrace",
      options: {
        regexList: [
          /^ide:\/\/\//,
          /^http:\/\/127.0.0.1:\d+\/appservice\/__dev__\//,
          /^http:\/\/127.0.0.1:\d+\/appservice\/__context__\/app-service.js/,
          /^http:\/\/127.0.0.1:\d+\/appservice\/instanceframe/,
        ],
      },
    },
    {
      name: "monitorSettings",
      options: {
        settings: {
          cacheDisabled(e) {
            wxMain
              .getMessenger()
              .send({ command: "NETWORK_CACHE_DISABLED_CHANGED", data: e });
          },
        },
      },
    },
    { name: "hideSettings", options: { categories: ["Elements"] } },
    {
      name: "addModule",
      options: {
        modules: [
          { name: "wxml" },
          { name: "sensor" },
          { name: "storage" },
          { name: "app_data" },
          { name: "task" },
        ],
      },
    },
    {
      name: "modifyModuleDescriptor",
      options: {
        modules: {
          elements: (e) => (
            (e.extensions = e.extensions.filter(
              (e) =>
                "main-toolbar-left" !== e.location &&
                "@UI.ContextMenu.Provider" !== e.type
            )),
            e
          ),
          emulation: (e) => (
            (e.extensions = e.extensions.filter((e) => "sensors" !== e.id)), e
          ),
          browser_debugger: (e) => (
            (e.extensions = e.extensions.filter(
              (e) => "@UI.ContextMenu.Provider" !== e.type
            )),
            e
          ),
        },
      },
    },
    {
      name: "hideView",
      options: { views: ["elements", "resources", "lighthouse"] },
    },
    {
      name: "interceptConnection",
      options: {
        onMessage(e, o) {
          const t = JSON.parse(o);
          disableMsgToCrashedWebView.on(t),
            setTimestampOffset(t) ||
              (monitorDebugger(t),
              hideWebSocket(t) ||
                (setCloudRequestData(t),
                addDebuggee(t),
                addCustomRequest(t),
                getStackTrace(t) ||
                  handleNetworkLog(t) ||
                  transTimestamp(t, e) ||
                  correctLogStack(t, e) ||
                  e(o)));
        },
        sendRawMessage(e, o) {
          const t = JSON.parse(o);
          disableMsgToCrashedWebView.send() || getResponseBody(t) || e(o);
        },
      },
    },
    {
      name: "pure",
      options: {
        handler() {
          devtoolsReady(),
            autoShowAudits(),
            reportPerf(),
            consoleHoverHighlight(),
            monitorClick(),
            showMockContextMenu(),
            getStackTraceById();
        },
      },
    },
  ]),
  WebDebugger = toFeatureMap([
    ...commonFeatures,
    "popupButton",
    "enableTouchEmulation",
    "setSafeAreaInset",
    "setDevice",
    "replaceOpenInNewTab",
    "hackReload",
    {
      name: "interceptDevToolsAPI",
      options: {
        sendMessageToEmbedder(e, o, t, s) {
          whenUrlChanged(o), e(o, t, s);
        },
        dispatchMessage(e, o) {
          e(o);
        },
      },
    },
    {
      name: "pure",
      options: {
        handler() {
          devtoolsReady(), consoleHoverHighlight(), monitorClick();
        },
      },
    },
  ]),
  gameEnvType = getGameEnvType(),
  Game = toFeatureMap([
    ...commonFeatures,
    "monitorCompileEvent",
    "addCloudResourceCategories",
    "popupButton",
    "monitorNetworkReset",
    "monitorSecurityDetails",
    "customDebuggerMask",
    "enableTouchEmulation",
    "setDevice",
    "customGameProfiler",
    "cloudExplainTab",
    "replaceOpenInNewTab",
    "restoreMissingLog",
    "gameInspectMode",
    "importTrace",
    "monitorTab",
    consoleLink,
    addQuickOpen,
    { name: "hackReload", options: { rebuild: !isGameEngineIDEShow() } },
    { name: "hideView", options: { views: ["lighthouse"] } },
    { name: "addModule", options: { modules: [{ name: "storage" }] } },
    {
      name: "handleConsoleStackTrace",
      options: {
        regexList: [/^ide:\/\/\//, /^http:\/\/127.0.0.1:\d+\/game\/__dev__\//],
      },
    },
    {
      name: "pure",
      options: {
        handler() {
          devtoolsReady(), reportPerf(), monitorClick(), getStackTraceById();
        },
      },
    },
    {
      name: "engineGetConsoleModelInfo",
      options: { active: isGameEngineIDEShow() },
    },
    {
      name: "engineListenWindowEvent",
      options: { active: isGameEngineIDEShow() },
    },
    { name: "engineCorrectContext", options: { active: isGameEngine() } },
  ]),
  RemoteDebug = toFeatureMap([
    ...commonFeatures,
    "customPanel",
    "monitorNetworkReset",
    "disabledRemoteDebugContextSelector",
    "correctRemoteDebugContext",
    "miniprogramTimeline",
    "wxmlToolbar",
    { name: "hideSettings", options: { categories: ["Elements"] } },
    {
      name: "modifyModuleDescriptor",
      options: {
        modules: extend(
          {
            wxml: (e) => (
              (e.extensions = e.extensions.filter(
                (e) =>
                  "main-toolbar-left" !== e.location &&
                  "@UI.ContextMenu.Provider" !== e.type
              )),
              e
            ),
          },
          AppService.modifyModuleDescriptor.modules
        ),
      },
    },
    { name: "replaceOpenInNewTab", options: { useAlert: !0 } },
    { name: "hackReload", options: { rebuild: !1 } },
    {
      name: "hideView",
      options: { views: ["security", "lighthouse", "resources"] },
    },
    {
      name: "pure",
      options: {
        handler() {
          consoleHoverHighlight(), monitorClick(), consoleApiWaitSync();
        },
      },
    },
  ]),
  LanDebug = toFeatureMap([
    ...commonFeatures,
    "customProfiler",
    "customGameProfiler",
    {
      name: "hideView",
      options: {
        views: [
          "elements",
          "security",
          "performance",
          "timeline",
          "audits",
          "resources",
          "network",
          "console",
          "application",
          "lighthouse",
          "sources",
        ],
      },
    },
  ]);
isRemoteDebugGame() ||
  RemoteDebug.addModule.modules.push(
    { name: "wxml" },
    { name: "storage" },
    { name: "app_data" }
  );
const CloudFunctionsDebug = toFeatureMap([
  ...commonFeatures,
  "addCloudResourceCategories",
  "processCachedResources",
  "reconnectDevTools",
  "revealSource",
  { name: "replaceOpenInNewTab", options: { useAlert: !0 } },
  {
    name: "hideView",
    options: {
      views: [
        "elements",
        "security",
        "performance",
        "timeline",
        "audits",
        "resources",
      ],
    },
  },
  {
    name: "pure",
    options: {
      handler() {
        consoleHoverHighlight();
      },
    },
  },
  {
    name: "interceptConnection",
    options: {
      onMessage(e, o) {
        const t = JSON.parse(o);
        setCloudRequestData(t), addCustomRequest(t), e(o);
      },
      sendRawMessage(e, o) {
        const t = JSON.parse(o);
        getResponseBody(t) || e(o);
      },
    },
  },
]);
export const EnabledFeatures = {
  AppService: AppService,
  WebDebugger: WebDebugger,
  Game: Game,
  RemoteDebug: RemoteDebug,
  CloudFunctionsDebug: CloudFunctionsDebug,
  LanDebug: LanDebug,
  Unknown: toFeatureMap(["hideNodeIndicator"]),
};
function toFeatureMap(e) {
  const o = {};
  return (
    each(e, (e) => {
      isStr(e) && (e = { name: e, options: {} }), (o[e.name] = e.options);
    }),
    o.addModule || (o.addModule = { modules: [] }),
    isWebWorker() ||
      o.addModule.modules.push({ name: "features", type: "autostart" }),
    o
  );
}
