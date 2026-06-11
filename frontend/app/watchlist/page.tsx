'use client'

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react'
import { Plus, Edit2, Trash2, ExternalLink, X, Download, Upload } from 'lucide-react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/client-api'
import { Toast } from '../components/Toast'
import { AdminGate } from '../components/AdminGate'

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

function normalizeOptional(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeGitHubRepo(value: string) {
  const trimmed = value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/^github\.com\//, '')
  return trimmed.replace(/\.git$/, '').replace(/^\/+|\/+$/g, '')
}

function parseQueries(value: string) {
  return value.split(/[,，;；\n]/).map(q => q.trim()).filter(Boolean)
}

function uniqueQueries(queries: string[]) {
  return Array.from(new Set(queries.map(q => q.trim()).filter(Boolean)))
}

export default function WatchlistPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ProjectForm>(emptyForm)
  const [queryInput, setQueryInput] = useState('')
  const queryInputRef = useRef<HTMLInputElement>(null)
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

  const openAdd = () => { setEditingId(null); setForm({ ...emptyForm, queries: [] }); setQueryInput(''); setShowModal(true) }
  const openEdit = (p: Project) => {
    setEditingId(p.id)
    setForm({ name: p.name, type: p.type, github_repo: p.github_repo || '', homepage_url: p.homepage_url || '', enabled: p.enabled, priority: p.priority, queries: p.queries })
    setQueryInput('')
    setShowModal(true)
  }

  const addQueries = (values: string[]) => {
    setForm(prev => ({ ...prev, queries: uniqueQueries([...prev.queries, ...values]) }))
  }

  const removeQuery = (query: string) => {
    setForm(prev => ({ ...prev, queries: prev.queries.filter(item => item !== query) }))
  }

  const handleQueryInputChange = (value: string) => {
    if (!/[,，;；\n]/.test(value)) {
      setQueryInput(value)
      return
    }
    const parts = value.split(/[,，;；\n]/)
    addQueries(parts.slice(0, -1))
    setQueryInput(parts[parts.length - 1] || '')
  }

  const commitQueryInput = () => {
    const queries = parseQueries(queryInput)
    if (queries.length > 0) addQueries(queries)
    setQueryInput('')
  }

  const handleQueryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'Tab') {
      if (queryInput.trim()) {
        event.preventDefault()
        commitQueryInput()
      }
      return
    }
    if (event.key === 'Backspace' && !queryInput && form.queries.length > 0) {
      event.preventDefault()
      setForm(prev => ({ ...prev, queries: prev.queries.slice(0, -1) }))
    }
  }

  const handleSave = async () => {
    const queries = uniqueQueries([...form.queries, ...parseQueries(queryInput)])
    const payload = {
      ...form,
      name: form.name.trim(),
      github_repo: normalizeOptional(normalizeGitHubRepo(form.github_repo)),
      homepage_url: normalizeOptional(form.homepage_url),
      priority: Math.min(10, Math.max(1, form.priority || 1)),
      queries,
    }
    if (!payload.name) {
      setToast({ message: '项目名称不能为空', type: 'error' })
      return
    }
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
          <AdminGate message="新增、编辑、删除或导入追踪列表需要管理员口令。">
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={16} /> 导入 JSON
              <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={e => { handleImport(e.target.files?.[0] || null); e.currentTarget.value = '' }} />
            </label>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> 添加项目</button>
          </AdminGate>
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
                <AdminGate message="编辑或删除追踪项目需要管理员口令。">
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(p)}><Edit2 size={14} /></button>
                    <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(p.id)}><Trash2 size={14} /></button>
                  </div>
                </AdminGate>
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
              <label className="form-label">搜索词</label>
              <div className="tag-input" onClick={() => queryInputRef.current?.focus()}>
                {form.queries.map((query) => (
                  <span key={query} className="query-tag">
                    {query}
                    <button type="button" className="query-tag__remove" onClick={(event) => { event.stopPropagation(); removeQuery(query) }} aria-label={`删除 ${query}`}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  ref={queryInputRef}
                  className="tag-input__field"
                  value={queryInput}
                  onChange={e => handleQueryInputChange(e.target.value)}
                  onKeyDown={handleQueryKeyDown}
                  onBlur={commitQueryInput}
                  placeholder={form.queries.length === 0 ? '输入搜索词后按 Enter' : ''}
                />
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} />
                <span className="form-label" style={{ margin: 0 }}>启用采集</span>
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>{editingId ? '保存' : '添加'}</button>
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
