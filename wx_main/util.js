import { contain, toStr, isUndef } from "../third_party/licia.js";
const ua = navigator.userAgent || window.__global.navigator.userAgent;
let port;
let proxyPort;
let masterProxyPort;
export function getPort() {
  if (port) {
    return port;
  }
  const t = ua.match(/port\/(\d*)/);
  port = t ? parseInt(t[1], 10) : 9974;
  return port;
}
export function getMessageToken() {
  return window.__global && window.__global.prompt
    ? window.__global.prompt("GET_MESSAGE_TOKEN")
    : prompt("GET_MESSAGE_TOKEN");
}
export function getProxyPort() {
  if (proxyPort) {
    return proxyPort;
  }
  const t = ua.match(/proxy\/(\d*)/);
  proxyPort = t ? parseInt(t[1], 10) : 9974;
  return proxyPort;
}
export function getMasterProxyPort() {
  if (masterProxyPort) {
    return masterProxyPort;
  }
  const t = ua.match(/masterProxy\/(\d*)/);
  masterProxyPort = t ? parseInt(t[1], 10) : 9974;
  return masterProxyPort;
}
export function isGameEngine() {
  return contain(ua, "gameEngine/true");
}
export function isGameEngineIDEShow() {
  return contain(ua, "showGameEngineIDE/true");
}
const gameEnvTypes = [
  "Public",
  "Test",
  "PublicDev",
  "Vip",
  "TestServer",
  "Dev",
  "SimulatePublic",
  "Unknow",
];
export function getGameEnvType() {
  const t = ua.match(/\sgameserviceenv\/([^\s]+)\s/);
  return t && t[1] && contain(gameEnvTypes, t[1]) ? t[1] : "UnKnow";
}
export function getChromeVersion() {
  const t = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
  return toStr(t ? parseInt(t[2], 10) : 0);
}
export function isRemoteDebugGame() {
  return contain(ua, "compileType/game");
}
export function isRemoteAppserviceMode() {
  return contain(ua, "remoteappservice");
}
export function isWebWorker() {
  return isUndef(self.document);
}
export function isElectron() {
  return contain(ua, "electron");
}
