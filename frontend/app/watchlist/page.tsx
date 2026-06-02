'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, ExternalLink, X, Download, Upload } from 'lucide-react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { Toast } from '../components/Toast'

interface Project {
  id: number; name: string; type: string; github_repo: string | null
  homepage_url: string | null; enabled: boolean; priority: number
  created_at: string; queries: string[]
}

interface ProjectForm {
  name: string; type: string; github_repo: string; homepage_url: string
  enabled: boolean; priority: number; queries: string[]
}

const emptyForm: ProjectForm = { name: '', type: 'open_source', github_repo: '', homepage_url: '', enabled: true, priority: 5, queries: [] }

export default function WatchlistPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ProjectForm>(emptyForm)
  const [queryInput, setQueryInput] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      const data = await apiGet<Project[]>('/api/watchlist/projects')
      setProjects(data)
    } catch {
      setToast({ message: '追踪列表加载失败，请检查后端服务', type: 'error' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setQueryInput(''); setShowModal(true) }
  const openEdit = (p: Project) => {
    setEditingId(p.id)
    setForm({ name: p.name, type: p.type, github_repo: p.github_repo || '', homepage_url: p.homepage_url || '', enabled: p.enabled, priority: p.priority, queries: p.queries })
    setQueryInput(p.queries.join(', '))
    setShowModal(true)
  }

  const handleSave = async () => {
    const payload = { ...form, queries: queryInput.split(',').map(q => q.trim()).filter(Boolean) }
    try {
      if (editingId) {
        await apiPatch(`/api/watchlist/projects/${editingId}`, payload)
        setToast({ message: '项目已更新', type: 'success' })
      } else {
        await apiPost('/api/watchlist/projects', payload)
        setToast({ message: '项目已添加', type: 'success' })
      }
      setShowModal(false)
      fetchProjects()
    } catch { setToast({ message: '操作失败', type: 'error' }) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await apiDelete(`/api/watchlist/projects/${deleteId}`)
      setToast({ message: '项目已删除', type: 'success' })
      setDeleteId(null)
      fetchProjects()
    } catch { setToast({ message: '删除失败', type: 'error' }) }
  }

  const handleExport = async () => {
    try {
      const data = await apiGet('/api/watchlist/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `memory-watchlist-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setToast({ message: '追踪列表已导出', type: 'success' })
    } catch {
      setToast({ message: '导出失败', type: 'error' })
    }
  }

  const handleImport = async (file: File | null) => {
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const payload = Array.isArray(data) ? { projects: data } : data
      const result = await apiPost<{ created: number; updated: number }>('/api/watchlist/import', payload)
      setToast({ message: `导入完成：新增 ${result.created}，更新 ${result.updated}`, type: 'success' })
      fetchProjects()
    } catch {
      setToast({ message: '导入失败，请检查 JSON 文件格式', type: 'error' })
    }
  }

  const typeBadge = (t: string) => {
    if (t === 'open_source') return 'badge--blue'
    if (t === 'commercial') return 'badge--purple'
    return 'badge--orange'
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div><h1>追踪列表</h1><p>管理需要追踪的 Agent Memory 项目与搜索词</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={handleExport}><Download size={16} /> 导出 JSON</button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={16} /> 导入 JSON
            <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={e => { handleImport(e.target.files?.[0] || null); e.currentTarget.value = '' }} />
          </label>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> 添加项目</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state"><h3>暂无追踪项目</h3><p>点击上方按钮添加第一个项目</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {projects.map((p) => (
            <div key={p.id} className="card animate-in" style={{ opacity: p.enabled ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{p.name}</h3>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <span className={`badge ${typeBadge(p.type)}`}>{p.type}</span>
                    <span className="badge badge--gray">优先级 {p.priority}</span>
                    {!p.enabled && <span className="badge badge--red">已禁用</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(p)}><Edit2 size={14} /></button>
                  <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(p.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              {p.github_repo && (
                <a href={`https://github.com/${p.github_repo}`} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: 10 }}>
                  <ExternalLink size={12} /> {p.github_repo}
                </a>
              )}
              {p.queries.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {p.queries.map((q, i) => <span key={i} className="badge badge--gray" style={{ fontSize: '0.75rem' }}>{q}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ margin: 0 }}>{editingId ? '编辑项目' : '添加项目'}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">项目名称</label>
              <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="如 mem0" />
            </div>
            <div className="form-group">
              <label className="form-label">类型</label>
              <select className="form-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="open_source">开源项目</option>
                <option value="commercial">商业产品</option>
                <option value="research">研究项目</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">GitHub Repo</label>
              <input className="form-input" value={form.github_repo} onChange={e => setForm({...form, github_repo: e.target.value})} placeholder="owner/repo" />
            </div>
            <div className="form-group">
              <label className="form-label">主页 URL</label>
              <input className="form-input" value={form.homepage_url} onChange={e => setForm({...form, homepage_url: e.target.value})} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label className="form-label">优先级 (1-10)</label>
              <input className="form-input" type="number" min={1} max={10} value={form.priority} onChange={e => setForm({...form, priority: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label className="form-label">搜索词（逗号分隔）</label>
              <input className="form-input" value={queryInput} onChange={e => setQueryInput(e.target.value)} placeholder="mem0 memory, agent memory" />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} />
                <span className="form-label" style={{ margin: 0 }}>启用采集</span>
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name}>{editingId ? '保存' : '添加'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 className="modal-title">确认删除</h2>
            <p style={{ color: 'var(--muted)', marginBottom: 20 }}>此操作不可恢复，确定要删除该项目吗？</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>取消</button>
              <button className="btn btn-danger" onClick={handleDelete}>确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  )
}
