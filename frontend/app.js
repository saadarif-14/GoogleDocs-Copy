const BASE = (window.BACKEND_URL && String(window.BACKEND_URL).replace(/\/$/, '')) || ''
const $ = id => document.getElementById(id)
let currentDoc = null
let saveTimer = null

const quill = new Quill('#editor', { theme: 'snow', modules: { toolbar: '#toolbar' } })

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}), 'x-user': $('username').value }
  const response = await fetch(BASE + path, { ...options, headers })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try { message = (await response.json()).detail || message } catch (_) {}
    throw new Error(message)
  }
  return response.json()
}

function setStatus(message, isError = false) {
  $('status').textContent = message
  $('status').style.color = isError ? '#b3261e' : '#5f6368'
}

function form(fields) {
  const data = new FormData()
  Object.entries(fields).forEach(([key, value]) => data.append(key, value))
  return data
}

function setEditorAccess(doc) {
  const owned = doc && doc.access_role === 'owner'
  quill.enable(Boolean(owned))
  $('docTitle').disabled = !owned
  $('shareBtn').disabled = !owned
  const notice = $('notice')
  if (!doc) {
    notice.textContent = `Create a new document or choose one from the sidebar. Only a document's owner can share it.`
    notice.style.display = 'block'
  } else if (!owned) {
    notice.textContent = `View only — shared by ${doc.owner_username}`
    notice.style.display = 'block'
  } else {
    notice.style.display = 'none'
  }
}

function renderSection(tabs, label, docs) {
  const heading = document.createElement('li')
  heading.className = 'section-label'
  heading.textContent = label
  tabs.appendChild(heading)
  if (!docs.length) {
    const empty = document.createElement('li')
    empty.textContent = 'No documents yet'
    empty.style.color = '#777'
    tabs.appendChild(empty)
  }
  docs.forEach(doc => {
    const row = document.createElement('li')
    row.dataset.id = doc.id
    row.classList.toggle('active', currentDoc && currentDoc.id === doc.id)
    const title = document.createElement('strong')
    title.textContent = doc.title
    const meta = document.createElement('span')
    meta.className = 'doc-meta'
    meta.textContent = label === 'Owned by me' ? 'Owner' : `Shared by ${doc.owner_username}`
    row.append(title, meta)
    row.onclick = () => loadDoc(doc.id)
    tabs.appendChild(row)
  })
}

async function loadDocs() {
  try {
    const data = await api('/api/docs')
    const tabs = $('tabs')
    tabs.innerHTML = ''
    renderSection(tabs, 'Owned by me', data.owned)
    renderSection(tabs, 'Shared with me', data.shared)
  } catch (error) { setStatus(error.message, true) }
}

async function loadDoc(id) {
  try {
    currentDoc = await api(`/api/docs/${id}`)
    $('docTitle').value = currentDoc.title
    quill.root.innerHTML = currentDoc.content
    setEditorAccess(currentDoc)
    localStorage.setItem(`lastDoc:${$('username').value}`, String(id))
    setStatus(currentDoc.access_role === 'owner' ? 'Saved' : 'View only')
    await loadDocs()
  } catch (error) { setStatus(error.message, true) }
}

async function createDocument(title = 'Untitled document', content = '<p><br></p>') {
  try {
    currentDoc = await api('/api/docs', { method: 'POST', body: form({ title, content }) })
    await loadDoc(currentDoc.id)
  } catch (error) { setStatus(error.message, true) }
}

async function saveDocument() {
  if (!currentDoc || currentDoc.access_role !== 'owner') return
  setStatus('Saving…')
  try {
    currentDoc = await api(`/api/docs/${currentDoc.id}`, {
      method: 'PUT', body: form({ title: $('docTitle').value, content: quill.root.innerHTML })
    })
    setStatus('Saved')
    await loadDocs()
  } catch (error) { setStatus(error.message, true) }
}

function scheduleSave() {
  if (!currentDoc || currentDoc.access_role !== 'owner') return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveDocument, 700)
}

$('newDoc').onclick = () => createDocument()
$('newFile').onclick = () => createDocument()
$('docTitle').addEventListener('input', scheduleSave)
quill.on('text-change', scheduleSave)

$('username').onchange = async () => {
  clearTimeout(saveTimer)
  currentDoc = null
  $('docTitle').value = 'Untitled document'
  quill.setContents([])
  setEditorAccess(null)
  $('avatar').textContent = $('username').value.charAt(0).toUpperCase()
  await loadDocs()
  const last = localStorage.getItem(`lastDoc:${$('username').value}`)
  if (last) await loadDoc(last)
}

