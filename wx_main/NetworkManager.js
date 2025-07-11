export default class NetworkManager {
  constructor() {
    this.reset();
  }
  setTimestampOffset(e) {
    this._timestampOffset = e;
  }
  getTimestampOffset() {
    return this._timestampOffset;
  }
  addDebuggee(e, t) {
    this._debuggeeMap.set(e, t);
  }
  getDebuggee(e) {
    return this._debuggeeMap.get(e);
  }
  addCustomRequest(e) {
    this._customRequestMap.set(e, true);
  }
  addNetworkLogRequestCallFramesInfo(e, t, s = 0) {
    this._networkLogRequestCallFramesMap.set(e, {
      callFrames: t,
      ignoreLength: s,
    });
  }
  getNetworkLogRequestCallFramesInfo(e) {
    return this._networkLogRequestCallFramesMap.get(e);
  }
  isCustomRequest(e) {
    return !!this._customRequestMap.get(e);
  }
  reset() {
    this._debuggeeMap = new Map();
    this._customRequestMap = new Map();
    this._networkLogRequestCallFramesMap = new Map();
    this._timestampOffset = 0;
  }
}
self.WxMain = self.WxMain || {};
WxMain.NetworkManager = NetworkManager;
WxMain.networkManager = new NetworkManager();
