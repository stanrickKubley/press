// "Preview" button: shows the entry full screen exactly as visitors will see it, with a Desktop / Phone switch.
// Desktop renders at laptop width (1280px) and shrinks to fit, so it's useful on a phone too. Works on drafts.
(function () {
  var DESKTOP_W = 1280, PHONE_W = 390, cssText = null;

  function getCSS() {
    if (cssText != null) return Promise.resolve(cssText);
    if (window.PRESS_CSS) { cssText = window.PRESS_CSS; return Promise.resolve(cssText); }
    return fetch("press.css").then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; })
      .then(function (t) { cssText = t; return t; });
  }
  function getHeader() {
    if (window.PRESS_HEADER != null) return Promise.resolve(window.PRESS_HEADER);
    return fetch("header.html").then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; })
      .then(function (t) { window.PRESS_HEADER = t; return t; });
  }

  var STYLE =
    ".pv-overlay{position:fixed;inset:0;z-index:100000;background:#2a2c30;display:flex;flex-direction:column}" +
    ".pv-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px max(12px,env(safe-area-inset-left,0px));background:#1d1f22;color:#f2f1ee;font:14px/1.3 -apple-system,system-ui,sans-serif}" +
    ".pv-bar strong{font-weight:600;margin-right:6px}" +
    ".pv-tab{font:inherit;padding:7px 14px;border-radius:999px;border:1px solid #55585f;background:transparent;color:#f2f1ee;cursor:pointer}" +
    ".pv-tab[aria-pressed=true]{background:#f2f1ee;color:#1d1f22;border-color:#f2f1ee}" +
    ".pv-close{margin-left:auto;font:inherit;padding:7px 14px;border-radius:999px;border:0;background:#f2f1ee;color:#1d1f22;cursor:pointer}" +
    ".pv-note{width:100%;font-size:12px;color:#a9abb1}" +
    ".pv-stage{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:12px}" +
    ".pv-frame-wrap{margin:0 auto;background:#fff;box-shadow:0 2px 18px rgba(0,0,0,.35);transform-origin:top left;overflow:hidden}" +
    ".pv-frame-wrap iframe{display:block;border:0;background:#feffe9}";

  function injectStyle() {
    if (document.getElementById("pv-css")) return;
    var s = document.createElement("style"); s.id = "pv-css"; s.textContent = STYLE; document.head.appendChild(s);
  }

  function pageHTML(css, header, article) {
    return '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Abel&family=Source+Code+Pro:ital,wght@0,300;0,400;0,500;1,300&display=swap">' +
      "<style>" + css + "a{pointer-events:none}</style></head><body><main class=\"pf-page\">" + (header || "") +
      '<div class="pf-feed">' + article + "</div></main></body></html>";
  }

  function open(post, resolve) {
    injectStyle();
    Promise.all([getCSS(), getHeader()]).then(function (res) {
      var html = pageHTML(res[0], res[1], window.PressRender.postHTML(post, resolve).replace(/ loading="lazy"/g, ""));
      var ov = document.createElement("div");
      ov.className = "pv-overlay"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Preview");
      ov.innerHTML =
        '<div class="pv-bar"><strong>Preview</strong>' +
        '<button type="button" class="pv-tab" data-mode="desktop">Desktop</button>' +
        '<button type="button" class="pv-tab" data-mode="phone">Phone</button>' +
        '<button type="button" class="pv-close">Close</button>' +
        '<div class="pv-note"></div></div>' +
        '<div class="pv-stage"><div class="pv-frame-wrap"><iframe title="Preview"></iframe></div></div>';
      document.body.appendChild(ov);
      var stage = ov.querySelector(".pv-stage"), wrap = ov.querySelector(".pv-frame-wrap"), frame = ov.querySelector("iframe");
      var note = ov.querySelector(".pv-note"), mode = "desktop";

      function fit() {
        var w = mode === "desktop" ? DESKTOP_W : PHONE_W;
        var avail = stage.clientWidth - 24, scale = Math.min(1, avail / w);
        var docH = 800;
        try { docH = Math.max(600, frame.contentDocument.documentElement.scrollHeight); } catch (e) {}
        frame.style.width = w + "px"; frame.style.height = docH + "px";
        wrap.style.width = w + "px"; wrap.style.height = docH + "px";
        wrap.style.transform = scale < 1 ? "scale(" + scale + ")" : "";
        wrap.style.marginBottom = scale < 1 ? (-(docH * (1 - scale))) + "px" : "";
        wrap.style.marginLeft = scale < 1 ? "0" : "auto"; wrap.style.marginRight = scale < 1 ? "0" : "auto";
        note.textContent = mode === "desktop"
          ? "How it looks on a computer" + (scale < 1 ? " (shrunk to fit this screen)" : "") + "."
          : "How it looks on a phone.";
        ov.querySelectorAll(".pv-tab").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-mode") === mode ? "true" : "false"); });
      }
      function render() {
        frame.onload = function () {
          fit();
          // Images load after the page: re-measure the height as they arrive.
          try { frame.contentDocument.querySelectorAll("img").forEach(function (im) { im.addEventListener("load", fit); }); } catch (e) {}
        };
        frame.srcdoc = html;
      }
      function close() { window.removeEventListener("resize", fit); document.removeEventListener("keydown", onKey); ov.remove(); }
      function onKey(e) { if (e.key === "Escape") close(); }

      ov.addEventListener("click", function (e) {
        var t = e.target.closest("button"); if (!t) return;
        if (t.classList.contains("pv-close")) return close();
        var m = t.getAttribute("data-mode"); if (m && m !== mode) { mode = m; render(); }
      });
      window.addEventListener("resize", fit);
      document.addEventListener("keydown", onKey);
      render();
    });
  }

  window.PressPreviewControl = function () {
    return createClass({
      openPreview: function () {
        var p = this.props;
        var entry = typeof p.getEntry === "function" ? p.getEntry() : p.entry;
        var data = entry && entry.get ? entry.get("data") : null;
        var post = data && data.toJS ? data.toJS() : {};
        var resolve = function (path) { return path ? window.PressAsset.url(path) : ""; };
        // Wait until every image is found (draft images come from GitHub), then open.
        var paths = (post.images || []).map(function (i) { return i && i.image; }).filter(Boolean);
        Promise.all(paths.map(function (x) { return window.PressAsset.ensure(x); })).then(function () { open(post, resolve); });
      },
      render: function () {
        var self = this;
        return h("div", { className: "pv-launch", id: this.props.forID },
          h("button", { type: "button", onClick: function () { self.openPreview(); } }, window.innerWidth < 800 ? "Preview" : "Preview: see it on Desktop or Phone"));
      }
    });
  };
})();
