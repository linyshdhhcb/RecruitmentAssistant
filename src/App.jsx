import { useEffect, useMemo, useState } from "react";

const EMPTY_FORM = {
  name: "",
  url: "",
  category: "",
  notes: "",
  is_enabled: true
};

function App() {
  const [websites, setWebsites] = useState([]);
  const [activePage, setActivePage] = useState("viewer");
  const [navOpen, setNavOpen] = useState(true);
  const [siteSearch, setSiteSearch] = useState("");
  const [selectedOneId, setSelectedOneId] = useState(null);
  const [selectedTwoId, setSelectedTwoId] = useState(null);
  const [layout, setLayout] = useState("single");
  const [manageSearch, setManageSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

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

  const selectedOne = enabledSites.find((site) => site.id === selectedOneId) || enabledSites[0];
  const selectedTwo =
    enabledSites.find((site) => site.id === selectedTwoId && site.id !== selectedOne?.id) ||
    enabledSites.find((site) => site.id !== selectedOne?.id);

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
      is_enabled: site.is_enabled === 1
    });
    setEditingId(site.id);
  }

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
          <aside className={`sidebar ${navOpen ? "open" : "closed"}`}>
            <div className="sidebar-header">
              <button onClick={() => setNavOpen((v) => !v)}>{navOpen ? "收起" : "展开"}</button>
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

            <div className={`webview-grid ${layout}`}>
              {selectedOne ? (
                <WebPane site={selectedOne} />
              ) : (
                <div className="empty">暂无可展示网站，请先在管理页新增或启用网站。</div>
              )}
              {layout === "double" && selectedTwo ? <WebPane site={selectedTwo} /> : null}
            </div>
          </main>
        </div>
      ) : (
        <div className="manage-page">
          <section className="form-card">
            <h2>{editingId ? "编辑网站" : "新增网站"}</h2>
            <form onSubmit={submitForm}>
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
              <input
                placeholder="分类（可选）"
                value={form.category}
                onChange={(event) => setForm((old) => ({ ...old, category: event.target.value }))}
              />
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
                {manageSites.map((site) => (
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
            {manageSearch.trim() ? <div className="hint">搜索过滤中，已禁用拖拽排序。清空搜索后可拖拽行调整顺序。</div> : null}
          </section>
        </div>
      )}
    </div>
  );
}

function WebPane({ site }) {
  return (
    <div className="web-pane">
      <div className="pane-title">{site.name}</div>
      <webview src={site.url} partition={`persist:site-${site.id}`} allowpopups="true" />
    </div>
  );
}

export default App;
