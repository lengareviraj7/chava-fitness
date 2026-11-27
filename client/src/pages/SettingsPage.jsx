import React, { useState, useEffect, useCallback } from 'react';
import { Save, Plus, Trash2, RefreshCw, Eye, EyeOff, X } from 'lucide-react';
import { settingsApi, usersApi } from '../api/settings.js';
import { categoriesApi } from '../api/products.js';
import { useAuth } from '../contexts/AuthContext.jsx';

// ---- Shop Profile Tab ----
function ShopProfileTab() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    settingsApi.get().then((r) => { setForm(r.data.data.settings); setLoading(false); });
  }, []);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.update(form);
      setMsg('Settings saved!');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg('Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="animate-pulse h-32 bg-surface rounded-2xl" />;

  return (
    <form onSubmit={save} className="space-y-4 max-w-xl">
      {[
        { label: 'Shop Name', key: 'shopName' },
        { label: 'Phone', key: 'phone' },
        { label: 'Email', key: 'email' },
        { label: 'GSTIN', key: 'gstin' },
        { label: 'State', key: 'state' },
        { label: 'Bill Prefix (e.g. CFC)', key: 'billPrefix' },
        { label: 'UPI ID', key: 'upiId' },
      ].map(({ label, key }) => (
        <div key={key}>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">{label}</label>
          <input value={form[key] || ''} onChange={(e) => setField(key, e.target.value)}
            className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary" />
        </div>
      ))}
      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Address</label>
        <textarea value={form.address || ''} onChange={(e) => setField('address', e.target.value)} rows={3}
          className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary resize-none" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Receipt Footer Note</label>
        <input value={form.footerNote || ''} onChange={(e) => setField('footerNote', e.target.value)}
          className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-ink font-bold px-5 py-2.5 rounded-xl text-sm hover:brightness-110 disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {msg && <span className="text-success text-sm">{msg}</span>}
      </div>
    </form>
  );
}

// ---- Staff Management Tab ----
function StaffTab() {
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', phone: '', password: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const load = useCallback(() => {
    usersApi.list().then((r) => setUsers(r.data.data.users));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addUser(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await usersApi.create(newUser);
      setShowAdd(false);
      setNewUser({ name: '', phone: '', password: '', role: 'staff' });
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u) {
    if (u.isActive) {
      await usersApi.deactivate(u._id);
    } else {
      await usersApi.activate(u._id);
    }
    load();
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-text">Staff Accounts</span>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-primary text-primary-ink font-bold px-4 py-2 rounded-xl text-sm hover:brightness-110">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {users.map((u) => (
        <div key={u._id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            {u.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-text text-sm">{u.name}</p>
            <p className="text-muted text-xs">{u.phone} · <span className={u.role === 'owner' ? 'text-primary' : 'text-muted'}>{u.role}</span></p>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${u.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {u.isActive ? 'Active' : 'Inactive'}
          </span>
          {u.role !== 'owner' && (
            <button onClick={() => toggleActive(u)}
              className="text-xs text-muted hover:text-primary font-semibold transition-colors">
              {u.isActive ? 'Deactivate' : 'Activate'}
            </button>
          )}
        </div>
      ))}

      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-text">Add Staff User</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-muted" /></button>
            </div>
            <form onSubmit={addUser} className="space-y-3">
              {[{ label: 'Full Name', key: 'name' }, { label: 'Phone', key: 'phone' }].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">{label}</label>
                  <input value={newUser[key]} onChange={(e) => setNewUser((f) => ({ ...f, [key]: e.target.value }))} required
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={newUser.password}
                    onChange={(e) => setNewUser((f) => ({ ...f, password: e.target.value }))} required minLength={6}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary pr-10" />
                  <button type="button" onClick={() => setShowPw((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser((f) => ({ ...f, role: e.target.value }))}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary">
                  <option value="staff">Staff</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              {error && <div className="bg-danger/10 border border-danger/30 text-danger text-xs rounded-xl px-3 py-2">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-ink text-sm font-bold disabled:opacity-60">
                  {saving ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Categories Tab ----
function CategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    categoriesApi.list().then((r) => setCategories(r.data.data.categories));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addCat(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await categoriesApi.create({ name: newName.trim() });
      setNewName('');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function delCat(id) {
    await categoriesApi.delete(id);
    load();
  }

  return (
    <div className="space-y-4 max-w-sm">
      <form onSubmit={addCat} className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category name"
          className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary" />
        <button type="submit" disabled={saving}
          className="bg-primary text-primary-ink font-bold px-4 py-2.5 rounded-xl text-sm hover:brightness-110 disabled:opacity-60">
          <Plus className="w-4 h-4" />
        </button>
      </form>
      {categories.map((c) => (
        <div key={c._id} className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-text">{c.name}</span>
          <button onClick={() => delCat(c._id)} className="text-muted hover:text-danger transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---- Main Page ----
export function SettingsPage() {
  const { isOwner } = useAuth();
  const tabs = ['Shop Profile', ...(isOwner ? ['Staff Management', 'Categories'] : [])];
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-text tracking-tight">Settings</h1>
      {/* Tab Nav */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${activeTab === i ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}>
            {t}
          </button>
        ))}
      </div>
      {activeTab === 0 && <ShopProfileTab />}
      {activeTab === 1 && isOwner && <StaffTab />}
      {activeTab === 2 && isOwner && <CategoriesTab />}
    </div>
  );
}
