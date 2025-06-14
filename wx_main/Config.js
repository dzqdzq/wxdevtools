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
];

const chromeVersion = getChromeVersion();

if (cmpVersion(chromeVersion, "81") > 0) {
  commonFeatures.push("compatibility91");
}

if (!isWebWorker()) {
  commonFeatures.push("sentry");
}

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
        elements: (e) => {
          e.extensions = e.extensions.filter(
            (e) =>
              e.location !== "main-toolbar-left" &&
              e.type !== "@UI.ContextMenu.Provider"
          );

          return e;
        },
        emulation: (e) => {
          e.extensions = e.extensions.filter((e) => e.id !== "sensors");

          return e;
        },
        browser_debugger: (e) => {
          e.extensions = e.extensions.filter(
            (e) => e.type !== "@UI.ContextMenu.Provider"
          );

          return e;
        },
        sources: (e) => {
          e.extensions.push({
            type: "setting",
            category: "Sources",
            title: "Hide wxapplib",
            settingName: "hideWxapplib",
            settingType: "boolean",
            defaultValue: true,
          });

          return e;
        },
        console: (e) => {
          e.extensions.push({
            type: "setting",
            category: "Console",
            title: "Hide ide stack trace",
            settingName: "hideIDEStackTrace",
            settingType: "boolean",
            defaultValue: true,
          });

          return e;
        },
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
        disableMsgToCrashedWebView.on(t);

        if (!setTimestampOffset(t)) {
          monitorDebugger(t);
          hideWebSocket(t) ||
            (setCloudRequestData(t),
            addDebuggee(t),
            addCustomRequest(t),
            getStackTrace(t) ||
              handleNetworkLog(t) ||
              handleNetworkLog(t) ||
              transTimestamp(t, e) ||
              handleNetworkLog(t) ||
              transTimestamp(t, e) ||
              correctLogStack(t, e) ||
              handleNetworkLog(t) ||
              transTimestamp(t, e) ||
              correctLogStack(t, e) ||
              e(o));
        }
      },
      sendRawMessage(e, o) {
        const t = JSON.parse(o);

        if (!disableMsgToCrashedWebView.send() && !getResponseBody(t)) {
          if (!getResponseBody(t)) {
            e(o);
          }
        }
      },
    },
  },
  {
    name: "pure",
    options: {
      handler() {
        devtoolsReady();
        autoShowAudits();
        reportPerf();
        consoleHoverHighlight();
        monitorClick();
        showMockContextMenu();
        getStackTraceById();
      },
    },
  },
]);

const WebDebugger = toFeatureMap([
  ...commonFeatures,
  "popupButton",
  "enableTouchEmulation",
  "setSafeAreaInset",
  "setDevice",
  "replaceOpenInNewTab",
  "hackReload",
  {
    name: "interceptConnection",
    options: {
      onMessage(e, o) {
        const t = JSON.parse(o);

        if (
          !hideWebSocket(t) &&
          !hideWebdebuggerRequest(t) &&
          !hideWebdebuggerRequest(t) &&
          !hideOpenTagResources(t, e)
        ) {
          if (!hideWebdebuggerRequest(t)) {
            if (!hideOpenTagResources(t, e)) {
              e(o);
            }
          }
        }
      },
      sendRawMessage(e, o) {
        const t = JSON.parse(o);
        disableTouchWhenInspect(t);
        e(o);
      },
    },
  },
  {
    name: "interceptDevToolsAPI",
    options: {
      sendMessageToEmbedder(e, o, t, s) {
        whenUrlChanged(o);
        e(o, t, s);
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
        devtoolsReady();
        consoleHoverHighlight();
        monitorClick();
      },
    },
  },
]);

const gameEnvType = getGameEnvType();

