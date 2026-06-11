'use client'

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react'
import { Plus, Edit2, Trash2, ExternalLink, X, Download, Upload } from 'lucide-react'
import clsx from 'clsx'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/client-api'
import { Toast } from '../components/Toast'
import { AdminGate } from '../components/AdminGate'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Skeleton } from '../components/ui'
import type { Tone } from '../components/ui'

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

  const typeBadgeTone = (t: string): Tone => {
    if (t === 'open_source') return 'blue'
    if (t === 'commercial') return 'purple'
    return 'orange'
  }

  return (
    <div>
      <PageHeader
        title="追踪列表"
        description="管理需要追踪的 Agent Memory 项目与搜索词"
        actions={(
          <>
            <Button onClick={handleExport}><Download size={16} /> 导出 JSON</Button>
          <AdminGate message="新增、编辑、删除或导入追踪列表需要管理员口令。">
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-line bg-surface px-4 py-2.5 text-[0.875rem] font-medium text-muted transition hover:bg-line-soft hover:text-text">
              <Upload size={16} /> 导入 JSON
              <input type="file" accept="application/json,.json" className="hidden" onChange={e => { handleImport(e.target.files?.[0] || null); e.currentTarget.value = '' }} />
            </label>
            <Button variant="primary" onClick={openAdd}><Plus size={16} /> 添加项目</Button>
          </AdminGate>
          </>
        )}
      />

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-[180px] rounded" />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState title="暂无追踪项目" description="点击上方按钮添加第一个项目" />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {projects.map((p) => (
            <Card key={p.id} className={clsx('animate-[fadeInUp_400ms_ease_both]', !p.enabled && 'opacity-60')}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[1.05rem] font-semibold leading-tight tracking-normal text-text">{p.name}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone={typeBadgeTone(p.type)}>{p.type}</Badge>
                    <Badge>优先级 {p.priority}</Badge>
                    {!p.enabled && <Badge tone="red">已禁用</Badge>}
                  </div>
                </div>
                <AdminGate message="编辑或删除追踪项目需要管理员口令。">
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => openEdit(p)} aria-label={`编辑 ${p.name}`}><Edit2 size={14} /></Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteId(p.id)} aria-label={`删除 ${p.name}`}><Trash2 size={14} /></Button>
                  </div>
                </AdminGate>
              </div>
              {p.github_repo && (
                <a href={`https://github.com/${p.github_repo}`} target="_blank" rel="noopener" className="mb-2.5 flex items-center gap-1 text-[0.85rem] text-accent no-underline hover:underline">
                  <ExternalLink size={12} /> {p.github_repo}
                </a>
              )}
              {p.queries.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.queries.map((q, i) => <Badge key={i} className="text-[0.75rem]">{q}</Badge>)}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} className="max-w-[520px]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-[1.125rem] font-bold tracking-normal text-text">{editingId ? '编辑项目' : '添加项目'}</h2>
              <button className="flex h-8 w-8 items-center justify-center rounded-sm text-muted transition hover:bg-line-soft hover:text-text" onClick={() => setShowModal(false)} aria-label="关闭">
                <X size={20} />
              </button>
            </div>
            <Field label="项目名称">
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="如 mem0" />
            </Field>
            <Field label="类型">
              <Select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="open_source">开源项目</option>
                <option value="commercial">商业产品</option>
                <option value="research">研究项目</option>
              </Select>
            </Field>
            <Field label="GitHub Repo">
              <Input value={form.github_repo} onChange={e => setForm({...form, github_repo: e.target.value})} placeholder="owner/repo" />
            </Field>
            <Field label="主页 URL">
              <Input value={form.homepage_url} onChange={e => setForm({...form, homepage_url: e.target.value})} placeholder="https://..." />
            </Field>
            <Field label="优先级 (1-10)">
              <Input type="number" min={1} max={10} value={form.priority} onChange={e => setForm({...form, priority: Number(e.target.value)})} />
            </Field>
            <Field label="搜索词">
              <div className="flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-sm border border-line bg-surface px-2 py-[7px] transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]" onClick={() => queryInputRef.current?.focus()}>
                {form.queries.map((query) => (
                  <span key={query} className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-2.5 pr-1.5 text-[0.78rem] font-medium leading-tight text-accent [overflow-wrap:anywhere]">
                    {query}
                    <button type="button" className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-0 bg-transparent text-current hover:bg-accent-muted" onClick={(event) => { event.stopPropagation(); removeQuery(query) }} aria-label={`删除 ${query}`}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  ref={queryInputRef}
                  className="h-7 min-w-[120px] flex-[1_1_160px] border-0 bg-transparent text-sm text-text outline-none placeholder:text-subtle"
                  value={queryInput}
                  onChange={e => handleQueryInputChange(e.target.value)}
                  onKeyDown={handleQueryKeyDown}
                  onBlur={commitQueryInput}
                  placeholder={form.queries.length === 0 ? '输入搜索词后按 Enter' : ''}
                />
              </div>
            </Field>
            <div className="mb-[18px]">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} />
                <span className="text-[0.82rem] font-medium text-text">启用采集</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2.5 border-t border-line-soft pt-4">
              <Button onClick={() => setShowModal(false)}>取消</Button>
              <Button variant="primary" onClick={handleSave} disabled={!form.name.trim()}>{editingId ? '保存' : '添加'}</Button>
            </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal
          title="确认删除"
          onClose={() => setDeleteId(null)}
          className="max-w-[400px]"
          actions={(
            <>
              <Button onClick={() => setDeleteId(null)}>取消</Button>
              <Button variant="danger" onClick={handleDelete}>确认删除</Button>
            </>
          )}
        >
          <p className="text-[0.9rem] leading-relaxed text-muted">此操作不可恢复，确定要删除该项目吗？</p>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed right-6 top-6 z-[2000] flex flex-col gap-2.5 max-md:left-4 max-md:right-4">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  )
}