$('shareBtn').onclick = () => {
  if (!currentDoc) return setStatus('Create or open a document first', true)
  $('shareDocTitle').textContent = currentDoc.title
  $('shareUser').value = $('username').value === 'alice' ? 'bob' : 'alice'
  $('shareMessage').textContent = ''
  $('shareDialog').showModal()
}

function closeShareDialog() { $('shareDialog').close() }
$('closeShare').onclick = closeShareDialog
$('cancelShare').onclick = closeShareDialog
$('shareDialog').onclick = event => { if (event.target === $('shareDialog')) closeShareDialog() }
$('shareForm').onsubmit = async event => {
  event.preventDefault()
  const username = $('shareUser').value
  $('confirmShare').disabled = true
  $('confirmShare').textContent = 'Sharing…'
  try {
    const result = await api(`/api/docs/${currentDoc.id}/share`, {
      method: 'POST', body: form({ username })
    })
    setStatus(result.already_shared ? `Already shared with ${username}` : `Shared with ${username}`)
    $('shareMessage').style.color = '#15803d'
    $('shareMessage').textContent = result.already_shared ? `${username} already has access.` : `${username} now has view access.`
    setTimeout(closeShareDialog, 700)
  } catch (error) {
    $('shareMessage').style.color = '#b91c1c'
    $('shareMessage').textContent = error.message
    setStatus(error.message, true)
  } finally {
    $('confirmShare').disabled = false
    $('confirmShare').textContent = 'Grant access'
  }
}

$('uploadBtn').onclick = () => $('fileInput').click()
$('fileInput').onchange = async event => {
  const file = event.target.files[0]
  if (!file) return
  const body = new FormData()
  body.append('file', file)
  try {
    currentDoc = await api('/api/upload', { method: 'POST', body })
    await loadDoc(currentDoc.id)
  } catch (error) { setStatus(error.message, true) }
  event.target.value = ''
}

function download(type) {
  if (!currentDoc) return setStatus('Open a document first', true)
  const html = type === 'text/html'
  const blob = new Blob([html ? quill.root.innerHTML : quill.getText()], { type })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${currentDoc.title}.${html ? 'html' : 'txt'}`
  link.click()
  URL.revokeObjectURL(link.href)
}

$('downloadDoc').onclick = () => download('text/html')
$('downloadFile').onclick = () => download('text/plain')
$('renameFile').onclick = () => { if ($('docTitle').disabled) return; $('docTitle').focus(); $('docTitle').select() }
$('makeCopy').onclick = () => currentDoc && createDocument(`Copy of ${currentDoc.title}`, quill.root.innerHTML)
$('openFile').onclick = () => setStatus('Choose a document from the sidebar')
$('undoBtn').onclick = () => quill.history.undo()
$('redoBtn').onclick = () => quill.history.redo()
$('pasteBtn').onclick = () => setStatus('Use Ctrl/Cmd+V to paste')
$('pastePlainBtn').onclick = () => setStatus('Use Ctrl/Cmd+Shift+V to paste without formatting')
$('findReplaceBtn').onclick = () => {
  const find = prompt('Find text')
  if (!find) return
  const replacement = prompt('Replace with', '')
  const text = quill.getText()
  quill.setText(text.split(find).join(replacement ?? ''))
}
$('fullscreenBtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : $('page').requestFullscreen()
let zoom = 1
$('zoomIn').onclick = () => { zoom = Math.min(1.5, zoom + 0.1); $('page').style.zoom = zoom }
$('zoomOut').onclick = () => { zoom = Math.max(0.7, zoom - 0.1); $('page').style.zoom = zoom }

document.querySelectorAll('.menu').forEach(menu => {
  const button = menu.querySelector(':scope > button')
  const dropdown = menu.querySelector('.menu-dropdown')
  button.onclick = event => {
    event.stopPropagation()
    document.querySelectorAll('.menu-dropdown').forEach(item => { if (item !== dropdown) item.style.display = 'none' })
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block'
  }
})
document.addEventListener('click', () => document.querySelectorAll('.menu-dropdown').forEach(item => { item.style.display = 'none' }))

async function init() {
  setEditorAccess(null)
  await loadDocs()
  const last = localStorage.getItem(`lastDoc:${$('username').value}`)
  if (last) await loadDoc(last)
}
init()
