const BASE = (window.BACKEND_URL && String(window.BACKEND_URL).replace(/\/$/, '')) || ''
const api = (path, opts = {}) => {
  const username = document.getElementById('username').value || 'alice'
  const headers = opts.headers || {}
  headers['x-user'] = username
  const url = BASE + path
  return fetch(url, { ...opts, headers })
}

let currentDoc = null

// initialize Quill editor
const quill = new Quill('#editor', {
  theme: 'snow',
  modules: { toolbar: '#toolbar' }
})

function setDocTitle(title) {
  document.getElementById('docTitle').value = title
}

function setLastOpenDoc(id) {
  try { if (id == null) localStorage.removeItem('lastOpenDocId'); else localStorage.setItem('lastOpenDocId', String(id)) } catch(e) {}
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s])
}

async function loadDocs() {
  const res = await api('/api/docs')
  if (!res.ok) { alert('Failed to load docs'); return }
  const data = await res.json()
  const tabs = document.getElementById('tabs')
  tabs.innerHTML = ''
  const addTabItem = (d) => {
    const li = document.createElement('li')
    li.textContent = d.title
    li.dataset.id = d.id
    li.addEventListener('click', async () => {
      await loadDoc(d.id)
    })
    tabs.appendChild(li)
  }
  data.owned.forEach(addTabItem)
  data.shared.forEach(addTabItem)
}

async function loadDoc(id) {
  const res = await api('/api/docs/' + id)
  if (!res.ok) { alert('Error loading document'); return }
  const doc = await res.json()
  currentDoc = doc
  setDocTitle(doc.title)
  // doc.content is HTML
  quill.root.innerHTML = doc.content
  setLastOpenDoc(doc.id)
}

document.getElementById('loadDocs').onclick = loadDocs

document.getElementById('newDoc').onclick = async () => {
  const title = prompt('Document title') || 'Untitled document'
  const content = '<p></p>'
  const form = new FormData()
  form.append('title', title)
  form.append('content', content)
  const res = await api('/api/docs', { method: 'POST', body: form })
  if (!res.ok) { alert('Failed to create'); return }
  const doc = await res.json()
  currentDoc = doc
  setDocTitle(doc.title)
  quill.root.innerHTML = doc.content
  setLastOpenDoc(doc.id)
  loadDocs()
}

document.getElementById('docTitle').addEventListener('change', async (e) => {
  if (!currentDoc) return
  const title = e.target.value
  const form = new FormData()
  form.append('title', title)
  form.append('content', quill.root.innerHTML)
  const res = await api('/api/docs/' + currentDoc.id, { method: 'PUT', body: form })
  if (!res.ok) { alert('Rename failed'); return }
  currentDoc = await res.json()
  loadDocs()
})

// Save button
document.getElementById('shareBtn').addEventListener('click', async () => {
  if (!currentDoc) { alert('Select or create a document first'); return }
  // share modal simplified: share with 'bob'
  const username = prompt('Share with user (username)', 'bob')
  if (!username) return
  const form = new FormData()
  form.append('username', username)
  const res = await api('/api/docs/' + currentDoc.id + '/share', { method: 'POST', body: form })
  if (!res.ok) { alert('Share failed'); return }
  alert('Shared with ' + username)
})

document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('fileInput').click())

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const f = e.target.files[0]
  if (!f) return
  const form = new FormData()
  form.append('file', f)
  const res = await api('/api/upload', { method: 'POST', body: form })
  if (!res.ok) { alert('Upload failed'); return }
  const doc = await res.json()
  currentDoc = doc
  setDocTitle(doc.title)
  quill.root.innerHTML = doc.content
  setLastOpenDoc(doc.id)
  loadDocs()
})

// Save current document content (autosave debounce)
let saveTimer = null
function scheduleSave() {
  if (!currentDoc) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const form = new FormData()
    form.append('title', document.getElementById('docTitle').value)
    form.append('content', quill.root.innerHTML)
    await api('/api/docs/' + currentDoc.id, { method: 'PUT', body: form })
  }, 1000)
}

quill.on('text-change', scheduleSave)

// initial
loadDocs()

// Menu toggle logic
function setupMenus() {
  const mappings = [
    {btn: 'fileMenu', drop: 'fileDropdown'},
    {btn: 'editMenu', drop: 'editDropdown'},
    {btn: 'viewMenu', drop: 'viewDropdown'}
  ]
  mappings.forEach(m => {
    const b = document.getElementById(m.btn)
    const d = document.getElementById(m.drop)
    if (!b || !d) return
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      // hide others
      document.querySelectorAll('.menu-dropdown').forEach(x=>{ if (x!==d) x.style.display='none'})
      d.style.display = d.style.display === 'block' ? 'none' : 'block'
    })
  })
  // click elsewhere closes menus
  document.addEventListener('click', () => document.querySelectorAll('.menu-dropdown').forEach(x=>x.style.display='none'))
}

