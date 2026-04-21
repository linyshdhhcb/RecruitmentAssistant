import { useEffect, useMemo, useRef, useState } from "react";
import navCollapseIcon from "./assets/KHCFDC_导航收起.png";
import navExpandIcon from "./assets/KHCFDC_导航展开.png";
import iconBack from "./assets/icon-back.svg";
import iconForward from "./assets/icon-forward.svg";
import iconRefresh from "./assets/icon-refresh.svg";
import iconZoomOut from "./assets/icon-zoom-out.svg";
import iconZoomIn from "./assets/icon-zoom-in.svg";
import iconExternal from "./assets/icon-external.svg";

const EMPTY_FORM = {
  name: "",
  url: "",
  category: "",
  notes: "",
  sort_index: "",
  is_enabled: true
};

const CATEGORY_OPTIONS = ["大厂", "中厂", "独角兽", "小厂"];

function App() {
  const [websites, setWebsites] = useState([]);
  const [activePage, setActivePage] = useState("viewer");
  const [navOpen, setNavOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState("");
  const [selectedOneId, setSelectedOneId] = useState(null);
  const [selectedTwoId, setSelectedTwoId] = useState(null);
  const [layout, setLayout] = useState("single");
  const [manageSearch, setManageSearch] = useState("");
  const [managePage, setManagePage] = useState(1);
  const [managePageSize] = useState(25);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const virtualListRef = useRef(null);
  const virtualLockRef = useRef(false);
  const scrollDebounceRef = useRef(null);

  const [navHover, setNavHover] = useState(false);
  const [navPos, setNavPos] = useState(() => {
    try {
      const raw = localStorage.getItem("navPos");
      if (raw) return JSON.parse(raw);
    } catch {}
    return { x: 10, y: 10 };
  });
  const draggingNavRef = useRef(false);
  const navDragOffsetRef = useRef({ x: 0, y: 0 });

  const enabledSites = useMemo(() => websites.filter((site) => site.is_enabled === 1), [websites]);
  const navSites = useMemo(() => {
    const key = siteSearch.trim().toLowerCase();
    if (!key) return enabledSites;
    return enabledSites.filter(
      (site) => site.name.toLowerCase().includes(key) || site.url.toLowerCase().includes(key)
    );
  }, [enabledSites, siteSearch]);
  const groupedNavSites = useMemo(() => {
    const map = new Map();
    navSites.forEach((site) => {
      const group = (site.category || "").trim() || "未分组";
      if (!map.has(group)) {
        map.set(group, []);
      }
      map.get(group).push(site);
    });
    return Array.from(map.entries());
  }, [navSites]);

  const manageSites = useMemo(() => {
    const key = manageSearch.trim().toLowerCase();
    if (!key) return websites;
    return websites.filter(
      (site) =>
        site.name.toLowerCase().includes(key) ||
        site.url.toLowerCase().includes(key) ||
        (site.notes || "").toLowerCase().includes(key)
    );
  }, [websites, manageSearch]);
  const manageTotalPages = Math.max(1, Math.ceil(manageSites.length / managePageSize));
  const pagedManageSites = useMemo(() => {
    const safePage = Math.max(1, Math.min(managePage, manageTotalPages));
    const start = (safePage - 1) * managePageSize;
    return manageSites.slice(start, start + managePageSize);
  }, [managePage, managePageSize, manageSites, manageTotalPages]);

  const selectedOne = enabledSites.find((site) => site.id === selectedOneId) || enabledSites[0];
  const selectedTwo =
    enabledSites.find((site) => site.id === selectedTwoId && site.id !== selectedOne?.id) ||
    enabledSites.find((site) => site.id !== selectedOne?.id);

  const selectedOneIndex = useMemo(
    () => enabledSites.findIndex((site) => site.id === selectedOne?.id),
    [enabledSites, selectedOne?.id]
  );
  const virtualSites = useMemo(() => {
    if (!enabledSites.length) return [];
    const current = selectedOneIndex >= 0 ? selectedOneIndex : 0;
    const ids = [];
    for (let offset = -2; offset <= 2; offset += 1) {
      const idx = current + offset;
      if (idx >= 0 && idx < enabledSites.length) {
        ids.push(enabledSites[idx]);
      }
    }
    return ids;
  }, [enabledSites, selectedOneIndex]);
  const virtualSelectedIndex = useMemo(() => {
    if (!selectedOne?.id) return 0;
    const idx = virtualSites.findIndex((s) => s.id === selectedOne.id);
    return idx >= 0 ? idx : 0;
  }, [virtualSites, selectedOne?.id]);

  async function reload(search = "") {
    const list = await window.api.listWebsites(search);
    setWebsites(list);
    if (!selectedOneId && list.length) {
      setSelectedOneId(list[0].id);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    setManagePage(1);
  }, [manageSearch]);

  useEffect(() => {
    if (managePage > manageTotalPages) {
      setManagePage(manageTotalPages);
    }
  }, [managePage, manageTotalPages]);

  useEffect(() => {
    if (selectedOne?.id) {
      window.api.touchVisited(selectedOne.id);
    }
  }, [selectedOne?.id]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function submitForm(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.url.trim()) {
      alert("网站名称和URL不能为空");
      return;
    }
    if (editingId) {
      await window.api.updateWebsite({ ...form, id: editingId });
    } else {
      await window.api.createWebsite(form);
    }
    await reload();
    resetForm();
  }

  async function removeSite(id) {
    if (!window.confirm("确认删除该网站吗？")) return;
    await window.api.deleteWebsite(id);
    await reload();
  }

  async function reorderByDrag(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceIndex = websites.findIndex((item) => item.id === sourceId);
    const targetIndex = websites.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...websites];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    await window.api.reorderWebsites(next.map((item) => item.id));
    await reload();
  }

  async function exportConfig() {
    const result = await window.api.exportWebsites();
    if (!result.canceled) {
      alert("导出成功");
    }
  }

  async function importConfig() {
    const result = await window.api.importWebsites();
    if (!result.canceled) {
      await reload();
      alert(`导入成功，共 ${result.total} 条`);
    }
  }

  function startEdit(site) {
    setForm({
      name: site.name,
      url: site.url,
      category: site.category || "",
      notes: site.notes || "",
      sort_index: site.sort_index,
      is_enabled: site.is_enabled === 1
    });
    setEditingId(site.id);
  }

  function gotoRelative(delta) {
    if (!enabledSites.length) return;
    const current = selectedOneIndex >= 0 ? selectedOneIndex : 0;
    const nextIndex = Math.max(0, Math.min(enabledSites.length - 1, current + delta));
    const next = enabledSites[nextIndex];
    if (next?.id) {
      setSelectedOneId(next.id);
    }
  }

  function recenterVirtualList() {
    const el = virtualListRef.current;
    if (!el) return;
    const itemHeight = el.clientHeight;
    if (!itemHeight) return;
    el.scrollTo({ top: virtualSelectedIndex * itemHeight, behavior: "auto" });
  }

  useEffect(() => {
    if (layout !== "single") return;
    if (!virtualSites.length) return;
    recenterVirtualList();
  }, [layout, selectedOne?.id, virtualSites.length, virtualSelectedIndex]);

  useEffect(() => {
    try {
      localStorage.setItem("navPos", JSON.stringify(navPos));
    } catch {}
  }, [navPos]);

  useEffect(() => {
    function onMove(event) {
      if (!draggingNavRef.current) return;
      setNavPos((old) => ({
        x: Math.max(6, event.clientX - navDragOffsetRef.current.x),
        y: Math.max(6, event.clientY - navDragOffsetRef.current.y)
      }));
    }
    function onUp() {
      draggingNavRef.current = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <h1>招聘网站聚合助手</h1>
        <div className="topbar-actions">
          <button className={activePage === "viewer" ? "active" : ""} onClick={() => setActivePage("viewer")}>
            官网浏览
          </button>
          <button className={activePage === "manage" ? "active" : ""} onClick={() => setActivePage("manage")}>
            网站管理
          </button>
        </div>
      </header>

      {activePage === "viewer" ? (
        <div className="viewer-layout">
          <aside
            className={`sidebar floating ${navOpen ? "open" : "closed"} ${!navHover && !navOpen ? "inactive" : ""}`}
            style={{ left: navPos.x, top: navPos.y }}
            onMouseEnter={() => setNavHover(true)}
            onMouseLeave={() => setNavHover(false)}
          >
            <div
              className="sidebar-header"
              onMouseDown={(event) => {
                if (event.target?.closest?.("button")) return;
                draggingNavRef.current = true;
                navDragOffsetRef.current = { x: event.clientX - navPos.x, y: event.clientY - navPos.y };
              }}
            >
              <button className="icon-button" onClick={() => setNavOpen((v) => !v)} title={navOpen ? "收起导航" : "展开导航"}>
                <img alt={navOpen ? "收起" : "展开"} src={navOpen ? navCollapseIcon : navExpandIcon} />
              </button>
            </div>
            {navOpen && (
              <>
                <input
                  value={siteSearch}
                  onChange={(event) => setSiteSearch(event.target.value)}
                  placeholder="搜索招聘网站"
                />
                <div className="site-list">
                  {groupedNavSites.map(([groupName, list]) => (
                    <div key={groupName} className="site-group">
                      <div className="group-title">{groupName}</div>
                      {list.map((site) => (
                        <button
                          key={site.id}
                          className={site.id === selectedOne?.id ? "site-item active" : "site-item"}
                          onClick={() => setSelectedOneId(site.id)}
                        >
                          <span>{site.name}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>

          <main className="viewer-main">
            <div className="viewer-controls">
              <button className={layout === "single" ? "active" : ""} onClick={() => setLayout("single")}>
                单列
              </button>
              <button className={layout === "double" ? "active" : ""} onClick={() => setLayout("double")}>
                双列
              </button>
              <div className="viewer-nav-buttons">
                <button onClick={() => gotoRelative(-1)}>上一站</button>
                <button onClick={() => gotoRelative(1)}>下一站</button>
              </div>
              {layout === "double" && (
                <select value={selectedTwo?.id || ""} onChange={(event) => setSelectedTwoId(Number(event.target.value))}>
                  {enabledSites
                    .filter((site) => site.id !== selectedOne?.id)
                    .map((site) => (
                      <option key={site.id} value={site.id}>
                        右侧: {site.name}
                      </option>
                    ))}
                </select>
              )}
            </div>

            {layout === "single" ? (
              <div
                ref={virtualListRef}
                className="webview-virtual"
                onScroll={() => {
                  const el = virtualListRef.current;
                  if (!el) return;
                  if (virtualLockRef.current) return;
                  if (scrollDebounceRef.current) {
                    clearTimeout(scrollDebounceRef.current);
                  }
                  scrollDebounceRef.current = setTimeout(() => {
                    const itemHeight = el.clientHeight;
                    if (!itemHeight) return;
                    const rawIndex = el.scrollTop / itemHeight;
                    const nearest = Math.round(rawIndex);
                    if (nearest === virtualSelectedIndex) return;

                    virtualLockRef.current = true;
                    if (nearest < virtualSelectedIndex) gotoRelative(-1);
                    else gotoRelative(1);
                    requestAnimationFrame(() => {
                      recenterVirtualList();
                      virtualLockRef.current = false;
                    });
                  }, 170);
                }}
              >
                {selectedOne ? (
                  virtualSites.map((site) =>
                    site.id === selectedOne?.id ? (
                      <WebPane key={site.id} site={site} />
                    ) : (
                      <WebPanePreview key={site.id} site={site} onActivate={() => setSelectedOneId(site.id)} />
                    )
                  )
                ) : (
                  <div className="empty">暂无可展示网站，请先在管理页新增或启用网站。</div>
                )}
              </div>
            ) : (
              <div className={`webview-grid ${layout}`}>
                {selectedOne ? (
                  <WebPane site={selectedOne} />
                ) : (
                  <div className="empty">暂无可展示网站，请先在管理页新增或启用网站。</div>
                )}
                {layout === "double" && selectedTwo ? <WebPane site={selectedTwo} /> : null}
              </div>
            )}
          </main>
        </div>
      ) : (
        <div className="manage-page">
          <section className="form-card">
            <h2>{editingId ? "编辑网站" : "新增网站"}</h2>
            <form onSubmit={submitForm}>
              <div className="form-row">
                <label>顺序（从 1 开始）</label>
                <input
                  type="number"
                  min="1"
                  placeholder="例如：1"
                  value={form.sort_index === "" ? "" : Number(form.sort_index) + 1}
                  onChange={(event) => {
                    const v = event.target.value;
                    setForm((old) => ({ ...old, sort_index: v === "" ? "" : Math.max(0, Number(v) - 1) }));
                  }}
                />
              </div>
              <input
                placeholder="网站名称"
                value={form.name}
                onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))}
              />
              <input
                placeholder="网站URL"
                value={form.url}
                onChange={(event) => setForm((old) => ({ ...old, url: event.target.value }))}
              />
              <div className="form-row">
                <label>分类</label>
                <select
                  value={form.category}
                  onChange={(event) => setForm((old) => ({ ...old, category: event.target.value }))}
                >
                  <option value="">未分组</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <input
                placeholder="备注（可选）"
                value={form.notes}
                onChange={(event) => setForm((old) => ({ ...old, notes: event.target.value }))}
              />
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.is_enabled}
                  onChange={(event) => setForm((old) => ({ ...old, is_enabled: event.target.checked }))}
                />
                启用
              </label>
              <div className="form-actions">
                <button type="submit">{editingId ? "保存更新" : "添加网站"}</button>
                {editingId ? (
                  <button type="button" onClick={resetForm}>
                    取消编辑
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="table-card">
            <div className="table-toolbar">
              <h2>网站列表</h2>
              <div className="table-toolbar-actions">
                <input
                  placeholder="按名称、URL、备注搜索"
                  value={manageSearch}
                  onChange={(event) => setManageSearch(event.target.value)}
                />
                <button onClick={importConfig}>导入JSON</button>
                <button onClick={exportConfig}>导出JSON</button>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>顺序</th>
                  <th>名称</th>
                  <th>URL</th>
                  <th>状态</th>
                  <th>最后访问</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedManageSites.map((site) => (
                  <tr
                    key={site.id}
                    draggable={!manageSearch.trim()}
                    onDragStart={() => setDraggingId(site.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async () => {
                      await reorderByDrag(draggingId, site.id);
                      setDraggingId(null);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <td>{site.sort_index + 1}</td>
                    <td>{site.name}</td>
                    <td className="url-cell">{site.url}</td>
                    <td>{site.is_enabled ? "启用" : "停用"}</td>
                    <td>{site.last_visited_at ? new Date(site.last_visited_at).toLocaleString() : "-"}</td>
                    <td>
                      <div className="op-buttons">
                        <button onClick={() => startEdit(site)}>编辑</button>
                        <button className="danger" onClick={() => removeSite(site.id)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pager">
              <span>
                共 {manageSites.length} 条 / 第 {managePage} 页 / 共 {manageTotalPages} 页
              </span>
              <div className="pager-actions">
                <button disabled={managePage <= 1} onClick={() => setManagePage((p) => Math.max(1, p - 1))}>
                  上一页
                </button>
                <button
                  disabled={managePage >= manageTotalPages}
                  onClick={() => setManagePage((p) => Math.min(manageTotalPages, p + 1))}
                >
                  下一页
                </button>
              </div>
            </div>
            {manageSearch.trim() ? <div className="hint">搜索过滤中，已禁用拖拽排序。清空搜索后可拖拽行调整顺序。</div> : null}
          </section>
        </div>
      )}
    </div>
  );
}

function WebPane({ site }) {
  const webviewRef = useRef(null);
  const [currentUrl, setCurrentUrl] = useState(site.url);
  const [inputUrl, setInputUrl] = useState(site.url);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);

  function syncNav() {
    const wv = webviewRef.current;
    if (!wv) return;
    try {
      setCurrentUrl(wv.getURL());
      setInputUrl(wv.getURL());
      setCanBack(wv.canGoBack());
      setCanForward(wv.canGoForward());
    } catch {}
  }

  useEffect(() => {
    setCurrentUrl(site.url);
    setInputUrl(site.url);
  }, [site.id, site.url]);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onStart = () => setLoading(true);
    const onStop = () => setLoading(false);
    const onNav = () => syncNav();

    wv.addEventListener("did-start-loading", onStart);
    wv.addEventListener("did-stop-loading", onStop);
    wv.addEventListener("did-navigate", onNav);
    wv.addEventListener("did-navigate-in-page", onNav);
    wv.addEventListener("dom-ready", () => {
      try {
        wv.setZoomFactor(zoom);
      } catch {}
      syncNav();
    });

    return () => {
      wv.removeEventListener("did-start-loading", onStart);
      wv.removeEventListener("did-stop-loading", onStop);
      wv.removeEventListener("did-navigate", onNav);
      wv.removeEventListener("did-navigate-in-page", onNav);
    };
  }, [zoom]);

  function normalizeUrl(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  function go() {
    const wv = webviewRef.current;
    if (!wv) return;
    const next = normalizeUrl(inputUrl);
    if (!next) return;
    try {
      wv.loadURL(next);
    } catch {}
  }

  function adjustZoom(delta) {
    const wv = webviewRef.current;
    if (!wv) return;
    const next = Math.max(0.5, Math.min(2.0, Math.round((zoom + delta) * 10) / 10));
    setZoom(next);
    try {
      wv.setZoomFactor(next);
    } catch {}
  }

  return (
    <div className="web-pane">
      <div className="pane-title">
        <div className="pane-title-left">
          <span className={`status-dot ${loading ? "loading" : "idle"}`} />
          <span className="pane-name">{site.name}</span>
          <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="pane-actions">
          <button className="icon-button" disabled={!canBack} onClick={() => webviewRef.current?.goBack()} title="后退">
            <img alt="后退" src={iconBack} />
          </button>
          <button
            className="icon-button"
            disabled={!canForward}
            onClick={() => webviewRef.current?.goForward()}
            title="前进"
          >
            <img alt="前进" src={iconForward} />
          </button>
          <button className="icon-button" onClick={() => webviewRef.current?.reload()} title="刷新">
            <img alt="刷新" src={iconRefresh} />
          </button>
          <button className="icon-button" onClick={() => adjustZoom(-0.1)} title="缩小">
            <img alt="缩小" src={iconZoomOut} />
          </button>
          <button className="icon-button" onClick={() => adjustZoom(0.1)} title="放大">
            <img alt="放大" src={iconZoomIn} />
          </button>
          <button
            className="icon-button"
            onClick={() => window.api.openExternal(currentUrl || site.url)}
            title="浏览器打开"
          >
            <img alt="浏览器打开" src={iconExternal} />
          </button>
        </div>
      </div>

      <div className="address-row">
        <input
          className="address-input"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go();
          }}
        />
        <button className="primary" onClick={go}>
          访问
        </button>
      </div>

      <webview ref={webviewRef} src={site.url} partition={`persist:site-${site.id}`} allowpopups="true" />
    </div>
  );
}

function WebPanePreview({ site, onActivate }) {
  return (
    <div className="web-pane preview">
      <div className="pane-title">
        <div className="pane-title-left">
          <span className="status-dot idle" />
          <span className="pane-name">{site.name}</span>
        </div>
      </div>
      <div className="preview-body">
        <div className="preview-url">{site.url}</div>
        <button className="primary" onClick={onActivate}>
          切换到此网站
        </button>
      </div>
    </div>
  );
}

export default App;
