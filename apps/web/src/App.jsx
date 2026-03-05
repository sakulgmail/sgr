import React, { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import tanatexLogo from "../../../tanatex_logo2.png";

const API_BASE = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL || "");

const STATUSES = [
  "submitted",
  "approved",
  "preparing_goods_sampling",
  "ready_to_ship",
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

async function api(path, options = {}) {
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
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function Shell({ title, children, pageClassName = "" }) {
  return (
    <div className={`page ${pageClassName}`.trim()}>
      <header className="topbar">
        <h1>GSR</h1>
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
      </header>
      <main>
        <h2>{title}</h2>
        {children}
      </main>
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
      setStatus("Logged in successfully");
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <div className="login-screen">
      <section className="login-center-panel">
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
          <button type="submit">Login</button>
          <Link to="/forgot-password" className="login-forgot-link">Forgot password?</Link>
          {status ? <small>{status}</small> : null}
        </form>
      </section>
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

  return (
    <Shell title="Requestor Dashboard">
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
          <Link to={`/work-requests/${item.id}`}>Open details</Link>
        </div>
      ))}
    </Shell>
  );
}

function ManagerPage() {
  const [status, setStatus] = useState("submitted");
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api(`/api/work-requests?status=${status}`)
      .then((d) => setItems(d.items || []))
      .catch((e) => setMsg(e.message));
  }, [status]);

  return (
    <Shell title="Sales Manager Dashboard">
      <div className="card grid">
        <label>
          Queue status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
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

  return (
    <Shell title="My Tasks">
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
  const [requestId, setRequestId] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");

  async function onShip(e) {
    e.preventDefault();
    try {
      await api(`/api/manager/work-requests/${requestId}/ship`, {
        method: "POST",
        body: JSON.stringify({ dhlTrackingUrl: url })
      });
      setStatus("Marked shipped");
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <Shell title="Shipping Update">
      <form className="card grid" onSubmit={onShip}>
        <label>Work Request ID<input value={requestId} onChange={(e) => setRequestId(e.target.value)} /></label>
        <label>DHL Tracking URL<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <button type="submit">Mark Shipped</button>
        {status ? <small>{status}</small> : null}
      </form>
    </Shell>
  );
}

function CreateRequestPage() {
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState("");
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

  const products = useMemo(() => catalog.filter((c) => c.nodeType === "PRODUCT"), [catalog]);

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

  return (
    <Shell title="Create Request">
      <form className="card grid" onSubmit={onSubmit}>
        <label>
          Product
          <select value={form.productNodeId} onChange={(e) => setForm({ ...form, productNodeId: e.target.value })}>
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
  const [addProductForm, setAddProductForm] = useState({
    name: "",
    parentId: "",
    sortOrder: 0,
    isActive: true
  });
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCategoryForm, setEditCategoryForm] = useState({
    name: "",
    parentId: "",
    sortOrder: 0,
    isActive: true
  });
  const [editProductId, setEditProductId] = useState("");
  const [editProductForm, setEditProductForm] = useState({
    name: "",
    parentId: "",
    sortOrder: 0,
    isActive: true
  });
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
  const activeParentCandidates = useMemo(
    () => nodes.filter((n) => n.nodeType !== "PRODUCT" && n.isActive),
    [nodes]
  );

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
    try {
      await api(`/api/admin/users/${editUserId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false })
      });
      setMsg("User disabled (soft delete)");
      await loadUsers();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onCreateCategoryLike(e) {
    e.preventDefault();
    try {
      await api("/api/admin/catalog/nodes", {
        method: "POST",
        body: JSON.stringify({
          name: addCategoryForm.name,
          nodeType: addCategoryForm.nodeType,
          parentId: addCategoryForm.nodeType === "CATEGORY" ? null : (addCategoryForm.parentId || null),
          sortOrder: Number(addCategoryForm.sortOrder || 0)
        })
      });
      setMsg("Catalog node created");
      setAddCategoryForm({ name: "", nodeType: "CATEGORY", parentId: "", sortOrder: 0 });
      await loadNodes();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onCreateProduct(e) {
    e.preventDefault();
    try {
      await api("/api/admin/catalog/nodes", {
        method: "POST",
        body: JSON.stringify({
          name: addProductForm.name,
          nodeType: "PRODUCT",
          parentId: addProductForm.parentId || null,
          sortOrder: Number(addProductForm.sortOrder || 0)
        })
      });
      setMsg("Product created");
      setAddProductForm({ name: "", parentId: "", sortOrder: 0, isActive: true });
      await loadNodes();
    } catch (err) {
      setMsg(err.message);
    }
  }

  function onSelectEditCategory(nodeId) {
    setEditCategoryId(nodeId);
    const node = categoryNodes.find((n) => n.id === nodeId);
    if (!node) return;
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
      await api(`/api/admin/catalog/nodes/${editCategoryId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editCategoryForm.name,
          parentId: node?.nodeType === "CATEGORY" ? null : (editCategoryForm.parentId || null),
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
    if (!node) return;
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
    try {
      await api(`/api/admin/catalog/nodes/${deleteProductId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false })
      });
      setMsg("Product disabled (soft delete)");
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

  function navButton(key, label) {
    const active = section === key;
    return (
      <button
        type="button"
        className={`admin-nav-btn${active ? " active" : ""}`}
        onClick={() => setSection(key)}
      >
        {label}
      </button>
    );
  }

  return (
    <Shell title="Admin Console" pageClassName="page-admin">
      {msg ? <div className="card"><small>{msg}</small></div> : null}
      <div className="admin-layout">
        <aside className="admin-sidebar card">
          <h3>User Management</h3>
          {navButton("user-create", "Create User")}
          {navButton("user-edit", "Edit User")}

          <h3>Product Catalog</h3>
          {navButton("catalog-add-category", "Add Category")}
          {navButton("catalog-edit-category", "Edit Category")}
          {navButton("catalog-add-product", "Add Product")}
          {navButton("catalog-edit-product", "Edit Product")}
          {navButton("catalog-delete-product", "Delete Product")}

          <h3>System</h3>
          {navButton("audit-logs", "Audit Logs")}
          {navButton("system-settings", "System Settings")}
          {navButton("send-email-test", "Send Email Test")}
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
                      <option value="true">Enable</option>
                      <option value="false">Disable</option>
                    </select>
                  </label>
                  <label>
                    Set New Password (optional)
                    <input type="password" value={editUserForm.newPassword} onChange={(e) => setEditUserForm({ ...editUserForm, newPassword: e.target.value })} />
                  </label>
                  <button type="submit">Save User</button>
                  <button type="button" onClick={onDeleteUser}>Delete User (Disable)</button>
                </>
              ) : null}
            </form>
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
                  <option value="PRODUCT">Product</option>
                </select>
              </label>
              <label>
                Parent
                <select value={addCategoryForm.parentId} onChange={(e) => setAddCategoryForm({ ...addCategoryForm, parentId: e.target.value })}>
                  <option value="">No parent</option>
                  {activeParentCandidates.map((n) => (
                    <option key={n.id} value={n.id}>{labelFor(n)} ({n.nodeType})</option>
                  ))}
                </select>
              </label>
              <label>
                Sort Order
                <input type="number" value={addCategoryForm.sortOrder} onChange={(e) => setAddCategoryForm({ ...addCategoryForm, sortOrder: e.target.value })} />
              </label>
              <button type="submit">Add</button>
            </form>
          ) : null}

          {section === "catalog-edit-category" ? (
            <form className="card grid" onSubmit={onSaveCategoryEdit}>
              <h3>Edit Category</h3>
              <label>
                Select Category / Sub-Category
                <select value={editCategoryId} onChange={(e) => onSelectEditCategory(e.target.value)}>
                  <option value="">Select</option>
                  {categoryNodes.map((n) => <option key={n.id} value={n.id}>{labelFor(n)} ({n.nodeType})</option>)}
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
                Belongs To (Category/Sub-Category)
                <select value={addProductForm.parentId} onChange={(e) => setAddProductForm({ ...addProductForm, parentId: e.target.value })}>
                  <option value="">Select parent</option>
                  {activeParentCandidates.map((n) => (
                    <option key={n.id} value={n.id}>{labelFor(n)} ({n.nodeType})</option>
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
            </form>
          ) : null}

          {section === "catalog-edit-product" ? (
            <form className="card grid" onSubmit={onSaveProductEdit}>
              <h3>Edit Product</h3>
              <label>
                Select Product
                <select value={editProductId} onChange={(e) => onSelectEditProduct(e.target.value)}>
                  <option value="">Select product</option>
                  {productNodes.map((p) => <option key={p.id} value={p.id}>{labelFor(p)}</option>)}
                </select>
              </label>
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
                Select Product
                <select value={deleteProductId} onChange={(e) => setDeleteProductId(e.target.value)}>
                  <option value="">Select product</option>
                  {productNodes.map((p) => <option key={p.id} value={p.id}>{labelFor(p)}</option>)}
                </select>
              </label>
              <button type="button" onClick={onDeleteProduct}>Delete Product (Disable)</button>
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
    </Shell>
  );
}
function WorkRequestDetailPage() {
  const { id } = useParams();
  const [me, setMe] = useState(null);
  const [detail, setDetail] = useState(null);
  const [staff, setStaff] = useState([]);
  const [msg, setMsg] = useState("");
  const [approveComment, setApproveComment] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [resetStatus, setResetStatus] = useState("submitted");
  const [counts, setCounts] = useState({
    PRODUCTION_ENGINEER: 0,
    PURCHASING: 0,
    LOGISTICS: 0
  });
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);

  const isManager = me?.role === "SALES_MANAGER" || me?.role === "ADMIN";

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
    if (!isManager) return;
    api("/api/manager/staff?page=1&pageSize=500")
      .then((d) => setStaff(d.items || []))
      .catch((e) => setMsg(e.message));
  }, [isManager]);

  const groupedStaff = useMemo(() => {
    const map = {};
    for (const role of STAFF_ROLES) map[role] = [];
    for (const user of staff) {
      if (map[user.staffType]) map[user.staffType].push(user);
    }
    return map;
  }, [staff]);

  const countBasedSelection = useMemo(() => {
    const picked = [];
    for (const role of STAFF_ROLES) {
      const c = Number(counts[role] || 0);
      picked.push(...groupedStaff[role].slice(0, c).map((u) => u.id));
    }
    return picked;
  }, [counts, groupedStaff]);

  const selectedAssigneeSet = useMemo(() => new Set(selectedAssigneeIds), [selectedAssigneeIds]);

  const selectedByRole = useMemo(() => {
    const out = {};
    for (const role of STAFF_ROLES) {
      out[role] = groupedStaff[role].filter((u) => selectedAssigneeSet.has(u.id));
    }
    return out;
  }, [groupedStaff, selectedAssigneeSet]);

  const shouldShowCountSection = useMemo(
    () => STAFF_ROLES.some((role) => groupedStaff[role].length > 1),
    [groupedStaff]
  );

  function setRoleCount(role, value) {
    const max = groupedStaff[role].length;
    const n = Math.max(0, Math.min(max, Number(value || 0)));
    setCounts((prev) => ({ ...prev, [role]: n }));
  }

  function applyCountsToSelection() {
    setSelectedAssigneeIds(countBasedSelection);
  }

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

  return (
    <Shell title="Work Request Details">
      {msg ? <div className="card"><small>{msg}</small></div> : null}
      {!detail ? (
        <div className="card">Loading...</div>
      ) : (
        <>
          <div className="card grid">
            <strong>{detail.workRequestNo}</strong>
            <div>Status: {detail.status}</div>
            <div>Purpose: {detail.purpose}</div>
            <div>Volume: {detail.volumeKg} kg</div>
            <div>Unit count: {detail.unitCount}</div>
            <div>Target receiving by: {new Date(detail.targetReceivingBy).toLocaleDateString()}</div>
          </div>

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

          {isManager ? (
            <>
              {shouldShowCountSection ? (
                <div className="card grid">
                  <h3>Approve + Assign By Role Count</h3>
                  {STAFF_ROLES.map((role) => (
                    <label key={role}>
                      {role} count (available: {groupedStaff[role].length})
                      <input
                        type="number"
                        min="0"
                        max={groupedStaff[role].length}
                        value={counts[role]}
                        onChange={(e) => setRoleCount(role, e.target.value)}
                      />
                    </label>
                  ))}
                  <button type="button" onClick={applyCountsToSelection}>Apply Counts To Selection</button>
                </div>
              ) : null}

              <div className="card grid">
                <h3>Approve + Assign</h3>
                <div>Selected total: {selectedAssigneeIds.length}</div>
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
                      <strong>{role}{shouldShowCountSection ? ` (target ${counts[role]}, selected ${selectedByRole[role].length})` : ` (selected ${selectedByRole[role].length})`}</strong>
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
                <button type="button" onClick={onApprove}>Approve + Assign</button>
              </div>

              <div className="card grid">
                <h3>Reject</h3>
                <label>
                  Reject comment (required)
                  <input value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
                </label>
                <button type="button" onClick={onReject}>Reject</button>
              </div>

              <div className="card grid">
                <h3>Reset Status</h3>
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
                <button type="button" onClick={onReset}>Reset</button>
              </div>
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

