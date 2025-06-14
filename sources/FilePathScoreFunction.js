export class FilePathScoreFunction {
  constructor(e) {
    this._query = e;
    this._queryUpperCase = e.toUpperCase();
    this._score = new Int32Array(2000 /* 2e3 */);
    this._sequence = new Int32Array(2000 /* 2e3 */);
    this._dataUpperCase = "";
    this._fileNameIndex = 0;
  }
  score(e, t) {
    if (!e || !this._query) {
      return 0;
    }
    const r = this._query.length;
    const e_length = e.length;

    if (!this._score || this._score.length < r * e_length) {
      this._score = new Int32Array(r * e_length * 2);
      this._sequence = new Int32Array(r * e_length * 2);
    }

    const a = this._score;
    const h = this._sequence;
    this._dataUpperCase = e.toUpperCase();
    this._fileNameIndex = e.lastIndexOf("/");
    for (let t = 0; t < r; ++t) {
      for (let r = 0; r < e_length; ++r) {
        const i = r === 0 ? 0 : a[t * e_length + r - 1];
        const n = t === 0 || r === 0 ? 0 : a[(t - 1) * e_length + r - 1];
        const _ = t === 0 || r === 0 ? 0 : h[(t - 1) * e_length + r - 1];
        const c = this._match(this._query, e, t, r, _);

        if (c && n + c >= i) {
          h[t * e_length + r] = _ + 1;
          a[t * e_length + r] = n + c;
        } else {
          h[t * e_length + r] = 0;
          a[t * e_length + r] = i;
        }
      }
    }

    if (t) {
      this._restoreMatchIndexes(h, r, e_length, t);
    }

    return 256 * a[r * e_length - 1] + (256 - e.length);
  }
  _testWordStart(e, t) {
    if (t === 0) {
      return true;
    }
    const r = e.charAt(t - 1);
    return (
      r === "_" ||
      r === "-" ||
      r === "-" ||
      r === "/" ||
      r === "-" ||
      r === "/" ||
      r === "." ||
      r === "-" ||
      r === "/" ||
      r === "." ||
      r === " " ||
      (e[t - 1] !== this._dataUpperCase[t - 1] &&
        e[t] === this._dataUpperCase[t])
    );
  }
  _restoreMatchIndexes(e, t, r, s) {
    let a = t - 1;
    let h = r - 1;

    while (a >= 0 && h >= 0) {
      switch (e[a * r + h]) {
        case 0: {
          --h;
          break;
        }
        default: {
          s.push(h);
          --a;
          --h;
        }
      }
    }

    s.reverse();
  }
  _singleCharScore(e, t, r, s) {
    const a = this._testWordStart(t, s);
    const h = s > this._fileNameIndex;
    let i = 10;

    if (s === 0 || t[s - 1] === "/") {
      i += 4;
    }

    if (a) {
      i += 2;
    }

    if (e[r] === t[s] && e[r] === this._queryUpperCase[r]) {
      i += 6;
    }

    if (h) {
      i += 4;
    }

    if (s === this._fileNameIndex + 1 && r === 0) {
      i += 5;
    }

    if (h && a) {
      i += 3;
    }

    return i;
  }
  _sequenceCharScore(e, t, r, s, a) {
    let h = 10;

    if (s > this._fileNameIndex) {
      h += 4;
    }

    if (s === 0 || t[s - 1] === "/") {
      h += 5;
    }

    h += 4 * a;
    return h;
  }
  _match(e, t, r, s, a) {
    return this._queryUpperCase[r] !== this._dataUpperCase[s]
      ? 0
      : a
      ? this._sequenceCharScore(e, t, r, s - a, a)
      : this._singleCharScore(e, t, r, s);
  }
}
