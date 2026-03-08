import React, { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import tanatexLogo from "../../../tanatex_logo2.png";

const API_BASE = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL || "");

const STATUSES = [
  "submitted",
  "approved",
  "shipped",
  "rejected"
];

const STAFF_ROLES = ["PRODUCTION_ENGINEER", "PURCHASING", "LOGISTICS"];
let csrfTokenCache = null;

async function getCsrfToken() {
  if (csrfTokenCache) return csrfTokenCache;
  const res = await fetch(`${API_BASE}/api/auth/csrf-token`, {
    credentials: "include"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.csrfToken) throw new Error(data.error || "Unable to get CSRF token");
  csrfTokenCache = data.csrfToken;
  return csrfTokenCache;
}

function isCsrfInvalidResponse(res, data) {
  return res.status === 403 && typeof data?.error === "string" && /csrf/i.test(data.error);
}

async function doFetch(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers["x-csrf-token"] = await getCsrfToken();
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function api(path, options = {}) {
  let { res, data } = await doFetch(path, options);
  if (isCsrfInvalidResponse(res, data)) {
    csrfTokenCache = null;
    ({ res, data } = await doFetch(path, options));
  }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function Shell({
  title,
  children,
  pageClassName = "",
  showNav = true,
  onLogout = null,
  onHome = null,
  headerVariant = "default",
  headerLogo = null
}) {
  const isAdminHeader = headerVariant === "admin";
  return (
    <div className={`page ${pageClassName}`.trim()}>
      <div className="layout-side layout-side-left" aria-hidden="true" />
      <div className="page-center">
        <header className={isAdminHeader ? "admin-topbar" : "topbar"}>
          {isAdminHeader ? (
            <>
              {headerLogo ? <img className="admin-header-logo" src={headerLogo} alt="Tanatex Chemicals" /> : <h1>GSR</h1>}
              <div className="admin-top-actions">
                {onHome ? <button type="button" className="admin-logout-btn" onClick={onHome}>Home</button> : null}
                {onLogout ? <button type="button" className="admin-logout-btn" onClick={onLogout}>Logout</button> : null}
              </div>
            </>
          ) : (
            <>
              <h1>GSR</h1>
              {showNav ? (
                <nav>
                  <Link to="/">Home</Link>
                  <Link to="/requestor">Requestor</Link>
                  <Link to="/manager">Manager</Link>
                  <Link to="/staff">Staff</Link>
                  <Link to="/logistics">Logistics</Link>
                  <Link to="/admin">Admin</Link>
                  <Link to="/create">Create</Link>
                  <Link to="/login">Login</Link>
                </nav>
              ) : null}
              {!showNav && onLogout ? (
                <button type="button" className="topbar-logout-btn" onClick={onLogout}>Logout</button>
              ) : null}
            </>
          )}
        </header>
        {isAdminHeader ? <div className="admin-separator" /> : null}
        <main>
          <h2>{title}</h2>
          {children}
        </main>
      </div>
      <div className="layout-side layout-side-right" aria-hidden="true" />
    </div>
  );
}

function Home() {
  return (
    <Shell title="Goods Sampling Request">
      <p>Use role pages to run workflow actions.</p>
    </Shell>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("requestor@gsr.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [status, setStatus] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      const me = await api("/api/auth/me");
      if (me?.user?.role === "ADMIN") {
        navigate("/admin");
        return;
      }
      if (me?.user?.role === "REQUESTOR") {
        navigate("/requestor");
        return;
      }
      if (me?.user?.role === "SALES_MANAGER") {
        navigate("/manager");
        return;
      }
      if (me?.user?.role === "STAFF" && me?.user?.staffType === "LOGISTICS") {
        navigate("/logistics");
        return;
      }
      if (me?.user?.role === "STAFF") {
        navigate("/staff");
        return;
      }
      setStatus("Logged in successfully");
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <div className="login-screen">
      <div className="layout-side layout-side-left" aria-hidden="true" />
      <section className="login-center-panel">
        <div className="login-center-content">
          <img className="login-logo" src={tanatexLogo} alt="Tanatex Chemicals" />
          <h1 className="login-title">SAMPLING GOODS<br />REQUEST</h1>
          <form className="login-form-figma" onSubmit={onSubmit}>
            <h2>Sign in</h2>
            <div className="login-signin-underline" />
            <label className="login-field-row">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="login-field-row">
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <div className="login-actions">
              <button type="submit">Login</button>
              <Link to="/forgot-password" className="login-forgot-link">Forgot password?</Link>
              {status ? <small>{status}</small> : null}
            </div>
          </form>
        </div>
      </section>
      <div className="layout-side layout-side-right" aria-hidden="true" />
    </div>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setStatus("If your email exists, a reset link has been sent.");
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <Shell title="Forgot Password">
      <form className="card grid" onSubmit={onSubmit}>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <button type="submit">Send reset link</button>
        {status ? <small>{status}</small> : null}
      </form>
    </Shell>
  );
}

function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword })
      });
      setStatus("Password reset successful. Please login.");
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <Shell title="Reset Password">
      <form className="card grid" onSubmit={onSubmit}>
        <label>Token<input value={token} onChange={(e) => setToken(e.target.value)} /></label>
        <label>New Password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
        <button type="submit">Reset password</button>
        {status ? <small>{status}</small> : null}
      </form>
    </Shell>
  );
}

function RequestorPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchNo, setSearchNo] = useState("");

  async function loadItems() {
    const q = new URLSearchParams();
    if (statusFilter) q.set("status", statusFilter);
    if (searchNo) q.set("searchNo", searchNo);
    const path = `/api/work-requests${q.toString() ? `?${q.toString()}` : ""}`;
    const d = await api(path);
    setItems(d.items || []);
  }

  useEffect(() => {
    loadItems().catch((e) => setError(e.message));
  }, [statusFilter, searchNo]);

  async function onRequestorLogout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      navigate("/login");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell
      title="Requestor Dashboard"
      showNav={false}
      onHome={() => navigate("/requestor")}
      onLogout={onRequestorLogout}
      headerVariant="admin"
      headerLogo={tanatexLogo}
    >
      <div className="card grid">
        <button type="button" onClick={() => navigate("/create")}>Create New Request</button>
      </div>
      <div className="card grid">
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Search Work Request No
          <input value={searchNo} onChange={(e) => setSearchNo(e.target.value)} placeholder="e.g. GSR-20260221" />
        </label>
      </div>
      <div className="card">{error || `Total requests: ${items.length}`}</div>
      {items.map((item) => (
        <div className="card" key={item.id}>
          <strong>{item.workRequestNo}</strong>
          <div>Status: {item.status}</div>
          <div>Product: {item.productNode?.name || "-"}</div>
          <div>Requestor: {item.requestor?.email || "-"}</div>
          <Link to={`/work-requests/${item.id}`}>Open details</Link>
        </div>
      ))}
    </Shell>
  );
}

function ManagerPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api(`/api/work-requests?status=${status}`)
      .then((d) => setItems(d.items || []))
      .catch((e) => setMsg(e.message));
  }, [status]);

  async function onManagerLogout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      navigate("/login");
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <Shell
      title="Sales Manager Dashboard"
      showNav={false}
      onLogout={onManagerLogout}
      headerVariant="admin"
      headerLogo={tanatexLogo}
    >
      <div className="card grid">
        <label>
          Queue status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {msg ? <small>{msg}</small> : null}
      </div>
      {items.map((item) => (
        <div className="card" key={item.id}>
          <strong>{item.workRequestNo}</strong>
          <div>Status: {item.status}</div>
          <Link to={`/work-requests/${item.id}`}>Open details and actions</Link>
        </div>
      ))}
    </Shell>
  );
}

function StaffPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [detailsByRequestId, setDetailsByRequestId] = useState({});
  const [ackCommentByTaskId, setAckCommentByTaskId] = useState({});
  const [finishCommentByTaskId, setFinishCommentByTaskId] = useState({});
  const [handoffCommentByTaskId, setHandoffCommentByTaskId] = useState({});
  const [handoffByTaskId, setHandoffByTaskId] = useState({});
  const [msg, setMsg] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState("");

  async function loadTasks() {
    const q = new URLSearchParams();
    if (stateFilter) q.set("state", stateFilter);
    if (requestStatusFilter) q.set("requestStatus", requestStatusFilter);
    const d = await api(`/api/tasks/my${q.toString() ? `?${q.toString()}` : ""}`);
    const list = d.items || [];
    setItems(list);
    const requestIds = Array.from(new Set(list.map((t) => t.workRequestId)));
    const details = await Promise.all(
      requestIds.map(async (id) => {
        const wr = await api(`/api/work-requests/${id}`);
        return [id, wr];
      })
    );
    setDetailsByRequestId(Object.fromEntries(details));
  }

  useEffect(() => {
    loadTasks().catch((e) => setMsg(e.message));
  }, [stateFilter, requestStatusFilter]);

  function toggleHandoff(taskId, userId) {
    setHandoffByTaskId((prev) => {
      const current = prev[taskId] || [];
      const next = current.includes(userId) ? current.filter((x) => x !== userId) : [...current, userId];
      return { ...prev, [taskId]: next };
    });
  }

  async function onAcknowledge(taskId) {
    try {
      await api(`/api/tasks/${taskId}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({ comment: ackCommentByTaskId[taskId] || "" })
      });
      setMsg("Task acknowledged");
      await loadTasks();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onFinish(taskId) {
    try {
      await api(`/api/tasks/${taskId}/finish`, {
        method: "POST",
        body: JSON.stringify({
          comment: finishCommentByTaskId[taskId] || "",
          handoff_comment: handoffCommentByTaskId[taskId] || "",
          handoff_to_user_ids: handoffByTaskId[taskId] || []
        })
      });
      setMsg("Task finished");
      await loadTasks();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onStaffLogout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      navigate("/login");
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <Shell
      title="My Tasks"
      showNav={false}
      onLogout={onStaffLogout}
      headerVariant="admin"
      headerLogo={tanatexLogo}
    >
      <div className="card grid">
        <label>
          Task state
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">All</option>
            <option value="active">active</option>
            <option value="acknowledged">acknowledged</option>
            <option value="finished">finished</option>
          </select>
        </label>
        <label>
          Request status
          <select value={requestStatusFilter} onChange={(e) => setRequestStatusFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="card">{msg || `My tasks: ${items.length}`}</div>
      {items.map((task) => {
        const detail = detailsByRequestId[task.workRequestId];
        const candidates = (detail?.assignments || []).filter((a) => a.userId !== task.assigneeUserId);
        return (
          <div className="card grid" key={task.id}>
            <strong>{task.workRequest?.workRequestNo || task.workRequestId}</strong>
            <div>Request status: {task.workRequest?.status}</div>
            <div>Task role: {task.taskRole}</div>
            <div>Task state: {task.state}</div>
            <Link to={`/work-requests/${task.workRequestId}`}>Open details</Link>

            <label>
              Acknowledge comment
              <input
                value={ackCommentByTaskId[task.id] || ""}
                onChange={(e) => setAckCommentByTaskId((prev) => ({ ...prev, [task.id]: e.target.value }))}
              />
            </label>
            <button type="button" onClick={() => onAcknowledge(task.id)}>Acknowledge</button>

            <label>
              Finish comment
              <input
                value={finishCommentByTaskId[task.id] || ""}
                onChange={(e) => setFinishCommentByTaskId((prev) => ({ ...prev, [task.id]: e.target.value }))}
              />
            </label>
            <label>
              Handoff note
              <input
                value={handoffCommentByTaskId[task.id] || ""}
                onChange={(e) => setHandoffCommentByTaskId((prev) => ({ ...prev, [task.id]: e.target.value }))}
              />
            </label>
            {candidates.length > 0 ? (
              <div>
                <strong>Handoff to assigned staff</strong>
                {candidates.map((a) => (
                  <label key={a.userId}>
                    <input
                      type="checkbox"
                      checked={(handoffByTaskId[task.id] || []).includes(a.userId)}
                      onChange={() => toggleHandoff(task.id, a.userId)}
                    />
                    {a.user?.displayName || a.user?.email} ({a.assignedRole})
                  </label>
                ))}
              </div>
            ) : null}
            <button type="button" onClick={() => onFinish(task.id)}>Finish Task</button>
          </div>
        );
      })}
    </Shell>
  );
}

function LogisticsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState("");
  const [requestId, setRequestId] = useState("");
  const [url, setUrl] = useState("");
  const [shipComment, setShipComment] = useState("");
  const [shipStatus, setShipStatus] = useState("");

  async function loadTasks() {
    const q = new URLSearchParams();
    if (stateFilter) q.set("state", stateFilter);
    if (requestStatusFilter) q.set("requestStatus", requestStatusFilter);
    const d = await api(`/api/tasks/my${q.toString() ? `?${q.toString()}` : ""}`);
    setItems(d.items || []);
  }

  useEffect(() => {
    loadTasks().catch((e) => setMsg(e.message));
  }, [stateFilter, requestStatusFilter]);

  async function onShip(e) {
    e.preventDefault();
    try {
      await api(`/api/manager/work-requests/${requestId}/ship`, {
        method: "POST",
        body: JSON.stringify({ dhlTrackingUrl: url, comment: shipComment })
      });
      setShipStatus("Marked shipped");
      setShipComment("");
      await loadTasks();
    } catch (err) {
      setShipStatus(err.message);
    }
  }

  async function onLogisticsLogout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      navigate("/login");
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <Shell
      title="Shipping Update"
      showNav={false}
      onLogout={onLogisticsLogout}
      headerVariant="admin"
      headerLogo={tanatexLogo}
    >
      <div className="card grid">
        <label>
          Task state
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">All</option>
            <option value="active">active</option>
            <option value="acknowledged">acknowledged</option>
            <option value="finished">finished</option>
          </select>
        </label>
        <label>
          Request status
          <select value={requestStatusFilter} onChange={(e) => setRequestStatusFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="card">{msg || `My tasks: ${items.length}`}</div>
      {items.map((task) => (
        <div className="card grid" key={task.id}>
          <strong>{task.workRequest?.workRequestNo || task.workRequestId}</strong>
          <div>Request status: {task.workRequest?.status}</div>
          <div>Task role: {task.taskRole}</div>
          <div>Task state: {task.state}</div>
          {(task.handoffNotes || []).length > 0 ? (
            <div>
              <strong>Handoff notes:</strong>
              {task.handoffNotes.map((h) => (
                <div key={h.id}>
                  {h.note || "-"} ({h.fromUser?.displayName || h.fromUser?.email || "Unknown"} at {new Date(h.createdAt).toLocaleString()})
                </div>
              ))}
            </div>
          ) : null}
          <Link to={`/work-requests/${task.workRequestId}`}>Open details</Link>
        </div>
      ))}
      <form className="card grid" onSubmit={onShip}>
        <label>Work Request ID / No<input value={requestId} onChange={(e) => setRequestId(e.target.value)} /></label>
        <label>DHL Tracking URL<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <label>Comment<input value={shipComment} onChange={(e) => setShipComment(e.target.value)} /></label>
        <button type="submit">Mark Shipped</button>
        {shipStatus ? <small>{shipStatus}</small> : null}
      </form>
    </Shell>
  );
}

function CreateRequestPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [form, setForm] = useState({
    productNodeId: "",
    purpose: "Customer sampling",
    volumeKg: 10.5,
    unitCount: 3,
    receivingAddress: "Bangkok facility",
    receivingPersonFirstname: "John",
    receivingPersonLastname: "Doe",
    receivingPersonEmail: "john@example.com",
    receivingPersonPhone: "123456789",
    targetReceivingBy: new Date().toISOString().slice(0, 10)
  });

  const categories = useMemo(
    () => catalog.filter((c) => c.nodeType === "CATEGORY" && c.isActive),
    [catalog]
  );
  const subcategories = useMemo(
    () => catalog.filter((c) => c.nodeType === "SUBCATEGORY" && c.isActive && c.parentId === selectedCategoryId),
    [catalog, selectedCategoryId]
  );
  const products = useMemo(() => {
    if (!selectedCategoryId) return [];
    const parentId = selectedSubcategoryId || selectedCategoryId;
    return catalog.filter((c) => c.nodeType === "PRODUCT" && c.isActive && c.parentId === parentId);
  }, [catalog, selectedCategoryId, selectedSubcategoryId]);

  useEffect(() => {
    api("/api/catalog/tree")
      .then((d) => setCatalog(d.items || []))
      .catch((e) => setStatus(e.message));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await api("/api/work-requests", {
        method: "POST",
        body: JSON.stringify({ ...form, volumeKg: Number(form.volumeKg), unitCount: Number(form.unitCount) })
      });
      setStatus("Request submitted");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function onCreateRequestLogout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      navigate("/login");
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <Shell
      title="Create Request"
      showNav={false}
      onHome={() => navigate("/requestor")}
      onLogout={onCreateRequestLogout}
      headerVariant="admin"
      headerLogo={tanatexLogo}
    >
      <form className="card grid" onSubmit={onSubmit}>
        <label>
          Category
          <select
            value={selectedCategoryId}
            onChange={(e) => {
              setSelectedCategoryId(e.target.value);
              setSelectedSubcategoryId("");
              setForm({ ...form, productNodeId: "" });
            }}
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sub-category
          <select
            value={selectedSubcategoryId}
            onChange={(e) => {
              setSelectedSubcategoryId(e.target.value);
              setForm({ ...form, productNodeId: "" });
            }}
            disabled={!selectedCategoryId}
          >
            <option value="">{selectedCategoryId ? "Select sub-category (optional)" : "Select category first"}</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Product
          <select
            value={form.productNodeId}
            onChange={(e) => setForm({ ...form, productNodeId: e.target.value })}
            disabled={!selectedCategoryId}
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>Purpose<input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></label>
        <label>Volume (kg)<input type="number" step="0.001" value={form.volumeKg} onChange={(e) => setForm({ ...form, volumeKg: e.target.value })} /></label>
        <label>Unit<input type="number" value={form.unitCount} onChange={(e) => setForm({ ...form, unitCount: e.target.value })} /></label>
        <label>Address<input value={form.receivingAddress} onChange={(e) => setForm({ ...form, receivingAddress: e.target.value })} /></label>
        <label>First name<input value={form.receivingPersonFirstname} onChange={(e) => setForm({ ...form, receivingPersonFirstname: e.target.value })} /></label>
        <label>Last name<input value={form.receivingPersonLastname} onChange={(e) => setForm({ ...form, receivingPersonLastname: e.target.value })} /></label>
        <label>Email<input type="email" value={form.receivingPersonEmail} onChange={(e) => setForm({ ...form, receivingPersonEmail: e.target.value })} /></label>
        <label>Phone<input value={form.receivingPersonPhone} onChange={(e) => setForm({ ...form, receivingPersonPhone: e.target.value })} /></label>
        <label>Date<input type="date" value={form.targetReceivingBy} onChange={(e) => setForm({ ...form, targetReceivingBy: e.target.value })} /></label>
        <button type="submit">Submit</button>
        {status ? <small>{status}</small> : null}
      </form>
    </Shell>
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [msg, setMsg] = useState("");
  const [section, setSection] = useState("user-create");

  const [users, setUsers] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState({
    appBaseUrl: "",
    manufacturingGroupEmail: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpFrom: "",
    smtpTls: true,
    smtpPass: ""
  });
  const [testEmailTo, setTestEmailTo] = useState("");

  const roleAssignments = [
    { key: "REQUESTOR", label: "Requestor", role: "REQUESTOR", staffType: null },
    { key: "MANAGER", label: "Manager", role: "SALES_MANAGER", staffType: null },
    { key: "PRODUCTION", label: "Production", role: "STAFF", staffType: "PRODUCTION_ENGINEER" },
    { key: "LOGISTICS", label: "Logistics", role: "STAFF", staffType: "LOGISTICS" },
    { key: "PURCHASING", label: "Purchasing", role: "STAFF", staffType: "PURCHASING" },
    { key: "ADMIN", label: "Admin", role: "ADMIN", staffType: null }
  ];

  const [createUserForm, setCreateUserForm] = useState({
    email: "",
    displayName: "",
    assignment: "REQUESTOR",
    password: ""
  });
  const [editUserId, setEditUserId] = useState("");
  const [editUserForm, setEditUserForm] = useState({
    displayName: "",
    assignment: "REQUESTOR",
    isActive: true,
    newPassword: ""
  });

  const [addCategoryForm, setAddCategoryForm] = useState({
    name: "",
    nodeType: "CATEGORY",
    parentId: "",
    sortOrder: 0
  });
  const [addCategoryStatus, setAddCategoryStatus] = useState("");
  const [addProductForm, setAddProductForm] = useState({
    name: "",
    categoryId: "",
    subcategoryId: "",
    sortOrder: 0,
    isActive: true
  });
  const [addProductStatus, setAddProductStatus] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCategoryCategoryId, setEditCategoryCategoryId] = useState("");
  const [editCategorySubcategoryId, setEditCategorySubcategoryId] = useState("");
  const [editCategoryForm, setEditCategoryForm] = useState({
    name: "",
    parentId: "",
    sortOrder: 0,
    isActive: true
  });
  const [editProductId, setEditProductId] = useState("");
  const [editProductCategoryId, setEditProductCategoryId] = useState("");
  const [editProductSubcategoryId, setEditProductSubcategoryId] = useState("");
  const [editProductForm, setEditProductForm] = useState({
    name: "",
    parentId: "",
    sortOrder: 0,
    isActive: true
  });
  const [deleteUserId, setDeleteUserId] = useState("");
  const [deleteCategoryId, setDeleteCategoryId] = useState("");
  const [deleteSubcategoryId, setDeleteSubcategoryId] = useState("");
  const [deleteProductCategoryId, setDeleteProductCategoryId] = useState("");
  const [deleteProductSubcategoryId, setDeleteProductSubcategoryId] = useState("");
  const [deleteProductId, setDeleteProductId] = useState("");

  const [auditFilter, setAuditFilter] = useState({
    entityType: "",
    action: "",
    actorUserId: "",
    from: "",
    to: "",
    take: 100
  });

  async function loadUsers() {
    const d = await api("/api/admin/users?page=1&pageSize=500");
    setUsers(d.items || []);
  }

  async function loadNodes() {
    const d = await api("/api/admin/catalog/nodes?page=1&pageSize=500");
    setNodes(d.items || []);
  }

  async function loadSettings() {
    const d = await api("/api/admin/settings");
    setSettings((prev) => ({
      ...prev,
      appBaseUrl: d.appBaseUrl || "",
      manufacturingGroupEmail: d.manufacturingGroupEmail || "",
      smtpHost: d.smtpHost || "",
      smtpPort: d.smtpPort || 587,
      smtpUser: d.smtpUser || "",
      smtpFrom: d.smtpFrom || "",
      smtpTls: Boolean(d.smtpTls),
      smtpPass: ""
    }));
  }

  async function loadAuditLogs() {
    const q = new URLSearchParams();
    if (auditFilter.entityType) q.set("entityType", auditFilter.entityType);
    if (auditFilter.action) q.set("action", auditFilter.action);
    if (auditFilter.actorUserId) q.set("actorUserId", auditFilter.actorUserId);
    if (auditFilter.from) q.set("from", auditFilter.from);
    if (auditFilter.to) q.set("to", auditFilter.to);
    q.set("page", "1");
    q.set("pageSize", String(auditFilter.take || 100));
    const d = await api(`/api/admin/audit-logs?${q.toString()}`);
    setAuditLogs(d.items || []);
  }

  useEffect(() => {
    api("/api/auth/me")
      .then((d) => setMe(d.user))
      .catch(() => setMe(null));
    Promise.all([loadUsers(), loadNodes(), loadSettings(), loadAuditLogs()]).catch((e) => setMsg(e.message));
  }, []);

  const nodesById = useMemo(() => {
    const map = new Map();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const categoryNodes = useMemo(() => nodes.filter((n) => n.nodeType !== "PRODUCT"), [nodes]);
  const productNodes = useMemo(() => nodes.filter((n) => n.nodeType === "PRODUCT"), [nodes]);
  const activeCategoryNodes = useMemo(() => categoryNodes.filter((n) => n.isActive), [categoryNodes]);
  const activeCategoryLevelNodes = useMemo(
    () => activeCategoryNodes.filter((n) => n.nodeType === "CATEGORY"),
    [activeCategoryNodes]
  );
  const activeSubcategoryByDeleteCategory = useMemo(
    () => activeCategoryNodes.filter((n) => n.nodeType === "SUBCATEGORY" && n.parentId === deleteCategoryId),
    [activeCategoryNodes, deleteCategoryId]
  );
  const activeCategories = useMemo(
    () => nodes.filter((n) => n.nodeType === "CATEGORY" && n.isActive),
    [nodes]
  );
  const activeSubcategories = useMemo(
    () => nodes.filter((n) => n.nodeType === "SUBCATEGORY" && n.isActive),
    [nodes]
  );
  const categoryLevelNodes = useMemo(
    () => categoryNodes.filter((n) => n.nodeType === "CATEGORY"),
    [categoryNodes]
  );
  const editCategorySubcategoryOptions = useMemo(
    () => categoryNodes.filter((n) => n.nodeType === "SUBCATEGORY" && n.parentId === editCategoryCategoryId),
    [categoryNodes, editCategoryCategoryId]
  );
  const addProductSubcategoryOptions = useMemo(
    () => activeSubcategories.filter((n) => n.parentId === addProductForm.categoryId),
    [activeSubcategories, addProductForm.categoryId]
  );
  const editProductSubcategoryOptions = useMemo(
    () => categoryNodes.filter((n) => n.nodeType === "SUBCATEGORY" && n.parentId === editProductCategoryId),
    [categoryNodes, editProductCategoryId]
  );
  const editProductOptions = useMemo(() => {
    if (!editProductCategoryId) return [];
    const parentId = editProductSubcategoryId || editProductCategoryId;
    return productNodes.filter((p) => p.parentId === parentId);
  }, [productNodes, editProductCategoryId, editProductSubcategoryId]);
  const deleteProductOptions = useMemo(() => {
    if (!deleteProductCategoryId) return [];
    const parentId = deleteProductSubcategoryId || deleteProductCategoryId;
    return productNodes.filter((p) => p.parentId === parentId);
  }, [productNodes, deleteProductCategoryId, deleteProductSubcategoryId]);
  const activeParentCandidates = useMemo(
    () => nodes.filter((n) => n.nodeType !== "PRODUCT" && n.isActive),
    [nodes]
  );
  const addCategoryParentCandidates = useMemo(() => {
    if (addCategoryForm.nodeType === "SUBCATEGORY") {
      return activeParentCandidates.filter((n) => n.nodeType === "CATEGORY");
    }
    return activeParentCandidates;
  }, [addCategoryForm.nodeType, activeParentCandidates]);

  function normalizeCatalogName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function hasDuplicateCatalogNode({ nodeType, name, parentId, excludeId = null }) {
    const normalized = normalizeCatalogName(name);
    if (!normalized) return false;
    return nodes.some((n) => (
      n.id !== excludeId
      && n.nodeType === nodeType
      && (n.parentId || null) === (parentId || null)
      && normalizeCatalogName(n.name) === normalized
    ));
  }

  function labelFor(node) {
    const names = [node.name];
    let cursor = node;
    while (cursor.parentId && nodesById.has(cursor.parentId)) {
      cursor = nodesById.get(cursor.parentId);
      names.push(cursor.name);
    }
    return names.reverse().join(" > ");
  }

  function assignmentToPayload(key) {
    const match = roleAssignments.find((r) => r.key === key) || roleAssignments[0];
    return { role: match.role, staffType: match.staffType };
  }

  function userToAssignment(user) {
    if (user.role === "REQUESTOR") return "REQUESTOR";
    if (user.role === "SALES_MANAGER") return "MANAGER";
    if (user.role === "ADMIN") return "ADMIN";
    if (user.role === "STAFF" && user.staffType === "PRODUCTION_ENGINEER") return "PRODUCTION";
    if (user.role === "STAFF" && user.staffType === "LOGISTICS") return "LOGISTICS";
    if (user.role === "STAFF" && user.staffType === "PURCHASING") return "PURCHASING";
    return "REQUESTOR";
  }

  async function onCreateUser(e) {
    e.preventDefault();
    try {
      const createdName = createUserForm.displayName.trim() || createUserForm.email.trim();
      const assignment = assignmentToPayload(createUserForm.assignment);
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: createUserForm.email,
          displayName: createUserForm.displayName,
          role: assignment.role,
          staffType: assignment.staffType,
          password: createUserForm.password
        })
      });
      setMsg("User created");
      window.alert(`The ${createdName} user has been created successfully`);
      setCreateUserForm({ email: "", displayName: "", assignment: "REQUESTOR", password: "" });
      await loadUsers();
    } catch (err) {
      setMsg(err.message);
    }
  }

  function onSelectEditUser(userId) {
    setEditUserId(userId);
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setEditUserForm({
      displayName: user.displayName || "",
      assignment: userToAssignment(user),
      isActive: Boolean(user.isActive),
      newPassword: ""
    });
  }

  async function onSaveEditUser(e) {
    e.preventDefault();
    if (!editUserId) return;
    try {
      const assignment = assignmentToPayload(editUserForm.assignment);
      const payload = {
        displayName: editUserForm.displayName,
        role: assignment.role,
        staffType: assignment.staffType,
        isActive: Boolean(editUserForm.isActive)
      };
      if (editUserForm.newPassword.trim()) payload.newPassword = editUserForm.newPassword.trim();
      await api(`/api/admin/users/${editUserId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setMsg("User updated");
      await loadUsers();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onDeleteUser() {
    if (!editUserId) return;
    if (!window.confirm("Permanently delete this user? This cannot be undone.")) return;
    try {
      await api(`/api/admin/users/${editUserId}`, {
        method: "DELETE"
      });
      setMsg("User deleted");
      setEditUserId("");
      await loadUsers();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onDeleteUserFromMenu() {
    if (!deleteUserId) return;
    if (!window.confirm("Permanently delete this user? This cannot be undone.")) return;
    try {
      await api(`/api/admin/users/${deleteUserId}`, {
        method: "DELETE"
      });
      setMsg("User deleted");
      setDeleteUserId("");
      await loadUsers();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onCreateCategoryLike(e) {
    e.preventDefault();
    try {
      if (!["CATEGORY", "SUBCATEGORY"].includes(addCategoryForm.nodeType)) {
        setAddCategoryStatus("Please use Add Product to create products");
        return;
      }
      const parentId = addCategoryForm.nodeType === "CATEGORY" ? null : (addCategoryForm.parentId || null);
      if (hasDuplicateCatalogNode({
        nodeType: addCategoryForm.nodeType,
        name: addCategoryForm.name,
        parentId
      })) {
        setAddCategoryStatus(
          addCategoryForm.nodeType === "CATEGORY"
            ? "Category name already exists"
            : "Sub-Category name already exists under this parent"
        );
        return;
      }
      await api("/api/admin/catalog/nodes", {
        method: "POST",
        body: JSON.stringify({
          name: addCategoryForm.name,
          nodeType: addCategoryForm.nodeType,
          parentId,
          sortOrder: Number(addCategoryForm.sortOrder || 0)
        })
      });
      setAddCategoryStatus(
        addCategoryForm.nodeType === "CATEGORY"
          ? "Category created successfully"
          : "Sub-category created successfully"
      );
      setMsg("");
      setAddCategoryForm({ name: "", nodeType: "CATEGORY", parentId: "", sortOrder: 0 });
      await loadNodes();
    } catch (err) {
      setAddCategoryStatus(err.message);
    }
  }

  async function onCreateProduct(e) {
    e.preventDefault();
    try {
      if (!addProductForm.categoryId) {
        setAddProductStatus("Please select a category");
        return;
      }
      const parentId = addProductForm.subcategoryId || addProductForm.categoryId || null;
      if (hasDuplicateCatalogNode({
        nodeType: "PRODUCT",
        name: addProductForm.name,
        parentId
      })) {
        setAddProductStatus("Product name already exists under this parent");
        return;
      }
      await api("/api/admin/catalog/nodes", {
        method: "POST",
        body: JSON.stringify({
          name: addProductForm.name,
          nodeType: "PRODUCT",
          parentId,
          sortOrder: Number(addProductForm.sortOrder || 0)
        })
      });
      setAddProductStatus("Product created successfully");
      setMsg("");
      setAddProductForm({ name: "", categoryId: "", subcategoryId: "", sortOrder: 0, isActive: true });
      await loadNodes();
    } catch (err) {
      setAddProductStatus(err.message);
    }
  }

  function onSelectEditCategory(nodeId) {
    setEditCategoryId(nodeId);
    const node = categoryNodes.find((n) => n.id === nodeId);
    if (!node) {
      setEditCategoryForm({
        name: "",
        parentId: "",
        sortOrder: 0,
        isActive: true
      });
      return;
    }
    setEditCategoryForm({
      name: node.name,
      parentId: node.parentId || "",
      sortOrder: node.sortOrder || 0,
      isActive: Boolean(node.isActive)
    });
  }

  async function onSaveCategoryEdit(e) {
    e.preventDefault();
    if (!editCategoryId) return;
    try {
      const node = categoryNodes.find((n) => n.id === editCategoryId);
      const parentId = node?.nodeType === "CATEGORY" ? null : (editCategoryForm.parentId || null);
      if (hasDuplicateCatalogNode({
        nodeType: node?.nodeType,
        name: editCategoryForm.name,
        parentId,
        excludeId: editCategoryId
      })) {
        setMsg(
          node?.nodeType === "CATEGORY"
            ? "Category name already exists"
            : "Sub-Category name already exists under this parent"
        );
        return;
      }
      await api(`/api/admin/catalog/nodes/${editCategoryId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editCategoryForm.name,
          parentId,
          sortOrder: Number(editCategoryForm.sortOrder || 0),
          isActive: Boolean(editCategoryForm.isActive)
        })
      });
      setMsg("Category/Sub-category updated");
      await loadNodes();
    } catch (err) {
      setMsg(err.message);
    }
  }

  function onSelectEditProduct(nodeId) {
    setEditProductId(nodeId);
    const node = productNodes.find((n) => n.id === nodeId);
    if (!node) {
      setEditProductForm({
        name: "",
        parentId: "",
        sortOrder: 0,
        isActive: true
      });
      return;
    }

    const parentNode = node.parentId ? nodesById.get(node.parentId) : null;
    if (parentNode?.nodeType === "CATEGORY") {
      setEditProductCategoryId(parentNode.id);
      setEditProductSubcategoryId("");
    } else if (parentNode?.nodeType === "SUBCATEGORY") {
      setEditProductSubcategoryId(parentNode.id);
      const categoryNode = parentNode.parentId ? nodesById.get(parentNode.parentId) : null;
      setEditProductCategoryId(categoryNode?.nodeType === "CATEGORY" ? categoryNode.id : "");
    }

    setEditProductForm({
      name: node.name,
      parentId: node.parentId || "",
      sortOrder: node.sortOrder || 0,
      isActive: Boolean(node.isActive)
    });
  }

  async function onSaveProductEdit(e) {
    e.preventDefault();
    if (!editProductId) return;
    try {
      if (hasDuplicateCatalogNode({
        nodeType: "PRODUCT",
        name: editProductForm.name,
        parentId: editProductForm.parentId || null,
        excludeId: editProductId
      })) {
        setMsg("Product name already exists under this parent");
        return;
      }
      await api(`/api/admin/catalog/nodes/${editProductId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editProductForm.name,
          parentId: editProductForm.parentId || null,
          sortOrder: Number(editProductForm.sortOrder || 0),
          isActive: Boolean(editProductForm.isActive)
        })
      });
      setMsg("Product updated");
      await loadNodes();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onDeleteProduct() {
    if (!deleteProductId) return;
    if (!window.confirm("Permanently delete this product? This cannot be undone.")) return;
    try {
      await api(`/api/admin/catalog/nodes/${deleteProductId}`, {
        method: "DELETE"
      });
      setMsg("Product deleted");
      setDeleteProductId("");
      await loadNodes();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onDeleteCategoryNode(nodeId, label) {
    if (!nodeId) return;
    if (!window.confirm(`Permanently delete this ${label}? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/catalog/nodes/${nodeId}`, {
        method: "DELETE"
      });
      setMsg(`${label} deleted`);
      if (label === "category") {
        setDeleteCategoryId("");
        setDeleteSubcategoryId("");
      } else {
        setDeleteSubcategoryId("");
      }
      await loadNodes();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onSaveSettings(e) {
    e.preventDefault();
    try {
      await api("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          appBaseUrl: settings.appBaseUrl,
          manufacturingGroupEmail: settings.manufacturingGroupEmail,
          smtpHost: settings.smtpHost,
          smtpPort: Number(settings.smtpPort),
          smtpUser: settings.smtpUser,
          smtpFrom: settings.smtpFrom,
          smtpTls: Boolean(settings.smtpTls),
          smtpPass: settings.smtpPass
        })
      });
      setSettings((prev) => ({ ...prev, smtpPass: "" }));
      setMsg("Settings updated");
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onSendTestEmail() {
    try {
      await api("/api/admin/settings/test-email", {
        method: "POST",
        body: JSON.stringify({ to: testEmailTo })
      });
      setMsg("Test email requested");
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onAdminLogout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      navigate("/login");
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onSearchAuditLogs(e) {
    e.preventDefault();
    try {
      await loadAuditLogs();
    } catch (err) {
      setMsg(err.message);
    }
  }

  if (me && me.role !== "ADMIN") {
    return (
      <Shell title="Admin">
        <div className="card">Admin role required.</div>
      </Shell>
    );
  }

  function navButton(key, label, className = "admin-nav-btn") {
    const active = section === key;
    return (
      <button
        type="button"
        className={`${className}${active ? " active" : ""}`}
        onClick={() => setSection(key)}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="page page-admin">
      <div className="layout-side layout-side-left" aria-hidden="true" />
      <div className="page-center admin-page-center">
        <div className="admin-frame">
          <header className="admin-topbar">
            <img className="admin-header-logo" src={tanatexLogo} alt="Tanatex Chemicals" />
            <div className="admin-top-actions">
              {navButton("audit-logs", "Audit Logs", "admin-top-nav-btn")}
              {navButton("system-settings", "System Settings", "admin-top-nav-btn")}
              {navButton("send-email-test", "Send Email Test", "admin-top-nav-btn")}
              <button type="button" className="admin-logout-btn" onClick={onAdminLogout}>Logout</button>
            </div>
          </header>
          <div className="admin-separator" />
          {msg ? <div className="admin-status"><small>{msg}</small></div> : null}
          <div className="admin-layout">
            <aside className="admin-sidebar">
              <h3>User Management</h3>
              {navButton("user-create", "Create User")}
              {navButton("user-edit", "Edit User")}
              {navButton("user-delete", "Delete User")}

              <h3>Product Catalog</h3>
              {navButton("catalog-add-category", "Add Category")}
              {navButton("catalog-edit-category", "Edit Category")}
              {navButton("catalog-add-product", "Add Product")}
              {navButton("catalog-edit-product", "Edit Product")}
              {navButton("catalog-delete-product", "Delete Product")}
              {navButton("catalog-delete-category", "Delete Category/Sub-Category")}

            </aside>

            <section className="admin-content">
            {section === "user-create" ? (
              <form className="card grid" onSubmit={onCreateUser}>
              <h3>Create User</h3>
              <label>
                Email
                <input value={createUserForm.email} onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })} />
              </label>
              <label>
                Name
                <input value={createUserForm.displayName} onChange={(e) => setCreateUserForm({ ...createUserForm, displayName: e.target.value })} />
              </label>
              <label>
                Role Assignment
                <select value={createUserForm.assignment} onChange={(e) => setCreateUserForm({ ...createUserForm, assignment: e.target.value })}>
                  {roleAssignments.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </label>
              <label>
                Enable
                <select value="true" disabled>
                  <option value="true">true</option>
                </select>
              </label>
              <label>
                Password
                <input type="password" value={createUserForm.password} onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })} />
              </label>
              <button type="submit">Create User</button>
              </form>
            ) : null}

          {section === "user-edit" ? (
            <form className="card grid" onSubmit={onSaveEditUser}>
              <h3>Edit User</h3>
              <label>
                Select User
                <select value={editUserId} onChange={(e) => onSelectEditUser(e.target.value)}>
                  <option value="">Select user</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>)}
                </select>
              </label>
              {editUserId ? (
                <>
                  <label>
                    Rename
                    <input value={editUserForm.displayName} onChange={(e) => setEditUserForm({ ...editUserForm, displayName: e.target.value })} />
                  </label>
                  <label>
                    Change Role Assignment
                    <select value={editUserForm.assignment} onChange={(e) => setEditUserForm({ ...editUserForm, assignment: e.target.value })}>
                      {roleAssignments.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </label>
                  <label>
                    Change Status
                    <select value={editUserForm.isActive ? "true" : "false"} onChange={(e) => setEditUserForm({ ...editUserForm, isActive: e.target.value === "true" })}>
                      <option value="true">Active</option>
                      <option value="false">Lock</option>
                    </select>
                  </label>
                  <label>
                    Set New Password (optional)
                    <input type="password" value={editUserForm.newPassword} onChange={(e) => setEditUserForm({ ...editUserForm, newPassword: e.target.value })} />
                  </label>
                  <button type="submit">Save</button>
                </>
              ) : null}
            </form>
          ) : null}

          {section === "user-delete" ? (
            <div className="card grid">
              <h3>Delete User</h3>
              <label>
                Select User
                <select value={deleteUserId} onChange={(e) => setDeleteUserId(e.target.value)}>
                  <option value="">Select user</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>)}
                </select>
              </label>
              <button type="button" onClick={onDeleteUserFromMenu}>Delete User</button>
            </div>
          ) : null}

          {section === "catalog-add-category" ? (
            <form className="card grid" onSubmit={onCreateCategoryLike}>
              <h3>Add Category</h3>
              <label>
                Name
                <input value={addCategoryForm.name} onChange={(e) => setAddCategoryForm({ ...addCategoryForm, name: e.target.value })} />
              </label>
              <label>
                Type
                <select value={addCategoryForm.nodeType} onChange={(e) => setAddCategoryForm({ ...addCategoryForm, nodeType: e.target.value })}>
                  <option value="CATEGORY">Category</option>
                  <option value="SUBCATEGORY">Sub-Category</option>
                </select>
              </label>
              <label>
                Parent
                <select value={addCategoryForm.parentId} onChange={(e) => setAddCategoryForm({ ...addCategoryForm, parentId: e.target.value })}>
                  <option value="">No parent</option>
                  {addCategoryParentCandidates.map((n) => (
                    <option key={n.id} value={n.id}>{labelFor(n)} ({n.nodeType})</option>
                  ))}
                </select>
              </label>
              <label>
                Sort Order
                <input type="number" value={addCategoryForm.sortOrder} onChange={(e) => setAddCategoryForm({ ...addCategoryForm, sortOrder: e.target.value })} />
              </label>
              <button type="submit">Add</button>
              {addCategoryStatus ? <small>{addCategoryStatus}</small> : null}
            </form>
          ) : null}

          {section === "catalog-edit-category" ? (
            <form className="card grid" onSubmit={onSaveCategoryEdit}>
              <h3>Edit Category</h3>
              <label>
                Select Category
                <select
                  value={editCategoryCategoryId}
                  onChange={(e) => {
                    const nextCategoryId = e.target.value;
                    setEditCategoryCategoryId(nextCategoryId);
                    setEditCategorySubcategoryId("");
                    onSelectEditCategory(nextCategoryId);
                  }}
                >
                  <option value="">Select category</option>
                  {categoryLevelNodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </label>
              <label>
                Select Sub-Category (optional)
                <select
                  value={editCategorySubcategoryId}
                  onChange={(e) => {
                    const nextSubcategoryId = e.target.value;
                    setEditCategorySubcategoryId(nextSubcategoryId);
                    onSelectEditCategory(nextSubcategoryId || editCategoryCategoryId);
                  }}
                  disabled={!editCategoryCategoryId}
                >
                  <option value="">{editCategoryCategoryId ? "Edit selected category" : "Select category first"}</option>
                  {editCategorySubcategoryOptions.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </label>
              {editCategoryId ? (
                <>
                  <label>
                    Name
                    <input value={editCategoryForm.name} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })} />
                  </label>
                  <label>
                    Parent
                    <select value={editCategoryForm.parentId} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, parentId: e.target.value })}>
                      <option value="">No parent</option>
                      {activeParentCandidates.filter((n) => n.id !== editCategoryId).map((n) => (
                        <option key={n.id} value={n.id}>{labelFor(n)} ({n.nodeType})</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Sort Order
                    <input type="number" value={editCategoryForm.sortOrder} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, sortOrder: e.target.value })} />
                  </label>
                  <label>
                    Active
                    <select value={editCategoryForm.isActive ? "true" : "false"} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, isActive: e.target.value === "true" })}>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </label>
                  <button type="submit">Save</button>
                </>
              ) : null}
            </form>
          ) : null}

          {section === "catalog-add-product" ? (
            <form className="card grid" onSubmit={onCreateProduct}>
              <h3>Add Product</h3>
              <label>
                Name
                <input value={addProductForm.name} onChange={(e) => setAddProductForm({ ...addProductForm, name: e.target.value })} />
              </label>
              <label>
                Category
                <select
                  value={addProductForm.categoryId}
                  onChange={(e) => setAddProductForm({ ...addProductForm, categoryId: e.target.value, subcategoryId: "" })}
                >
                  <option value="">Select category</option>
                  {activeCategories.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Sub-Category (optional)
                <select
                  value={addProductForm.subcategoryId}
                  onChange={(e) => setAddProductForm({ ...addProductForm, subcategoryId: e.target.value })}
                  disabled={!addProductForm.categoryId}
                >
                  <option value="">{addProductForm.categoryId ? "Select sub-category" : "Select category first"}</option>
                  {addProductSubcategoryOptions.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Sort Order
                <input type="number" value={addProductForm.sortOrder} onChange={(e) => setAddProductForm({ ...addProductForm, sortOrder: e.target.value })} />
              </label>
              <label>
                Active
                <select value={addProductForm.isActive ? "true" : "false"} onChange={(e) => setAddProductForm({ ...addProductForm, isActive: e.target.value === "true" })}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
              <button type="submit">Add Product</button>
              {addProductStatus ? <small>{addProductStatus}</small> : null}
            </form>
          ) : null}

          {section === "catalog-edit-product" ? (
            <form className="card grid" onSubmit={onSaveProductEdit}>
              <h3>Edit Product</h3>
              <label>
                Select Category
                <select
                  value={editProductCategoryId}
                  onChange={(e) => {
                    setEditProductCategoryId(e.target.value);
                    setEditProductSubcategoryId("");
                    setEditProductId("");
                    setEditProductForm({
                      name: "",
                      parentId: "",
                      sortOrder: 0,
                      isActive: true
                    });
                  }}
                >
                  <option value="">Select category</option>
                  {categoryLevelNodes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                Select Sub-Category (optional)
                <select
                  value={editProductSubcategoryId}
                  onChange={(e) => {
                    setEditProductSubcategoryId(e.target.value);
                    setEditProductId("");
                    setEditProductForm({
                      name: "",
                      parentId: "",
                      sortOrder: 0,
                      isActive: true
                    });
                  }}
                  disabled={!editProductCategoryId}
                >
                  <option value="">{editProductCategoryId ? "Select sub-category" : "Select category first"}</option>
                  {editProductSubcategoryOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <div className="grid">
                <strong>Select Product</strong>
                {editProductCategoryId ? null : <small>Select category first</small>}
                {editProductCategoryId && editProductOptions.length === 0 ? <small>No products found for this selection</small> : null}
                {editProductOptions.map((p) => (
                  <label key={p.id}>
                    <input
                      type="radio"
                      name="edit-product-select"
                      checked={editProductId === p.id}
                      onChange={() => onSelectEditProduct(p.id)}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
              {editProductId ? (
                <>
                  <label>
                    Name
                    <input value={editProductForm.name} onChange={(e) => setEditProductForm({ ...editProductForm, name: e.target.value })} />
                  </label>
                  <label>
                    Parent
                    <select value={editProductForm.parentId} onChange={(e) => setEditProductForm({ ...editProductForm, parentId: e.target.value })}>
                      <option value="">Select parent</option>
                      {activeParentCandidates.map((n) => (
                        <option key={n.id} value={n.id}>{labelFor(n)} ({n.nodeType})</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Sort Order
                    <input type="number" value={editProductForm.sortOrder} onChange={(e) => setEditProductForm({ ...editProductForm, sortOrder: e.target.value })} />
                  </label>
                  <label>
                    Active
                    <select value={editProductForm.isActive ? "true" : "false"} onChange={(e) => setEditProductForm({ ...editProductForm, isActive: e.target.value === "true" })}>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </label>
                  <button type="submit">Save Product</button>
                </>
              ) : null}
            </form>
          ) : null}

          {section === "catalog-delete-product" ? (
            <div className="card grid">
              <h3>Delete Product</h3>
              <label>
                Select Category
                <select
                  value={deleteProductCategoryId}
                  onChange={(e) => {
                    setDeleteProductCategoryId(e.target.value);
                    setDeleteProductSubcategoryId("");
                    setDeleteProductId("");
                  }}
                >
                  <option value="">Select category</option>
                  {categoryLevelNodes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                Select Sub-Category (optional)
                <select
                  value={deleteProductSubcategoryId}
                  onChange={(e) => {
                    setDeleteProductSubcategoryId(e.target.value);
                    setDeleteProductId("");
                  }}
                  disabled={!deleteProductCategoryId}
                >
                  <option value="">{deleteProductCategoryId ? "Select sub-category" : "Select category first"}</option>
                  {categoryNodes
                    .filter((n) => n.nodeType === "SUBCATEGORY" && n.parentId === deleteProductCategoryId)
                    .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <div className="grid">
                <strong>Select Product</strong>
                {deleteProductCategoryId ? null : <small>Select category first</small>}
                {deleteProductCategoryId && deleteProductOptions.length === 0 ? <small>No products found for this selection</small> : null}
                {deleteProductOptions.map((p) => (
                  <label key={p.id}>
                    <input
                      type="radio"
                      name="delete-product-select"
                      checked={deleteProductId === p.id}
                      onChange={() => setDeleteProductId(p.id)}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
              <button type="button" onClick={onDeleteProduct}>Delete Product</button>
            </div>
          ) : null}

          {section === "catalog-delete-category" ? (
            <div className="card grid">
              <h3>Delete Category / Sub-Category</h3>
              <label>
                Select Category
                <select
                  value={deleteCategoryId}
                  onChange={(e) => {
                    setDeleteCategoryId(e.target.value);
                    setDeleteSubcategoryId("");
                  }}
                >
                  <option value="">Select active category</option>
                  {activeCategoryLevelNodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => onDeleteCategoryNode(deleteCategoryId, "category")}>Delete Category</button>
              <label>
                Select Sub-Category
                <select
                  value={deleteSubcategoryId}
                  onChange={(e) => setDeleteSubcategoryId(e.target.value)}
                  disabled={!deleteCategoryId}
                >
                  <option value="">{deleteCategoryId ? "Select active sub-category" : "Select category first"}</option>
                  {activeSubcategoryByDeleteCategory.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => onDeleteCategoryNode(deleteSubcategoryId, "sub-category")}>Delete Sub-category</button>
              <small>If child sub-categories or products still exist, deletion will be blocked until children are deleted first.</small>
            </div>
          ) : null}

          {section === "audit-logs" ? (
            <>
              <form className="card grid" onSubmit={onSearchAuditLogs}>
                <h3>Audit Logs</h3>
                <label>
                  Entity Type
                  <input value={auditFilter.entityType} onChange={(e) => setAuditFilter({ ...auditFilter, entityType: e.target.value })} />
                </label>
                <label>
                  Action
                  <input value={auditFilter.action} onChange={(e) => setAuditFilter({ ...auditFilter, action: e.target.value })} />
                </label>
                <label>
                  Actor User ID
                  <input value={auditFilter.actorUserId} onChange={(e) => setAuditFilter({ ...auditFilter, actorUserId: e.target.value })} />
                </label>
                <label>
                  From
                  <input type="date" value={auditFilter.from} onChange={(e) => setAuditFilter({ ...auditFilter, from: e.target.value })} />
                </label>
                <label>
                  To
                  <input type="date" value={auditFilter.to} onChange={(e) => setAuditFilter({ ...auditFilter, to: e.target.value })} />
                </label>
                <label>
                  Limit
                  <input type="number" min="1" max="500" value={auditFilter.take} onChange={(e) => setAuditFilter({ ...auditFilter, take: Number(e.target.value || 100) })} />
                </label>
                <button type="submit">Search Logs</button>
              </form>
              <div className="card grid">
                <h3>Audit Results ({auditLogs.length})</h3>
                {auditLogs.map((l) => (
                  <div key={l.id}>
                    [{new Date(l.createdAt).toLocaleString()}] {l.entityType}:{l.action} by {l.actor?.displayName || l.actor?.email || "system"} ({l.entityId})
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {section === "system-settings" ? (
            <form className="card grid" onSubmit={onSaveSettings}>
              <h3>System Settings</h3>
              <label>
                App Base URL
                <input value={settings.appBaseUrl} onChange={(e) => setSettings({ ...settings, appBaseUrl: e.target.value })} />
              </label>
              <label>
                Manufacturing Group Email
                <input value={settings.manufacturingGroupEmail} onChange={(e) => setSettings({ ...settings, manufacturingGroupEmail: e.target.value })} />
              </label>
              <label>
                SMTP Host
                <input value={settings.smtpHost} onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })} />
              </label>
              <label>
                SMTP Port
                <input type="number" value={settings.smtpPort} onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })} />
              </label>
              <label>
                SMTP User
                <input value={settings.smtpUser} onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })} />
              </label>
              <label>
                SMTP From
                <input value={settings.smtpFrom} onChange={(e) => setSettings({ ...settings, smtpFrom: e.target.value })} />
              </label>
              <label>
                SMTP TLS
                <select value={settings.smtpTls ? "true" : "false"} onChange={(e) => setSettings({ ...settings, smtpTls: e.target.value === "true" })}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
              <label>
                SMTP Password (leave blank to keep current)
                <input type="password" value={settings.smtpPass} onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })} />
              </label>
              <button type="submit">Save Settings</button>
            </form>
          ) : null}

          {section === "send-email-test" ? (
            <div className="card grid">
              <h3>Send Email Test</h3>
              <label>
                Recipient Email
                <input value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} />
              </label>
              <button type="button" onClick={onSendTestEmail}>Send Test Email</button>
            </div>
          ) : null}
            </section>
          </div>
        </div>
      </div>
      <div className="layout-side layout-side-right" aria-hidden="true" />
    </div>
  );
}
function WorkRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [detail, setDetail] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [isEditingRequest, setIsEditingRequest] = useState(false);
  const [requestEditForm, setRequestEditForm] = useState({
    productNodeId: "",
    purpose: "",
    volumeKg: "",
    unitCount: "",
    receivingAddress: "",
    receivingPersonFirstname: "",
    receivingPersonLastname: "",
    receivingPersonEmail: "",
    receivingPersonPhone: "",
    targetReceivingBy: ""
  });
  const [staff, setStaff] = useState([]);
  const [msg, setMsg] = useState("");
  const [approveComment, setApproveComment] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [resetStatus, setResetStatus] = useState("submitted");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);
  const [managerAction, setManagerAction] = useState("");
  const [showManagerResetForm, setShowManagerResetForm] = useState(false);

  const isManager = me?.role === "SALES_MANAGER" || me?.role === "ADMIN";
  const isRequestor = me?.role === "REQUESTOR";
  const isSubmitted = detail?.status === "submitted";
  const showWorkflowSections = me?.role !== "REQUESTOR" && !(isManager && isSubmitted);
  const canRequestorEditDelete = isRequestor && detail?.status === "submitted";
  const requestProducts = useMemo(
    () => catalog.filter((c) => c.nodeType === "PRODUCT" && c.isActive),
    [catalog]
  );

  async function loadDetail() {
    const d = await api(`/api/work-requests/${id}`);
    setDetail(d);
    setResetStatus(d.status);
  }

  useEffect(() => {
    api("/api/auth/me")
      .then((d) => setMe(d.user))
      .catch(() => setMe(null));
    loadDetail().catch((e) => setMsg(e.message));
  }, [id]);

  useEffect(() => {
    if (!isRequestor) return;
    api("/api/catalog/tree")
      .then((d) => setCatalog(d.items || []))
      .catch((e) => setMsg(e.message));
  }, [isRequestor]);

  useEffect(() => {
    if (!detail) return;
    setRequestEditForm({
      productNodeId: detail.productNodeId || "",
      purpose: detail.purpose || "",
      volumeKg: detail.volumeKg || "",
      unitCount: detail.unitCount || "",
      receivingAddress: detail.receivingAddress || "",
      receivingPersonFirstname: detail.receivingPersonFirstname || "",
      receivingPersonLastname: detail.receivingPersonLastname || "",
      receivingPersonEmail: detail.receivingPersonEmail || "",
      receivingPersonPhone: detail.receivingPersonPhone || "",
      targetReceivingBy: detail.targetReceivingBy ? new Date(detail.targetReceivingBy).toISOString().slice(0, 10) : ""
    });
  }, [detail]);

  useEffect(() => {
    if (!isManager) return;
    api("/api/manager/staff?page=1&pageSize=500")
      .then((d) => setStaff(d.items || []))
      .catch((e) => setMsg(e.message));
  }, [isManager]);

  useEffect(() => {
    if (!isManager) return;
    if (!isSubmitted) setManagerAction("");
  }, [isManager, isSubmitted]);

  useEffect(() => {
    if (isSubmitted) setShowManagerResetForm(false);
  }, [isSubmitted]);

  const groupedStaff = useMemo(() => {
    const map = {};
    for (const role of STAFF_ROLES) map[role] = [];
    for (const user of staff) {
      if (map[user.staffType]) map[user.staffType].push(user);
    }
    return map;
  }, [staff]);

  const selectedAssigneeSet = useMemo(() => new Set(selectedAssigneeIds), [selectedAssigneeIds]);

  const selectedByRole = useMemo(() => {
    const out = {};
    for (const role of STAFF_ROLES) {
      out[role] = groupedStaff[role].filter((u) => selectedAssigneeSet.has(u.id));
    }
    return out;
  }, [groupedStaff, selectedAssigneeSet]);

  function toggleManualAssignee(userId) {
    setSelectedAssigneeIds((prev) => (
      prev.includes(userId) ? prev.filter((id2) => id2 !== userId) : [...prev, userId]
    ));
  }

  async function onApprove() {
    try {
      await api(`/api/manager/work-requests/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          assignees: selectedAssigneeIds,
          comment: approveComment
        })
      });
      setMsg("Approved and assigned");
      await loadDetail();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onReject() {
    try {
      await api(`/api/manager/work-requests/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ comment: rejectComment })
      });
      setMsg("Rejected");
      await loadDetail();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onReset() {
    try {
      await api(`/api/manager/work-requests/${id}/reset-status`, {
        method: "POST",
        body: JSON.stringify({ toStatus: resetStatus, reason: resetReason })
      });
      setMsg("Status reset");
      await loadDetail();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onDeleteRequest() {
    if (!detail?.workRequestNo) return;
    if (!window.confirm(`Delete ${detail.workRequestNo}? This cannot be undone.`)) return;
    try {
      await api(`/api/manager/work-requests/${id}`, { method: "DELETE" });
      navigate("/manager");
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onSaveRequestEdit(e) {
    e.preventDefault();
    try {
      await api(`/api/work-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          productNodeId: requestEditForm.productNodeId,
          purpose: requestEditForm.purpose,
          volumeKg: Number(requestEditForm.volumeKg),
          unitCount: Number(requestEditForm.unitCount),
          receivingAddress: requestEditForm.receivingAddress,
          receivingPersonFirstname: requestEditForm.receivingPersonFirstname,
          receivingPersonLastname: requestEditForm.receivingPersonLastname,
          receivingPersonEmail: requestEditForm.receivingPersonEmail,
          receivingPersonPhone: requestEditForm.receivingPersonPhone,
          targetReceivingBy: requestEditForm.targetReceivingBy
        })
      });
      setMsg("Request updated");
      setIsEditingRequest(false);
      await loadDetail();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onDeleteRequestByRequestor() {
    if (!window.confirm(`Delete ${detail?.workRequestNo}? This cannot be undone.`)) return;
    try {
      await api(`/api/work-requests/${id}`, { method: "DELETE" });
      navigate("/requestor");
    } catch (err) {
      setMsg(err.message);
    }
  }

  function detailHomePath() {
    if (me?.role === "REQUESTOR") return "/requestor";
    if (me?.role === "SALES_MANAGER") return "/manager";
    if (me?.role === "ADMIN") return "/admin";
    if (me?.role === "STAFF" && me?.staffType === "LOGISTICS") return "/logistics";
    if (me?.role === "STAFF") return "/staff";
    return "/";
  }

  async function onDetailLogout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      navigate("/login");
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <Shell
      title="Work Request Details"
      showNav={false}
      onHome={() => navigate(detailHomePath())}
      onLogout={onDetailLogout}
      headerVariant="admin"
      headerLogo={tanatexLogo}
    >
      {msg ? <div className="card"><small>{msg}</small></div> : null}
      {!detail ? (
        <div className="card">Loading...</div>
      ) : (
        <>
          <div className="card grid">
            <strong>{detail.workRequestNo}</strong>
            <div>Status: {detail.status}</div>
            <div>Category: {detail.productSummary?.category || "-"}</div>
            <div>Sub-Category: {detail.productSummary?.subCategory || "-"}</div>
            <div>Product: {detail.productSummary?.product || "-"}</div>
            <div>Purpose: {detail.purpose}</div>
            <div>Volume: {detail.volumeKg} kg</div>
            <div>Unit count: {detail.unitCount}</div>
            <div>Receiving address: {detail.receivingAddress || "-"}</div>
            <div>Receiving person first name: {detail.receivingPersonFirstname || "-"}</div>
            <div>Receiving person last name: {detail.receivingPersonLastname || "-"}</div>
            <div>Receiving person email: {detail.receivingPersonEmail || "-"}</div>
            <div>Receiving person phone: {detail.receivingPersonPhone || "-"}</div>
            <div>Target receiving by: {new Date(detail.targetReceivingBy).toLocaleDateString()}</div>
            {detail.extraFields ? (
              <div>Extra fields: {JSON.stringify(detail.extraFields)}</div>
            ) : null}
          </div>
          {isManager && isSubmitted && managerAction === "" ? (
            <div className="requestor-detail-actions">
              <button type="button" className="requestor-small-btn manager-decision-btn" onClick={() => setManagerAction("approve")}>Approve</button>
              <button type="button" className="requestor-small-btn manager-decision-btn" onClick={() => setManagerAction("reject")}>Reject</button>
            </div>
          ) : null}

          {isRequestor ? (
            <>
              {!canRequestorEditDelete ? (
                <small>Requestor can edit/delete only when status is submitted.</small>
              ) : (
                <div className="requestor-detail-actions">
                  {!isEditingRequest ? (
                    <>
                      <button type="button" className="requestor-small-btn" onClick={() => setIsEditingRequest(true)}>Edit Request</button>
                      <button type="button" className="requestor-small-btn" onClick={onDeleteRequestByRequestor}>Delete Request</button>
                    </>
                  ) : null}
                </div>
              )}
              {canRequestorEditDelete && isEditingRequest ? (
                <form className="card grid" onSubmit={onSaveRequestEdit}>
                  <label>
                    Product
                    <select
                      value={requestEditForm.productNodeId}
                      onChange={(e) => setRequestEditForm({ ...requestEditForm, productNodeId: e.target.value })}
                    >
                      <option value="">Select product</option>
                      {requestProducts.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Purpose
                    <input value={requestEditForm.purpose} onChange={(e) => setRequestEditForm({ ...requestEditForm, purpose: e.target.value })} />
                  </label>
                  <label>
                    Volume (kg)
                    <input type="number" step="0.001" value={requestEditForm.volumeKg} onChange={(e) => setRequestEditForm({ ...requestEditForm, volumeKg: e.target.value })} />
                  </label>
                  <label>
                    Unit
                    <input type="number" value={requestEditForm.unitCount} onChange={(e) => setRequestEditForm({ ...requestEditForm, unitCount: e.target.value })} />
                  </label>
                  <label>
                    Receiving address
                    <input value={requestEditForm.receivingAddress} onChange={(e) => setRequestEditForm({ ...requestEditForm, receivingAddress: e.target.value })} />
                  </label>
                  <label>
                    Receiving person first name
                    <input value={requestEditForm.receivingPersonFirstname} onChange={(e) => setRequestEditForm({ ...requestEditForm, receivingPersonFirstname: e.target.value })} />
                  </label>
                  <label>
                    Receiving person last name
                    <input value={requestEditForm.receivingPersonLastname} onChange={(e) => setRequestEditForm({ ...requestEditForm, receivingPersonLastname: e.target.value })} />
                  </label>
                  <label>
                    Receiving person email
                    <input type="email" value={requestEditForm.receivingPersonEmail} onChange={(e) => setRequestEditForm({ ...requestEditForm, receivingPersonEmail: e.target.value })} />
                  </label>
                  <label>
                    Receiving person phone
                    <input value={requestEditForm.receivingPersonPhone} onChange={(e) => setRequestEditForm({ ...requestEditForm, receivingPersonPhone: e.target.value })} />
                  </label>
                  <label>
                    Target receiving by
                    <input type="date" value={requestEditForm.targetReceivingBy} onChange={(e) => setRequestEditForm({ ...requestEditForm, targetReceivingBy: e.target.value })} />
                  </label>
                  <button type="submit">Save Request</button>
                  <button type="button" onClick={() => setIsEditingRequest(false)}>Cancel</button>
                </form>
              ) : null}
            </>
          ) : null}

          {showWorkflowSections ? (
            <>
              <div className="card grid">
                <strong>Assignments</strong>
                {(detail.assignments || []).length === 0 ? <div>No staff assigned yet</div> : null}
                {(detail.assignments || []).map((a) => (
                  <div key={a.id}>
                    {a.user?.displayName || a.user?.email} ({a.assignedRole})
                  </div>
                ))}
              </div>

              <div className="card grid">
                <strong>Tasks</strong>
                {(detail.tasks || []).map((t) => (
                  <div key={t.id}>{t.taskRole}: {t.state}</div>
                ))}
              </div>

              <div className="card grid">
                <strong>Timeline</strong>
                {(detail.comments || []).length === 0 ? <div>No comments yet</div> : null}
                {(detail.comments || []).map((c) => (
                  <div key={c.id}>
                    [{new Date(c.createdAt).toLocaleString()}] {c.commentType} by {c.author?.displayName || c.author?.email}: {c.body}
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {isManager ? (
            <>
              {isSubmitted ? (
                <>
                  {managerAction === "approve" ? (
                    <div className="card grid">
                      <h3>Assign Staff</h3>
                      <div>
                        Selected users:
                        {selectedAssigneeIds.length === 0 ? " none" : ""}
                        {STAFF_ROLES.map((role) => selectedByRole[role].map((u) => (
                          <div key={u.id}>{u.displayName || u.email} ({role})</div>
                        )))}
                      </div>
                      <div>
                        <strong>Manual Override Picker</strong>
                        {STAFF_ROLES.map((role) => (
                          <div key={role}>
                            <strong>{role}</strong>
                            {groupedStaff[role].map((u) => (
                              <label key={u.id}>
                                <input
                                  type="checkbox"
                                  checked={selectedAssigneeSet.has(u.id)}
                                  onChange={() => toggleManualAssignee(u.id)}
                                />
                                {u.displayName || u.email} ({u.email})
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                      <label>
                        Approve comment
                        <input value={approveComment} onChange={(e) => setApproveComment(e.target.value)} />
                      </label>
                      <div className="manager-assign-actions">
                        <button type="button" className="manager-assign-btn" onClick={onApprove}>Approve</button>
                        <button type="button" className="manager-assign-btn" onClick={() => setManagerAction("")}>Back</button>
                      </div>
                    </div>
                  ) : null}

                  {managerAction === "reject" ? (
                    <div className="card grid">
                      <h3>Reject</h3>
                      <label>
                        Reject comment (required)
                        <input value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
                      </label>
                      <button type="button" onClick={onReject}>Reject</button>
                      <button type="button" onClick={() => setManagerAction("")}>Back</button>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="requestor-detail-actions">
                    <button
                      type="button"
                      className="requestor-small-btn"
                      onClick={() => setShowManagerResetForm((prev) => !prev)}
                    >
                      Reset Request
                    </button>
                    <button type="button" className="requestor-small-btn" onClick={onDeleteRequest}>Delete Request</button>
                  </div>
                  {showManagerResetForm ? (
                    <div className="card grid">
                      <label>
                        To status
                        <select value={resetStatus} onChange={(e) => setResetStatus(e.target.value)}>
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                      <label>
                        Reason
                        <input value={resetReason} onChange={(e) => setResetReason(e.target.value)} />
                      </label>
                      <button type="button" onClick={onReset}>Apply Reset</button>
                    </div>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </>
      )}
    </Shell>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/requestor" element={<RequestorPage />} />
      <Route path="/manager" element={<ManagerPage />} />
      <Route path="/staff" element={<StaffPage />} />
      <Route path="/logistics" element={<LogisticsPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/create" element={<CreateRequestPage />} />
      <Route path="/work-requests/:id" element={<WorkRequestDetailPage />} />
    </Routes>
  );
}