setupMenus()

// Menu actions
document.getElementById('downloadDoc').addEventListener('click', () => {
  if (!currentDoc) { alert('No document selected'); return }
  const blob = new Blob([currentDoc.content], {type:'text/html'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (currentDoc.title || 'document') + '.html'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
})

document.getElementById('renameFile').addEventListener('click', async () => {
  if (!currentDoc) { alert('Select a document first'); return }
  const name = prompt('Rename document', currentDoc.title)
  if (!name) return
  const form = new FormData()
  form.append('title', name)
  form.append('content', quill.root.innerHTML)
  const res = await api('/api/docs/' + currentDoc.id, { method: 'PUT', body: form })
  if (!res.ok) { alert('Rename failed'); return }
  currentDoc = await res.json()
  setDocTitle(currentDoc.title)
  loadDocs()
})

// Wire additional File menu actions: New, Open (recent), Download (plain text), Make a copy
document.getElementById('newFile').addEventListener('click', () => document.getElementById('newDoc').click())

document.getElementById('openFile').addEventListener('click', async () => {
  // populate recent docs list inside the file dropdown for direct open
  const res = await api('/api/docs')
  if (!res.ok) { alert('Failed to load docs'); return }
  const data = await res.json()
  const all = [...data.owned, ...data.shared]
  const listEl = document.getElementById('fileRecentList')
  listEl.innerHTML = ''
  if (!all.length) {
    listEl.innerHTML = '<div style="padding:8px;color:#666">No documents available</div>'
    return
  }
  // show up to 20 recent
  all.slice(0,20).forEach(d => {
    const row = document.createElement('div')
    row.className = 'recent-item'
    row.style.padding = '8px'
    row.style.cursor = 'pointer'
    row.style.borderRadius = '6px'
    row.style.marginBottom = '4px'
    row.innerHTML = `<strong style="display:block">${escapeHtml(d.title)}</strong><small style="color:#666">owner: ${escapeHtml(String(d.owner_id))}</small>`
    row.addEventListener('click', async (e) => {
      e.stopPropagation()
      await loadDoc(d.id)
      // hide dropdown
      document.querySelectorAll('.menu-dropdown').forEach(x=>x.style.display='none')
    })
    listEl.appendChild(row)
  })
})

document.getElementById('downloadFile').addEventListener('click', () => {
  if (!currentDoc) { alert('No document selected'); return }
  // download plain text version
  const text = quill.getText()
  const blob = new Blob([text], {type:'text/plain'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (currentDoc.title || 'document') + '.txt'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
})

document.getElementById('makeCopy').addEventListener('click', async () => {
  if (!currentDoc) { alert('Select a document to copy'); return }
  const title = 'Copy of ' + (currentDoc.title || 'document')
  const form = new FormData()
  form.append('title', title)
  form.append('content', currentDoc.content)
  const res = await api('/api/docs', { method: 'POST', body: form })
  if (!res.ok) { alert('Failed to make a copy'); return }
  const doc = await res.json()
  currentDoc = doc
  setDocTitle(doc.title)
  quill.root.innerHTML = doc.content
  setLastOpenDoc(doc.id)
  await loadDocs()
  alert('Copy created')
})

// initial - load docs then reopen last-open document if present
async function init() {
  await loadDocs()
  const last = (function(){ try { return localStorage.getItem('lastOpenDocId') } catch(e){ return null } })()
  if (last) {
    // try to load; ignore errors
    try { await loadDoc(last) } catch(e){}
  }
}
init()

document.getElementById('undoBtn').addEventListener('click', () => { quill.history.undo() })
document.getElementById('redoBtn').addEventListener('click', () => { quill.history.redo() })

document.getElementById('pastePlainBtn').addEventListener('click', () => {
  navigator.clipboard.readText().then(text => document.execCommand('insertText', false, text)).catch(()=>alert('Paste failed'))
})

document.getElementById('findReplaceBtn').addEventListener('click', () => {
  const find = prompt('Find text')
  if (!find) return
  const replace = prompt('Replace with (leave empty to only find)')
  const content = quill.root.innerHTML
  const newContent = content.split(find).join(replace || find)
  quill.root.innerHTML = newContent
  scheduleSave()
})

document.getElementById('fullscreenBtn').addEventListener('click', () => {
  const el = document.getElementById('page')
  if (!document.fullscreenElement) {
    el.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
})
