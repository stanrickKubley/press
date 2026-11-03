// Text box for the editor: Bold / Italic / Link buttons, and pasting from a web page or document
// keeps links, bold, italic, lists, quotes and headings. Everything else is stripped to plain text.
// Saves as Markdown, the same format the page builder reads.
(function () {
  // ---------- HTML -> Markdown ----------
  function escText(s) { return s.replace(/([\\*_\[\]])/g, "\\$1"); }
  var BLOCK = /^(P|DIV|H1|H2|H3|H4|H5|H6|UL|OL|LI|BLOCKQUOTE|SECTION|ARTICLE|HEADER|FOOTER|TABLE|TR|PRE|FIGURE)$/;
  var SKIP = /^(SCRIPT|STYLE|IMG|PICTURE|SVG|VIDEO|AUDIO|IFRAME|NOSCRIPT|BUTTON|INPUT|SELECT|TEXTAREA|META|LINK|HEAD|TITLE)$/;

  function inlineMD(node) {
    var out = "";
    node.childNodes.forEach(function (n) {
      if (n.nodeType === 3) { out += escText(n.nodeValue.replace(/\s+/g, " ")); return; }
      if (n.nodeType !== 1 || SKIP.test(n.tagName)) return;
      var t = n.tagName, inner;
      if (t === "BR") { out += "\n"; return; }
      if (t === "SUP" && /^\s*\[\d+\]\s*$/.test(n.textContent)) return; // footnote markers like [1]
      if (BLOCK.test(t)) { inner = inlineMD(n).trim(); if (inner) out += (out && !/\s$/.test(out) ? " " : "") + inner + " "; return; }
      inner = inlineMD(n);
      var style = (n.getAttribute("style") || "").toLowerCase();
      var bold = t === "B" || t === "STRONG" || /font-weight:\s*(bold|[6-9]00)/.test(style);
      var ital = t === "I" || t === "EM" || /font-style:\s*italic/.test(style);
      if (t === "B" && /font-weight:\s*normal/.test(style)) bold = false; // Google Docs wraps everything in <b style="font-weight:normal">
      if (t === "A") {
        var href = n.getAttribute("href") || "";
        if (/^https?:|^mailto:/i.test(href) && inner.trim()) inner = "[" + inner.trim() + "](" + href.replace(/\)/g, "%29").replace(/ /g, "%20") + ")";
      }
      if (inner.trim()) {
        var lead = inner.match(/^\s*/)[0], trail = inner.match(/\s*$/)[0], core = inner.trim();
        if (ital) core = "*" + core + "*";
        if (bold) core = "**" + core + "**";
        inner = lead + core + trail;
      }
      out += inner;
    });
    return out;
  }

  function blocksMD(node, out) {
    var buf = "";
    function flush() { var s = buf.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").trim(); if (s) out.push(s); buf = ""; }
    node.childNodes.forEach(function (n) {
      if (n.nodeType === 3) { buf += escText(n.nodeValue.replace(/\s+/g, " ")); return; }
      if (n.nodeType !== 1 || SKIP.test(n.tagName)) return;
      var t = n.tagName;
      if (!BLOCK.test(t)) { var wrap = document.createElement("span"); wrap.appendChild(n.cloneNode(true)); buf += inlineMD(wrap); return; }
      flush();
      if (/^H[1-6]$/.test(t)) { var h = inlineMD(n).trim(); if (h) out.push("### " + h); return; }
      if (t === "UL" || t === "OL") {
        var items = [], i = 1;
        n.querySelectorAll(":scope > li").forEach(function (li) {
          var s = inlineMD(li).trim().replace(/\n+/g, " ");
          if (s) items.push((t === "OL" ? (i++) + ". " : "- ") + s);
        });
        if (items.length) out.push(items.join("\n"));
        return;
      }
      if (t === "BLOCKQUOTE") {
        var inner = []; blocksMD(n, inner);
        if (inner.length) out.push(inner.join("\n\n").split("\n").map(function (l) { return "> " + l; }).join("\n"));
        return;
      }
      if (t === "TABLE") { n.querySelectorAll("tr").forEach(function (tr) { var s = inlineMD(tr).trim(); if (s) out.push(s); }); return; }
      var hasBlocks = Array.prototype.some.call(n.children, function (c) { return BLOCK.test(c.tagName); });
      if (hasBlocks) blocksMD(n, out);
      else { var p = inlineMD(n).trim(); if (p) out.push(p); }
    });
    flush();
    return out;
  }

  function htmlToMarkdown(rootOrHTML) {
    var root = rootOrHTML;
    if (typeof rootOrHTML === "string") root = new DOMParser().parseFromString(rootOrHTML, "text/html").body;
    return blocksMD(root, []).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function plainToMarkdown(text) {
    return String(text).replace(/\r/g, "").split(/\n\s*\n/).map(function (p) { return escText(p.trim()); }).filter(Boolean).join("\n\n");
  }

  // ---------- The widget ----------
  var CSS = ".pt-wrap{border:2px solid #dfdfe3;border-radius:5px;background:#fff;overflow:hidden}" +
    ".pt-wrap:focus-within{border-color:#3a69c7}" +
    ".pt-bar{display:flex;gap:4px;align-items:center;flex-wrap:wrap;padding:6px 8px;background:#f2f2f5;border-bottom:1px solid #dfdfe3}" +
    ".pt-bar button{font:inherit;font-size:14px;min-width:34px;height:32px;padding:0 10px;border:1px solid transparent;border-radius:4px;background:none;color:#313d3e;cursor:pointer}" +
    ".pt-bar button:hover,.pt-bar button[aria-pressed=true]{background:#fff;border-color:#cfd2d8}" +
    ".pt-link{display:flex;gap:6px;align-items:center;padding:6px 8px;background:#f8f8fa;border-bottom:1px solid #dfdfe3}" +
    ".pt-link[hidden]{display:none}" +
    ".pt-link input{flex:1;min-width:0;font:inherit;font-size:14px;padding:6px 8px;border:1px solid #cfd2d8;border-radius:4px}" +
    ".pt-link button{font:inherit;font-size:13px;padding:6px 10px;border-radius:4px;border:1px solid #cfd2d8;background:#fff;cursor:pointer}" +
    ".pt-ed{min-height:180px;padding:14px 16px;font-size:16px;line-height:1.6;color:#1d1f22;outline:none}" +
    ".pt-ed>*{margin:0 0 .8em}.pt-ed>:last-child{margin-bottom:0}" +
    ".pt-ed a{color:#2f4a8a;text-decoration:underline}" +
    ".pt-ed h3{font-size:1.15em;font-weight:600}" +
    ".pt-ed ul,.pt-ed ol{padding-left:1.4em}" +
    ".pt-ed blockquote{border-left:3px solid #cfd2d8;padding-left:12px;font-style:italic}" +
    ".pt-ed:empty:before{content:attr(data-placeholder);color:#9a9ca3}";

  function injectCSS() {
    if (document.getElementById("pt-css")) return;
    var s = document.createElement("style"); s.id = "pt-css"; s.textContent = CSS; document.head.appendChild(s);
  }

  function build(host, value, onChange) {
    injectCSS();
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {}
    host.innerHTML =
      '<div class="pt-wrap">' +
        '<div class="pt-bar" role="toolbar" aria-label="Text formatting">' +
          '<button type="button" data-cmd="bold" title="Bold" aria-label="Bold"><b>B</b></button>' +
          '<button type="button" data-cmd="italic" title="Italic" aria-label="Italic"><i>I</i></button>' +
          '<button type="button" data-cmd="link" title="Add link">Link</button>' +
          '<button type="button" data-cmd="unlink" title="Remove link">Remove link</button>' +
        "</div>" +
        '<div class="pt-link" hidden><input type="url" placeholder="Paste the web address, then press Enter" aria-label="Link address">' +
          '<button type="button" data-act="apply">Add link</button><button type="button" data-act="cancel">Cancel</button></div>' +
        '<div class="pt-ed" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Write or paste the text here"></div>' +
      "</div>";
    var ed = host.querySelector(".pt-ed"), bar = host.querySelector(".pt-bar");
    var linkRow = host.querySelector(".pt-link"), linkInput = linkRow.querySelector("input");
    ed.innerHTML = window.PressRender.bodyHTML(value || "");

    var last = value || "", timer = null, saved = null;
    function save() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var md = htmlToMarkdown(ed);
        if (md !== last) { last = md; onChange(md); }
      }, 150);
    }
    function tidy() { // keep pasted or typed content inside the allowed set
      ed.innerHTML = window.PressRender.bodyHTML(htmlToMarkdown(ed));
    }

    ed.addEventListener("input", save);
    ed.addEventListener("blur", function () { tidy(); save(); });
    ed.addEventListener("paste", function (e) {
      var cd = e.clipboardData; if (!cd) return;
      e.preventDefault();
      var html = cd.getData("text/html"), text = cd.getData("text/plain");
      var md = html ? htmlToMarkdown(html) : plainToMarkdown(text);
      if (!md) return;
      var frag = window.PressRender.bodyHTML(md);
      // A single pasted paragraph goes inline at the cursor; several become their own paragraphs.
      if (/^<p>[\s\S]*<\/p>$/.test(frag) && frag.indexOf("<p>", 1) === -1) frag = frag.slice(3, -4);
      document.execCommand("insertHTML", false, frag);
      save();
    });

    function updateState() {
      ["bold", "italic"].forEach(function (c) {
        var b = bar.querySelector('[data-cmd="' + c + '"]');
        var on = false; try { on = document.queryCommandState(c); } catch (e) {}
        b.setAttribute("aria-pressed", on && ed.contains(document.getSelection().anchorNode) ? "true" : "false");
      });
    }
    document.addEventListener("selectionchange", updateState);

    bar.addEventListener("mousedown", function (e) { if (e.target.closest("button")) e.preventDefault(); });
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var cmd = b.getAttribute("data-cmd");
      ed.focus();
      if (cmd === "link") {
        var sel = document.getSelection();
        if (!sel.rangeCount || sel.isCollapsed) { linkInput.placeholder = "Select the words to link first"; linkRow.hidden = false; linkInput.value = ""; return; }
        saved = sel.getRangeAt(0).cloneRange();
        linkInput.placeholder = "Paste the web address, then press Enter";
        linkRow.hidden = false; linkInput.value = ""; linkInput.focus();
        return;
      }
      document.execCommand(cmd, false, null);
      save(); updateState();
    });

    function applyLink() {
      var url = linkInput.value.trim();
      linkRow.hidden = true;
      if (!url || !saved) return;
      if (!/^(https?:|mailto:)/i.test(url)) url = "https://" + url;
      ed.focus();
      var sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(saved);
      document.execCommand("createLink", false, url);
      saved = null; save();
    }
    linkInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); applyLink(); }
      if (e.key === "Escape") { linkRow.hidden = true; ed.focus(); }
    });
    linkRow.addEventListener("click", function (e) {
      var a = e.target.getAttribute("data-act");
      if (a === "apply") applyLink();
      if (a === "cancel") { linkRow.hidden = true; ed.focus(); }
    });

    return function cleanup() { document.removeEventListener("selectionchange", updateState); clearTimeout(timer); };
  }

  window.PressHTMLToMarkdown = htmlToMarkdown;
  window.PressTextControl = function () {
    return createClass({
      componentDidMount: function () {
        var self = this;
        this.cleanup = build(this.host, this.props.value, function (md) { self.props.onChange(md); });
      },
      componentWillUnmount: function () { if (this.cleanup) this.cleanup(); },
      shouldComponentUpdate: function () { return false; },
      render: function () {
        var self = this;
        return h("div", { id: this.props.forID, ref: function (el) { self.host = el; } });
      }
    });
  };
})();
