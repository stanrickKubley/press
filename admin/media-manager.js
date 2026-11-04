// "Media" in the top bar opens this instead of Decap's media library: a grid of every uploaded image, marked with
// the entry that uses it (or "Not used"). Select any number of unused images and delete them in one step.
// Images an entry still uses can't be selected, so deleting can never break the page.
// Works through the same Git Gateway connection the editor uses; deletions are one commit on main.
(function () {
  var MEDIA_DIR = "images/uploads", PUBLIC_DIR = "/images/uploads", POSTS_DIR = "content/posts";

  function token() {
    var id = window.netlifyIdentity, u = id && id.currentUser && id.currentUser();
    return u ? u.jwt() : Promise.reject(new Error("Not signed in"));
  }
  function api(tok, path, method, body) {
    return fetch("/.netlify/git/github/" + path, {
      method: method || "GET",
      headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.message) || ("Error " + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function decode(b64) {
    var bin = atob(String(b64).replace(/\n/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  var STYLE =
    ".mm-ov{position:fixed;inset:0;z-index:100000;background:rgba(46,49,5,.35);display:flex;align-items:center;justify-content:center;padding:16px}" +
    ".mm-box{background:#feffe9;color:#2e3105;width:min(1100px,100%);max-height:100%;display:flex;flex-direction:column;border:1px solid #d9dab4;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.25);font:15px/1.4 -apple-system,system-ui,sans-serif}" +
    ".mm-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:14px 16px;border-bottom:1px solid #d9dab4}" +
    ".mm-head h2{font:400 24px/1.2 Abel,'Helvetica Neue',Arial,sans-serif;margin:0 auto 0 0}" +
    ".mm-btn{font:inherit;font-size:14px;padding:8px 14px;border-radius:6px;border:1px solid #2e3105;background:#fff;color:#2e3105;cursor:pointer;white-space:nowrap}" +
    ".mm-btn:hover{background:#eef0cf}.mm-btn:disabled{opacity:.45;cursor:default;background:#fff}" +
    ".mm-btn.mm-danger{border-color:#a4262c;color:#a4262c}.mm-btn.mm-danger.mm-solid{background:#a4262c;color:#fff}" +
    ".mm-btn.mm-dark{background:#2e3105;color:#feffe9}" +
    ".mm-note{padding:10px 16px;font-size:14px;color:#6f7147;border-bottom:1px solid #d9dab4}" +
    ".mm-note.mm-err{color:#a4262c}.mm-note.mm-ok{color:#2e3105}" +
    ".mm-grid{overflow:auto;-webkit-overflow-scrolling:touch;padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));grid-auto-rows:max-content;align-content:start;flex:1 1 auto;min-height:0;gap:14px}" +
    ".mm-card{position:relative;display:flex;flex-direction:column;height:auto;align-self:start;background:#fff;border:2px solid #d9dab4;border-radius:6px;overflow:hidden;cursor:pointer;text-align:left;padding:0;font:inherit;color:inherit}" +
    ".mm-card.mm-used{cursor:default}.mm-card.mm-on{border-color:#a4262c;box-shadow:0 0 0 2px #a4262c}" +
    ".mm-card img{display:block;flex:none;width:100%;aspect-ratio:1/1;object-fit:contain;background:#f4f4ea}" +
    ".mm-meta{display:block;flex:none;padding:8px 9px;font-size:12px;line-height:1.35;min-width:0}" +
    ".mm-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6f7147}" +
    ".mm-use{margin-top:3px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".mm-unused .mm-use{color:#8a6d0b}" +
    ".mm-tick{position:absolute;top:8px;left:8px;width:24px;height:24px;border-radius:50%;border:2px solid #fff;background:rgba(46,49,5,.35);box-shadow:0 1px 3px rgba(0,0,0,.3);color:#fff;font:700 14px/20px system-ui;text-align:center}" +
    ".mm-on .mm-tick{background:#a4262c}" +
    ".mm-used .mm-tick{display:none}" +
    ".mm-empty{padding:30px 16px;color:#6f7147}" +
    "@media (max-width:560px){.mm-ov{padding:0}.mm-box{border-radius:0;height:100%}.mm-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px}}";

  function injectStyle() {
    if (document.getElementById("mm-css")) return;
    var s = document.createElement("style"); s.id = "mm-css"; s.textContent = STYLE; document.head.appendChild(s);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function open() {
    if (document.querySelector(".mm-ov")) return;
    injectStyle();
    var ov = el("div", "mm-ov"), box = el("div", "mm-box");
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Images");
    var head = el("div", "mm-head");
    head.appendChild(el("h2", null, "Images"));
    var bUnused = el("button", "mm-btn", "Select all unused");
    var bDel = el("button", "mm-btn mm-danger", "Delete selected");
    var bClose = el("button", "mm-btn mm-dark", "Close");
    [bUnused, bDel, bClose].forEach(function (b) { b.type = "button"; head.appendChild(b); });
    var note = el("div", "mm-note", "Loading images…");
    var grid = el("div", "mm-grid");
    box.appendChild(head); box.appendChild(note); box.appendChild(grid); ov.appendChild(box);
    document.body.appendChild(ov);

    var items = [], selected = {}, confirming = false, busy = false;

    function close() { document.removeEventListener("keydown", onKey); ov.remove(); }
    function onKey(e) { if (e.key === "Escape" && !busy) close(); }
    document.addEventListener("keydown", onKey);
    bClose.onclick = function () { if (!busy) close(); };
    ov.addEventListener("click", function (e) { if (e.target === ov && !busy) close(); });

    function count() { return Object.keys(selected).length; }
    function setNote(text, kind) { note.textContent = text; note.className = "mm-note" + (kind ? " mm-" + kind : ""); }
    function refreshButtons() {
      var n = count();
      bUnused.disabled = busy || !items.some(function (it) { return !it.used.length && !selected[it.path]; });
      bDel.disabled = busy || !n;
      if (confirming && n) {
        bDel.textContent = "Yes, delete " + n + (n === 1 ? " image" : " images");
        bDel.className = "mm-btn mm-danger mm-solid";
      } else {
        confirming = false;
        bDel.textContent = n ? "Delete selected (" + n + ")" : "Delete selected";
        bDel.className = "mm-btn mm-danger";
      }
    }
    function summary() {
      var unused = items.filter(function (it) { return !it.used.length; }).length;
      setNote(items.length + (items.length === 1 ? " image" : " images") + " · " + unused + " not used by any entry. " +
        "Tap unused images to select them. Images an entry still uses can't be deleted.");
    }

    function render() {
      grid.innerHTML = "";
      if (!items.length) { grid.appendChild(el("div", "mm-empty", "No images uploaded yet.")); return; }
      items.forEach(function (it) {
        var used = it.used.length > 0;
        // A div, not a <button>: Decap's button styles squash the card and hide the label.
        var card = el("div", "mm-card" + (used ? " mm-used" : " mm-unused") + (selected[it.path] ? " mm-on" : ""));
        card.setAttribute("role", "button"); card.tabIndex = used ? -1 : 0;
        if (used) card.setAttribute("aria-disabled", "true");
        card.setAttribute("aria-pressed", selected[it.path] ? "true" : "false");
        card.title = it.name;
        var img = el("img"); img.alt = ""; img.loading = "lazy";
        img.src = window.PressAsset ? window.PressAsset.url(it.pub) : it.pub;
        img.onerror = function () {
          if (img.dataset.tried || !window.PressAsset) return; img.dataset.tried = "1";
          window.PressAsset.ensure(it.pub).then(function (u) { if (u) img.src = u; });
        };
        card.appendChild(img);
        card.appendChild(el("span", "mm-tick", selected[it.path] ? "✓" : ""));
        var meta = el("span", "mm-meta");
        meta.appendChild(el("span", "mm-name", it.name));
        meta.lastChild.style.display = "block";
        var use = el("span", "mm-use", used ? "In: " + it.used.join(", ") : "Not used");
        use.style.display = "block";
        meta.appendChild(use);
        card.appendChild(meta);
        card.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.onclick(); } };
        card.onclick = function () {
          if (used || busy) return;
          if (selected[it.path]) delete selected[it.path]; else selected[it.path] = it;
          confirming = false;
          render(); refreshButtons();
        };
        grid.appendChild(card);
      });
    }

    function load() {
      busy = true; refreshButtons();
      return token().then(function (tok) {
        // Read the latest version by its exact id (the folder-listing API can serve a stale copy for a minute).
        return api(tok, "git/refs/heads/main").then(function (ref) {
          return api(tok, "git/commits/" + ref.object.sha);
        }).then(function (commit) {
          return api(tok, "git/trees/" + commit.tree.sha + "?recursive=1");
        }).then(function (full) {
          var blobs = (full.tree || []).filter(function (e) { return e.type === "blob"; });
          var files = blobs.filter(function (e) {
            return e.path.indexOf(MEDIA_DIR + "/") === 0 && e.path.slice(MEDIA_DIR.length + 1).indexOf("/") < 0 &&
              /\.(png|jpe?g|webp|gif|svg|heic)$/i.test(e.path);
          });
          var posts = blobs.filter(function (e) { return e.path.indexOf(POSTS_DIR + "/") === 0 && /\.json$/.test(e.path); });
          return Promise.all(posts.map(function (p) {
            return api(tok, "git/blobs/" + p.sha).then(function (b) {
              try { return JSON.parse(decode(b.content)); } catch (e) { return null; }
            }).catch(function () { return null; });
          })).then(function (entries) {
            var usedBy = {};
            entries.forEach(function (d) {
              if (!d) return;
              var label = (d.title || d.publication || d.date || "an entry") + (d.draft === true ? " (draft)" : "");
              (d.images || []).forEach(function (im) {
                var p = im && im.image; if (!p) return;
                var name = String(p).split("/").pop();
                (usedBy[name] = usedBy[name] || []).indexOf(label) < 0 && usedBy[name].push(label);
              });
            });
            items = files.map(function (f) {
              var name = f.path.split("/").pop();
              return { name: name, path: f.path, pub: PUBLIC_DIR + "/" + name, used: usedBy[name] || [] };
            }).sort(function (a, b) { return (a.used.length > 0) - (b.used.length > 0) || b.name.localeCompare(a.name); });
            selected = {};
          });
        });
      }).then(function () {
        busy = false; summary(); render(); refreshButtons();
      }, function (e) {
        busy = false; refreshButtons();
        setNote("Couldn't load the images (" + e.message + "). Close this and try again.", "err");
      });
    }

    bUnused.onclick = function () {
      items.forEach(function (it) { if (!it.used.length) selected[it.path] = it; });
      confirming = false; render(); refreshButtons();
    };

    bDel.onclick = function () {
      var list = Object.keys(selected).map(function (k) { return selected[k]; });
      if (!list.length || busy) return;
      if (!confirming) {
        confirming = true; refreshButtons();
        setNote("Press the red button again to delete " + list.length + (list.length === 1 ? " image" : " images") + " for good, or tap an image to change the selection.", "err");
        return;
      }
      busy = true; confirming = false; refreshButtons();
      setNote("Deleting " + list.length + (list.length === 1 ? " image…" : " images…"));
      token().then(function (tok) {
        return api(tok, "git/refs/heads/main").then(function (ref) {
          var base = ref.object.sha;
          // Rebuild the full file list without the deleted images (GitHub sometimes rejects "remove" entries).
          var gone = {}; list.forEach(function (it) { gone[it.path] = true; });
          return api(tok, "git/commits/" + base).then(function (commit) {
            return api(tok, "git/trees/" + commit.tree.sha + "?recursive=1");
          }).then(function (full) {
            if (full.truncated) throw new Error("too many files to list");
            var keep = full.tree.filter(function (e) { return e.type === "blob" && !gone[e.path]; })
              .map(function (e) { return { path: e.path, mode: e.mode, type: "blob", sha: e.sha }; });
            return api(tok, "git/trees", "POST", { tree: keep });
          }).then(function (tree) {
            return api(tok, "git/commits", "POST", {
              message: "Delete " + list.length + " unused image" + (list.length === 1 ? "" : "s") + "\n\n" + list.map(function (it) { return "- " + it.name; }).join("\n"),
              tree: tree.sha, parents: [base]
            });
          }).then(function (c) {
            return api(tok, "git/refs/heads/main", "PATCH", { sha: c.sha });
          });
        });
      }).then(function () {
        var n = list.length;
        return load().then(function () {
          setNote("Deleted " + n + (n === 1 ? " image." : " images.") + " " + note.textContent, "ok");
        });
      }, function (e) {
        busy = false; refreshButtons();
        setNote("Couldn't delete (" + e.message + "). Nothing was changed. Try again in a moment.", "err");
      });
    };

    load();
  }

  window.PressMediaManager = { open: open };

  // Send the top bar's "Media" link here instead of Decap's media library.
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("[class*='-AppHeaderButton-'], [class*='-AppHeaderNavLink-']");
    if (!link || !/Media/.test(link.textContent)) return;
    e.preventDefault(); e.stopPropagation();
    open();
  }, true);
})();