const Game = toFeatureMap([
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
  "errorOccursDisplayIDEInfo",
  "gameInspectMode",
  "disableLog",
  "importTrace",
  "monitorTab",
  consoleLink,
  addQuickOpen,
  {
    name: "hideRequest",
    options: {
      filter(e) {
        if (contain(["Public", "Unknow", "SimulatePublic"], gameEnvType)) {
          if (
            new RegExp(
              `https?://127.0.0.1:${getProxyPort()}/(game/__dev__/)|(wegameengine/)|(ideplugin/)`
            ).test(e)
          ) {
            return true;
          }
        }
      },
    },
  },
  { name: "hackReload", options: { rebuild: !isGameEngineIDEShow() } },
  { name: "hideView", options: { views: ["elements", "lighthouse"] } },
  { name: "addModule", options: { modules: [{ name: "storage" }] } },
  {
    name: "handleConsoleStackTrace",
    options: {
      regexList: [/^ide:\/\/\//, /^http:\/\/127.0.0.1:\d+\/game\/__dev__\//],
    },
  },
  {
    name: "modifyModuleDescriptor",
    options: {
      modules: {
        console: (e) => {
          e.extensions.push({
            type: "setting",
            category: "Console",
            title: "Disable system log",
            settingName: "consoleDisableSystemLog",
            settingType: "boolean",
            defaultValue: false,
            options: [
              { value: true, title: "Disable system log" },
              { value: false, title: "Enable system log" },
            ],
          });

          e.extensions.push({
            type: "setting",
            category: "Console",
            title: "Hide ide stack trace",
            settingName: "hideIDEStackTrace",
            settingType: "boolean",
            defaultValue: true,
          });

          return e;
        },
        sources: AppService.modifyModuleDescriptor.modules.sources,
      },
    },
  },
  {
    name: "interceptConnection",
    options: {
      onMessage(e, o) {
        const t = JSON.parse(o);
        disableMsgToCrashedWebView.on(t);
        monitorDebugger(t);

        if (!hideWebSocket(t)) {
          setCloudRequestData(t);
          getStackTrace(t) ||
            handleNetworkLog(t) ||
            handleNetworkLog(t) ||
            correctLogStack(t, e) ||
            handleNetworkLog(t) ||
            correctLogStack(t, e) ||
            e(o);
        }
      },
      sendRawMessage(e, o) {
        const t = JSON.parse(o);

        if (!disableMsgToCrashedWebView.send()) {
          disableTouchWhenInspect(t);
          getResponseBody(t) || e(o);
        }
      },
    },
  },
  {
    name: "pure",
    options: {
      handler() {
        devtoolsReady();
        reportPerf();
        monitorClick();
        getStackTraceById();
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
]);

const RemoteDebug = toFeatureMap([
  ...commonFeatures,
  "customPanel",
  "monitorNetworkReset",
  "disabledRemoteDebugContextSelector",
  "correctRemoteDebugContext",
  "hideRequest",
  "miniprogramTimeline",
  "wxmlToolbar",
  { name: "hideSettings", options: { categories: ["Elements"] } },
  {
    name: "modifyModuleDescriptor",
    options: {
      modules: extend(
        {
          wxml: (e) => {
            e.extensions = e.extensions.filter(
              (e) =>
                e.location !== "main-toolbar-left" &&
                e.type !== "@UI.ContextMenu.Provider"
            );

            return e;
          },
        },
        AppService.modifyModuleDescriptor.modules
      ),
    },
  },
  { name: "replaceOpenInNewTab", options: { useAlert: true } },
  { name: "hackReload", options: { rebuild: false } },
  {
    name: "hideView",
    options: { views: ["elements", "security", "lighthouse", "resources"] },
  },
  {
    name: "pure",
    options: {
      handler() {
        consoleHoverHighlight();
        monitorClick();
        consoleApiWaitSync();
      },
    },
  },
  {
    name: "interceptConnection",
    options: {
      onMessage(e, o) {
        const t = JSON.parse(o);

        if (!hideRemoteDebugResources(t)) {
          monitorDebugger(t);
          addCustomRequest(t, true);
          e(o);
        }
      },
      sendRawMessage(e, o) {
        const t = JSON.parse(o);

        if (!getResponseBody(t)) {
          e(o);
        }
      },
    },
  },
]);

const LanDebug = toFeatureMap([
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

if (!isRemoteDebugGame()) {
  RemoteDebug.addModule.modules.push(
    { name: "wxml" },
    { name: "storage" },
    { name: "app_data" }
  );
}

const CloudFunctionsDebug = toFeatureMap([
  ...commonFeatures,
  "addCloudResourceCategories",
  "hideSourceMapWarning",
  "processCachedResources",
  "reconnectDevTools",
  "revealSource",
  { name: "replaceOpenInNewTab", options: { useAlert: true } },
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
        setCloudRequestData(t);
        addCustomRequest(t);
        e(o);
      },
      sendRawMessage(e, o) {
        const t = JSON.parse(o);

        if (!getResponseBody(t)) {
          e(o);
        }
      },
    },
  },
]);
export const EnabledFeatures = {
  AppService,
  WebDebugger,
  Game,
  RemoteDebug,
  CloudFunctionsDebug,
  LanDebug,
  Unknown: toFeatureMap(["hideNodeIndicator"]),
};
function toFeatureMap(e) {
  const o = {};

  each(e, (e) => {
    if (isStr(e)) {
      e = { name: e, options: {} };
    }

    o[e.name] = e.options;
  });

  if (!o.addModule) {
    o.addModule = { modules: [] };
  }

  if (!isWebWorker()) {
    o.addModule.modules.push({ name: "features", type: "autostart" });
  }

  return o;
}
