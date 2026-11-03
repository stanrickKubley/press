// Image list for the editor: white cards with a thin outline, a thumbnail when collapsed,
// tap buttons for placement and size, a border switch, a caption, up/down to reorder,
// and "Add images" that accepts several photos at once.
(function () {
  var PLACES = [["auto", "Auto"], ["left", "Left"], ["right", "Right"], ["center", "Center"], ["full", "Full width"]];
  var SIZES = [["auto", "Auto"], ["xsmall", "Extra small"], ["small", "Small"], ["medium", "Medium"], ["large", "Large"]];
  var LABEL = { auto: "Auto", autosize: "Auto size", left: "Left", right: "Right", center: "Center", full: "Full width", xsmall: "Extra small", small: "Small", medium: "Medium", large: "Large" };

  var CSS =
    ".pi-list{display:grid;gap:12px;padding:12px 0 0}" +
    ".pi-card{background:#fff;border:1px solid #1d1f22;border-radius:6px;overflow:hidden}" +
    ".pi-head{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 10px;cursor:pointer;user-select:none}" +
    ".pi-thumb{width:44px;height:44px;flex:none;border-radius:3px;background:#eceef1;border:1px solid #d8dbe0;object-fit:cover;display:block}" +
    ".pi-sum{flex:1;min-width:0;font-size:14px;color:#1d1f22;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".pi-sum small{display:block;color:#6b6e72;font-size:12px;margin-top:2px}" +
    ".pi-icon{flex:none;width:32px;height:32px;border:1px solid transparent;border-radius:4px;background:none;cursor:pointer;font-size:16px;color:#313d3e;line-height:1}" +
    ".pi-icon:hover{border-color:#cfd2d8;background:#f6f7f9}.pi-icon:disabled{opacity:.3;cursor:default;background:none;border-color:transparent}" +
    ".pi-body{display:grid;gap:14px;padding:4px 14px 16px;border-top:1px solid #e6e8ec}" +
    ".pi-label{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#5d626f;margin:10px 0 6px}" +
    ".pi-preview{display:flex;gap:12px;align-items:center;flex-wrap:wrap}" +
    ".pi-preview img{max-height:140px;max-width:220px;border-radius:3px;border:1px solid #d8dbe0}" +
    ".pi-btn{font:inherit;font-size:14px;padding:8px 14px;border-radius:999px;border:1px solid #cfd2d8;background:#fff;color:#313d3e;cursor:pointer}" +
    ".pi-btn[aria-pressed=true]{background:#3a4a7a;border-color:#3a4a7a;color:#fff}" +
    ".pi-btn:focus-visible,.pi-icon:focus-visible{outline:2px solid #3a69c7;outline-offset:2px}" +
    ".pi-row{display:flex;gap:6px;flex-wrap:wrap}" +
    ".pi-hint{font-size:12px;color:#6b6e72;margin-top:6px}" +
    ".pi-check{display:flex;gap:8px;align-items:center;font-size:14px;color:#1d1f22;cursor:pointer}" +
    ".pi-check input{width:18px;height:18px}" +
    ".pi-input{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:9px 10px;border:1px solid #cfd2d8;border-radius:4px}" +
    ".pi-add{margin-top:12px;font:inherit;font-size:15px;padding:12px 16px;width:100%;border-radius:6px;border:1px dashed #1d1f22;background:#fff;color:#1d1f22;cursor:pointer}" +
    ".pi-add:hover{background:#f6f7f9}.pi-add:disabled{opacity:.6;cursor:progress}" +
    ".pi-empty{font-size:14px;color:#6b6e72;padding:6px 0 0}";

  function injectCSS() {
    if (document.getElementById("pi-css")) return;
    var s = document.createElement("style"); s.id = "pi-css"; s.textContent = CSS; document.head.appendChild(s);
  }
  function toArr(v) {
    if (!v) return [];
    if (v.toJS) v = v.toJS();
    return Array.isArray(v) ? v.map(function (i) { return Object.assign({}, i); }) : [];
  }
  function pathsOf(mp) {
    if (!mp) return [];
    if (mp.toJS) mp = mp.toJS();
    return (Array.isArray(mp) ? mp : [mp]).filter(Boolean);
  }

  window.PressImagesControl = function () {
    return createClass({
      getInitialState: function () { return { open: {}, busy: 0 }; },
      componentDidMount: injectCSS,
      ids: function () {
        var base = this.props.forID || "images";
        return { add: base + "-add", replace: base + "-replace" };
      },
      // Decap only redraws a custom field when its value changes, unless the field supplies this check.
      // Always allow redraws, so a photo picked in the library (delivered via mediaPaths) is noticed.
      shouldComponentUpdate: function () { return true; },
      // Same pattern as Decap's own image field: apply the picked photo after the redraw.
      componentDidUpdate: function () {
        var mp = this.props.mediaPaths; if (!mp || !mp.get) return;
        var ids = this.ids(), items;
        var addRaw = mp.get(ids.add), repRaw = mp.get(ids.replace);
        if (addRaw && addRaw !== this.lastAdd) {
          this.lastAdd = addRaw;
          var added = pathsOf(addRaw);
          items = toArr(this.props.value);
          var start = items.length, open = Object.assign({}, this.state.open);
          added.forEach(function (p, k) { items.push({ image: p, placement: "auto", size: "auto", border: true, caption: "" }); open[start + k] = true; });
          this.props.onRemoveInsertedMedia(ids.add);
          this.setState({ open: open });
          this.props.onChange(items);
        }
        if (repRaw && repRaw !== this.lastRep) {
          this.lastRep = repRaw;
          var rep = pathsOf(repRaw);
          items = toArr(this.props.value);
          this.props.onRemoveInsertedMedia(ids.replace);
          if (rep.length && this.replacing != null && items[this.replacing]) {
            items[this.replacing].image = rep[0];
            this.props.onChange(items);
          }
          this.replacing = null;
        }
      },
      componentWillUnmount: function () {
        if (this.props.onRemoveMediaControl) { var ids = this.ids(); this.props.onRemoveMediaControl(ids.add); this.props.onRemoveMediaControl(ids.replace); }
      },
      // Add photos with the device's own picker (several at once). They are appended after the existing images.
      publicPath: function (repoPath, name) {
        var cfg = window.PRESS_PATHS || { media: "images/uploads", public: "/images/uploads" };
        if (repoPath && repoPath.indexOf(cfg.media) === 0) return cfg.public + repoPath.slice(cfg.media.length);
        return repoPath || cfg.public + "/" + name;
      },
      prepare: function (f, k) {
        // Unique name, so a new IMG_1234.jpg never replaces an older post's photo.
        var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
        var stamp = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + "-" + k;
        var base = String(f.name || "photo").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "photo";
        // Shrink very large photos to 3000px on the long side; smaller ones upload untouched.
        var MAX = 3000;
        return new Promise(function (resolve) {
          var dims = {};
          var keep = function () { var ext = (String(f.name).match(/\.[a-z0-9]+$/i) || [".jpg"])[0].toLowerCase(); var nf = new File([f], stamp + "-" + base + ext, { type: f.type }); nf.pressW = dims.w; nf.pressH = dims.h; resolve(nf); };
          if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return keep();
          var url = URL.createObjectURL(f), img = new Image();
          img.onload = function () {
            var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, MAX / Math.max(w, h));
            dims = { w: Math.round(w * s), h: Math.round(h * s) };
            if (s >= 1) { URL.revokeObjectURL(url); return keep(); }
            var c = document.createElement("canvas"); c.width = Math.round(w * s); c.height = Math.round(h * s);
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            c.toBlob(function (b) { if (!b) return keep(); var nf = new File([b], stamp + "-" + base + ".jpg", { type: "image/jpeg" }); nf.pressW = dims.w; nf.pressH = dims.h; resolve(nf); }, "image/jpeg", 0.9);
          };
          img.onerror = function () { URL.revokeObjectURL(url); keep(); };
          img.src = url;
        });
      },
      uploadFiles: function (files, replaceIndex) {
        var self = this, list = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
        if (!list.length) return;
        this.setState({ busy: list.length });
        var paths = [], dimsOf = {};
        var next = function (k) {
          if (k >= list.length) return Promise.resolve();
          return self.prepare(list[k], k).then(function (f) {
            return Promise.resolve(self.props.onPersistMedia(f, { field: self.props.field })).then(function (res) {
              var pl = res && res.payload, rp = pl && (pl.path || (pl.file && pl.file.path));
              var pub = self.publicPath(rp, f.name);
              paths.push(pub); dimsOf[pub] = { w: f.pressW, h: f.pressH };
              try { var bu = URL.createObjectURL(f); (self.local || (self.local = {}))[pub] = bu; (window.PRESS_LOCAL || (window.PRESS_LOCAL = {}))[pub] = bu; } catch (e) {}
            });
          }).catch(function () {}).then(function () { self.setState({ busy: list.length - k - 1 }); return next(k + 1); });
        };
        next(0).then(function () {
          self.setState({ busy: 0 });
          if (!paths.length) return;
          var items = toArr(self.props.value), open = Object.assign({}, self.state.open);
          var withDims = function (o, p) { var d = dimsOf[p] || {}; if (d.w && d.h) { o.w = d.w; o.h = d.h; } else { delete o.w; delete o.h; } return o; };
          if (replaceIndex != null && items[replaceIndex]) { items[replaceIndex].image = paths[0]; withDims(items[replaceIndex], paths[0]); }
          else paths.forEach(function (p) { open[items.length] = true; items.push(withDims({ image: p, placement: "auto", size: "auto", border: true, caption: "" }, p)); });
          self.setState({ open: open });
          self.props.onChange(items);
        });
      },
      pick: function (multiple, replaceIndex) {
        var self = this;
        if (typeof this.props.onPersistMedia !== "function") { // safety net: fall back to Decap's window
          if (replaceIndex != null) { this.replacing = replaceIndex; return this.openLibrary(this.ids().replace, false); }
          return this.openLibrary(this.ids().add, true);
        }
        var input = document.createElement("input");
        input.type = "file"; input.accept = "image/*"; input.multiple = !!multiple; input.style.display = "none";
        input.addEventListener("change", function () { self.uploadFiles(input.files, replaceIndex); input.remove(); });
        document.body.appendChild(input);
        input.click();
      },
      openLibrary: function (id, multiple, value) {
        if (id === this.ids().add) this.lastAdd = null; else this.lastRep = null;
        this.props.onOpenMediaLibrary({
          controlID: id, forImage: true, privateUpload: false, value: value || "",
          allowMultiple: multiple, config: undefined, field: this.props.field
        });
      },
      // Saved images load from their own path; a brand-new upload (not saved yet) falls back to Decap's in-memory copy.
      url: function (p) {
        if (!p) return "";
        if (this.local && this.local[p]) return this.local[p]; // photo picked this session: show the copy in the browser
        try { return new URL(p, document.baseURI).href; } catch (e) { return p; }
      },
      fallback: function (p) {
        var self = this;
        return function (e) {
          var el = e.target; if (el.dataset.fell === p) return; el.dataset.fell = p;
          try { var a = self.props.getAsset(p, self.props.field); var u = a ? String(a.url || a.toString() || "") : ""; if (u) el.src = u; } catch (err) {}
        };
      },
      setDims: function (i, path, w, h) {
        var items = toArr(this.props.value);
        if (!items[i] || items[i].image !== path || (items[i].w > 0 && items[i].h > 0)) return;
        items[i].w = w; items[i].h = h; this.props.onChange(items);
      },
      update: function (i, key, val) {
        var items = toArr(this.props.value); items[i][key] = val; this.props.onChange(items);
      },
      move: function (i, d) {
        var items = toArr(this.props.value), j = i + d;
        if (j < 0 || j >= items.length) return;
        var t = items[i]; items[i] = items[j]; items[j] = t;
        var open = Object.assign({}, this.state.open), o = open[i]; open[i] = open[j]; open[j] = o;
        this.setState({ open: open }); this.props.onChange(items);
      },
      remove: function (i) {
        var items = toArr(this.props.value); items.splice(i, 1);
        var open = {}, old = this.state.open;
        Object.keys(old).forEach(function (k) { k = +k; if (k < i) open[k] = old[k]; else if (k > i) open[k - 1] = old[k]; });
        this.setState({ open: open }); this.props.onChange(items);
      },
      toggle: function (i) { var o = Object.assign({}, this.state.open); o[i] = !o[i]; this.setState({ open: o }); },

      card: function (img, i, n) {
        var self = this, open = !!this.state.open[i], place = img.placement || "auto", size = img.size || "auto";
        var src = this.url(img.image);
        var stop = function (fn) { return function (e) { e.stopPropagation(); fn(); }; };
        var head = h("div", { className: "pi-head", onClick: function () { self.toggle(i); }, "aria-expanded": open },
          src ? h("img", { key: "t-" + img.image, className: "pi-thumb", src: src, alt: "", "aria-hidden": true, onError: this.fallback(img.image),
              onLoad: function (e) { var el = e.target; if (!(img.w > 0 && img.h > 0) && el.naturalWidth) self.setDims(i, img.image, el.naturalWidth, el.naturalHeight); } })
              : h("div", { className: "pi-thumb", "aria-hidden": true }),
          h("div", { className: "pi-sum" },
            img.caption || "No caption",
            h("small", null, LABEL[place] + " · " + (size === "auto" ? LABEL.autosize : LABEL[size]) + (img.border ? " · Border" : ""))),
          h("button", { type: "button", className: "pi-icon", title: "Move up", "aria-label": "Move image up", disabled: i === 0, onClick: stop(function () { self.move(i, -1); }) }, "↑"),
          h("button", { type: "button", className: "pi-icon", title: "Move down", "aria-label": "Move image down", disabled: i === n - 1, onClick: stop(function () { self.move(i, 1); }) }, "↓"),
          h("button", { type: "button", className: "pi-icon", title: open ? "Collapse" : "Expand", "aria-label": open ? "Collapse" : "Expand", onClick: stop(function () { self.toggle(i); }) }, open ? "▴" : "▾"),
          h("button", { type: "button", className: "pi-icon", title: "Remove image", "aria-label": "Remove image", onClick: stop(function () { self.remove(i); }) }, "×"));
        if (!open) return h("div", { className: "pi-card", key: i }, head);

        var choices = function (list, cur, key) {
          return h("div", { className: "pi-row", role: "group" }, list.map(function (o) {
            return h("button", { key: o[0], type: "button", className: "pi-btn", "aria-pressed": o[0] === cur,
              onClick: function () { self.update(i, key, o[0]); } }, o[1]);
          }));
        };
        var body = h("div", { className: "pi-body" },
          h("div", null,
            h("div", { className: "pi-label" }, "Image"),
            h("div", { className: "pi-preview" },
              src ? h("img", { key: "p-" + img.image, src: src, alt: "", onError: this.fallback(img.image) }) : null,
              h("button", { type: "button", className: "pi-btn", onClick: function () { self.pick(false, i); } },
                src ? "Replace image" : "Choose image"))),
          h("div", null,
            h("div", { className: "pi-label" }, "Where it goes"), choices(PLACES, place, "placement"),
            h("div", { className: "pi-hint" }, "Auto: next to a paragraph, taking turns left and right. Left / Right: next to a paragraph, on that side. Center: on its own line, centered. Full width: on its own line, across the whole page.")),
          h("div", null,
            h("div", { className: "pi-label" }, "Size"), choices(SIZES, size, "size"),
            h("div", { className: "pi-hint" }, "Auto picks a size that looks balanced: the first image in the entry is the biggest, later ones a step smaller. Or choose: Extra small is about a quarter of the page wide, Small about a third, Medium about half, Large about two-thirds. (Full width ignores this.)")),
          h("label", { className: "pi-check" },
            h("input", { type: "checkbox", checked: !!img.border, onChange: function (e) { self.update(i, "border", e.target.checked); } }),
            "Thin black border (a fine black line around the image)"),
          h("div", null,
            h("div", { className: "pi-label" }, "Caption (optional)"),
            h("div", { className: "pi-hint", style: { margin: "0 0 6px" } }, "Shows directly under the image, e.g. title, medium, year."),
            h("input", { className: "pi-input", type: "text", value: img.caption || "", placeholder: "e.g. title, medium, year",
              onChange: function (e) { self.update(i, "caption", e.target.value); } })));
        return h("div", { className: "pi-card", key: i }, head, body);
      },

      render: function () {
        var self = this, items = toArr(this.props.value);
        return h("div", { id: this.props.forID },
          items.length ? h("div", { className: "pi-list" }, items.map(function (img, i) { return self.card(img, i, items.length); }))
                       : h("div", { className: "pi-empty" }, "No images yet."),
          h("button", { type: "button", className: "pi-add", disabled: !!this.state.busy, onClick: function () { self.pick(true); } },
            this.state.busy ? "Adding photos… " + this.state.busy + " to go" : "+ Add images (pick as many as you like)"));
      }
    });
  };
})();
