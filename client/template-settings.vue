<template>
  <section v-if="isCurrentPlugin" class="template-panel">
    <div class="template-heading">
      <div>
        <h3>Typst 运行时模板</h3>
        <p>出图读取下方目录中的模板，手动修改会保留，插件启动时只补充缺失文件。</p>
      </div>
      <k-button title="重新读取模板状态" :disabled="loading || restoring" @click="refreshStatus">
        刷新
      </k-button>
    </div>

    <k-comment v-if="errorMessage" type="error">
      {{ errorMessage }}
    </k-comment>

    <div v-if="status" class="template-status">
      <div class="status-row status-path">
        <span>运行目录</span>
        <code>{{ status.runtimePath }}</code>
      </div>
      <div class="status-grid">
        <div>
          <span>默认模板</span>
          <strong>{{ status.officialCount }}</strong>
        </div>
        <div>
          <span>当前文件</span>
          <strong>{{ status.readyCount }}</strong>
        </div>
        <div>
          <span>用户修改</span>
          <strong>{{ status.modifiedCount }}</strong>
        </div>
        <div>
          <span>缺失文件</span>
          <strong>{{ status.missingCount }}</strong>
        </div>
      </div>
      <div class="template-files">
        <span v-for="file in status.files" :key="file">{{ file }}</span>
      </div>
    </div>

    <div class="template-actions">
      <k-button type="danger" :disabled="loading || restoring" @click="restoreTemplates">
        {{ restoring ? '正在恢复...' : '恢复默认模板' }}
      </k-button>
      <span>恢复前会备份整个 templates 目录，备份名称包含秒级时间戳。</span>
    </div>

    <k-comment v-if="resultMessage" type="success">
      {{ resultMessage }}
    </k-comment>
  </section>

  <section v-if="isCurrentPlugin" class="preview-panel">
    <div class="preview-heading">
      <div>
        <h3>所有 Typst 图片预览</h3>
        <p>真实数据与内置演示数据分别保存，每个模板只保留最新一张图片。</p>
      </div>
      <k-button title="重新读取预览状态" :disabled="previewLoading || previewBusy" @click="refreshPreviewInstances">
        刷新
      </k-button>
    </div>

    <k-comment v-if="previewError" type="error">
      {{ previewError }}
    </k-comment>
    <k-comment v-if="previewMessage" type="success">
      {{ previewMessage }}
    </k-comment>

    <div v-if="previewInstances.length" class="preview-toolbar">
      <label v-if="previewInstances.length > 1" class="instance-selector">
        <span>实例</span>
        <select v-model="selectedInstanceKey" :disabled="previewBusy">
          <option v-for="instance in previewInstances" :key="instance.instanceKey" :value="instance.instanceKey">
            {{ instance.commandPrefix }} · {{ instance.serverLabel }}
          </option>
        </select>
      </label>

      <div class="preview-actions">
        <k-button type="primary" :disabled="previewBusy" @click="generatePreviews('live')">
          {{ generatingMode === 'live' ? '正在生成真实预览...' : '生成真实预览' }}
        </k-button>
        <k-button :disabled="previewBusy" @click="generatePreviews('dryrun')">
          {{ generatingMode === 'dryrun' ? '正在生成演示预览...' : '生成演示预览' }}
        </k-button>
      </div>
    </div>

    <div v-if="previewInstances.length" class="mode-switch" role="tablist" aria-label="预览数据来源">
      <button
        type="button"
        :class="{ active: previewMode === 'live' }"
        role="tab"
        :aria-selected="previewMode === 'live'"
        @click="previewMode = 'live'"
      >
        真实数据
      </button>
      <button
        type="button"
        :class="{ active: previewMode === 'dryrun' }"
        role="tab"
        :aria-selected="previewMode === 'dryrun'"
        @click="previewMode = 'dryrun'"
      >
        演示数据
      </button>
    </div>

    <div v-if="activeMetadata" class="preview-summary">
      <span>{{ formatGeneratedAt(activeMetadata.generatedAt) }}</span>
      <span>成功 {{ activeMetadata.summary.success }}/{{ activeMetadata.summary.total }}</span>
      <span v-if="activeMetadata.summary.skipped">跳过 {{ activeMetadata.summary.skipped }}</span>
      <span v-if="activeMetadata.summary.error">失败 {{ activeMetadata.summary.error }}</span>
      <code :title="activeMetadata.outputDirectory">{{ activeMetadata.outputDirectory }}</code>
    </div>

    <div v-if="activeMetadata" class="gallery-shell">
      <k-button class="gallery-nav" title="向左滚动" aria-label="向左滚动" @click="scrollGallery(-1)">
        ‹
      </k-button>
      <div ref="previewGallery" class="preview-gallery">
        <article
          v-for="item in activeMetadata.items"
          :key="item.id"
          class="preview-card"
          :class="`status-${item.status}`"
        >
          <button
            type="button"
            class="preview-image-frame"
            :class="{ copyable: !!previewImages[item.id] }"
            :disabled="!previewImages[item.id]"
            :title="previewImages[item.id] ? '点击复制原始 PNG 图片' : item.message"
            :aria-label="previewImages[item.id] ? `复制 ${item.primary} PNG 图片` : `${item.primary} 图片不可用`"
            @click="copyPreviewImage(item)"
          >
            <img
              v-if="previewImages[item.id]"
              :src="previewImages[item.id]"
              :alt="`${item.primary} Typst 预览`"
            >
            <span v-else-if="item.status === 'success'">正在读取预览...</span>
            <span v-else>{{ item.message || statusLabel(item.status) }}</span>
          </button>
          <div class="preview-card-meta">
            <strong>{{ item.primary }}</strong>
            <span>{{ item.alias }}</span>
            <span v-if="item.selectedPlayer">玩家：{{ item.selectedPlayer }}</span>
          </div>
          <div class="preview-copy-panel">
            <span class="preview-copy-title">复制到剪贴板按钮</span>
            <div class="preview-card-actions">
              <button
                type="button"
                title="复制图片绝对路径"
                aria-label="复制图片绝对路径"
                :disabled="!item.absolutePath"
                @click="copyPreviewPath(item)"
              >
                📋 路径 📁
              </button>
              <button
                type="button"
                title="复制图片 JSON 信息"
                aria-label="复制图片 JSON 信息"
                @click="copyPreviewInfo(item)"
              >
                📋 信息 ℹ️
              </button>
              <button
                type="button"
                title="复制原始 PNG 图片"
                aria-label="复制原始 PNG 图片"
                :disabled="!previewImages[item.id]"
                @click="copyPreviewImage(item)"
              >
                📋 图片 🖼️
              </button>
            </div>
          </div>
        </article>
      </div>
      <k-button class="gallery-nav" title="向右滚动" aria-label="向右滚动" @click="scrollGallery(1)">
        ›
      </k-button>
    </div>

    <div v-else-if="previewInstances.length && !previewLoading" class="preview-empty">
      当前模式尚未生成预览图片。
    </div>
    <div v-else-if="!previewLoading && !previewError" class="preview-empty">
      当前没有可用的 serverinfo-rest-client 实例。
    </div>
  </section>
</template>

<script lang="ts" setup>
import { send } from '@koishijs/client'
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'

interface TemplateStatus {
  runtimePath: string
  officialCount: number
  readyCount: number
  modifiedCount: number
  missingCount: number
  files: string[]
}

interface TemplateRestoreResult extends Omit<TemplateStatus, 'files'> {
  backupPath: string | null
}

type PreviewMode = 'live' | 'dryrun'
type PreviewItemStatus = 'success' | 'skipped' | 'error'

interface PreviewInstance {
  instanceKey: string
  commandPrefix: string
  serverLabel: string
}

interface PreviewItem {
  id: string
  primary: string
  alias: string
  fileName: string
  status: PreviewItemStatus
  absolutePath: string | null
  mimeType: 'image/png' | null
  sizeBytes: number | null
  width: number | null
  height: number | null
  sha256: string | null
  selectedPlayer?: string
  message?: string
}

interface PreviewMetadata {
  schemaVersion: 1
  instanceKey: string
  commandPrefix: string
  serverLabel: string
  mode: PreviewMode
  generatedAt: string
  outputDirectory: string
  summary: {
    total: number
    success: number
    skipped: number
    error: number
  }
  items: PreviewItem[]
}

interface PreviewStatus extends PreviewInstance {
  rootDirectory: string
  busy: boolean
  activeMode: PreviewMode | null
  modes: Record<PreviewMode, PreviewMetadata | null>
}

interface PreviewImageResult {
  absolutePath: string
  fileName: string
  dataUrl: string
}

const local: any = inject('manager.settings.local')
const status = ref<TemplateStatus>()
const loading = ref(false)
const restoring = ref(false)
const errorMessage = ref('')
const resultMessage = ref('')
const previewInstances = ref<PreviewInstance[]>([])
const selectedInstanceKey = ref('')
const previewMode = ref<PreviewMode>('live')
const previewStatus = ref<PreviewStatus>()
const previewImages = ref<Record<string, string>>({})
const previewLoading = ref(false)
const generatingMode = ref<PreviewMode | null>(null)
const previewError = ref('')
const previewMessage = ref('')
const previewGallery = ref<HTMLElement>()
let imageLoadVersion = 0
let messageTimer: ReturnType<typeof setTimeout> | undefined

const isCurrentPlugin = computed(() => {
  const currentName = String(local?.value?.name || '')
  return currentName === 'koishi-plugin-ll-serverinfo-rest-client'
    || currentName === 'll-serverinfo-rest-client'
    || currentName.includes('ll-serverinfo-rest-client')
})

const activeMetadata = computed(() => previewStatus.value?.modes[previewMode.value] || null)
const previewBusy = computed(() => Boolean(generatingMode.value || previewStatus.value?.busy))

async function refreshStatus() {
  if (!isCurrentPlugin.value || loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    status.value = await send('ll-serverinfo-rest-client/templates/status' as any)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

async function restoreTemplates() {
  if (restoring.value) return
  const confirmed = window.confirm(
    '确认恢复全部默认 Typst 模板吗？\n\n当前运行目录会先完整备份，之后由 npm 包内模板覆盖。',
  )
  if (!confirmed) return

  restoring.value = true
  errorMessage.value = ''
  resultMessage.value = ''
  try {
    const result = await send('ll-serverinfo-rest-client/templates/restore' as any) as TemplateRestoreResult
    resultMessage.value = result.backupPath
      ? `恢复完成，原模板已备份到：${result.backupPath}`
      : '恢复完成；原运行目录不存在，因此没有生成备份。'
    await refreshStatus()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    restoring.value = false
  }
}

async function refreshPreviewInstances() {
  if (!isCurrentPlugin.value || previewLoading.value) return
  previewLoading.value = true
  previewError.value = ''
  try {
    const instances = await send('ll-serverinfo-rest-client/previews/instances' as any) as PreviewInstance[]
    previewInstances.value = instances
    const previous = selectedInstanceKey.value
    if (!instances.some(instance => instance.instanceKey === previous)) {
      selectedInstanceKey.value = instances[0]?.instanceKey || ''
    }
    if (selectedInstanceKey.value === previous && previous) await refreshPreviewStatus()
  } catch (error) {
    previewError.value = `无法读取 Typst 预览实例：${error instanceof Error ? error.message : String(error)}`
  } finally {
    previewLoading.value = false
  }
}

async function refreshPreviewStatus() {
  if (!selectedInstanceKey.value) {
    previewStatus.value = undefined
    previewImages.value = {}
    return
  }
  previewError.value = ''
  try {
    previewStatus.value = await send(
      'll-serverinfo-rest-client/previews/status' as any,
      selectedInstanceKey.value,
    ) as PreviewStatus
    await loadPreviewImages()
  } catch (error) {
    previewError.value = `无法读取 Typst 预览状态：${error instanceof Error ? error.message : String(error)}`
  }
}

async function generatePreviews(mode: PreviewMode) {
  if (!selectedInstanceKey.value || previewBusy.value) return
  const existing = previewStatus.value?.modes[mode]
  const existingImageCount = existing?.items.filter(item => (
    item.status === 'success' && Boolean(item.absolutePath)
  )).length || 0
  if (existingImageCount > 0) {
    const source = mode === 'live' ? '真实数据' : '演示数据'
    const confirmed = window.confirm(
      `检测到${source}模式已经有 ${existingImageCount} 张预览图片。\n\n继续生成将覆盖现有图片和 metadata.json，是否覆盖？`,
    )
    if (!confirmed) return
  }
  generatingMode.value = mode
  previewError.value = ''
  previewMessage.value = ''
  try {
    const result = await send(
      'll-serverinfo-rest-client/previews/generate' as any,
      selectedInstanceKey.value,
      mode,
    ) as PreviewMetadata
    previewMode.value = mode
    showPreviewMessage(`生成完成：成功 ${result.summary.success}/${result.summary.total}，跳过 ${result.summary.skipped}，失败 ${result.summary.error}`)
    await refreshPreviewStatus()
  } catch (error) {
    previewError.value = `Typst 预览生成失败：${error instanceof Error ? error.message : String(error)}`
  } finally {
    generatingMode.value = null
  }
}

async function loadPreviewImages() {
  const version = ++imageLoadVersion
  previewImages.value = {}
  const metadata = activeMetadata.value
  if (!metadata || !selectedInstanceKey.value) return
  await Promise.all(metadata.items.filter(item => item.status === 'success').map(async (item) => {
    try {
      const result = await send(
        'll-serverinfo-rest-client/previews/image' as any,
        selectedInstanceKey.value,
        previewMode.value,
        item.id,
      ) as PreviewImageResult
      if (version === imageLoadVersion) {
        previewImages.value = { ...previewImages.value, [item.id]: result.dataUrl }
      }
    } catch (error) {
      if (version === imageLoadVersion) {
        previewError.value = `部分预览图片读取失败：${error instanceof Error ? error.message : String(error)}`
      }
    }
  }))
}

async function copyPreviewPath(item: PreviewItem) {
  if (!item.absolutePath) return
  try {
    await writeClipboardText(item.absolutePath)
    previewError.value = ''
    showPreviewMessage(`路径已复制：${item.absolutePath}`)
  } catch (error) {
    previewError.value = `复制路径失败：${error instanceof Error ? error.message : String(error)}`
  }
}

async function copyPreviewInfo(item: PreviewItem) {
  const metadata = activeMetadata.value
  if (!metadata) return
  const value = {
    schemaVersion: metadata.schemaVersion,
    instanceKey: metadata.instanceKey,
    commandPrefix: metadata.commandPrefix,
    serverLabel: metadata.serverLabel,
    mode: metadata.mode,
    generatedAt: metadata.generatedAt,
    outputDirectory: metadata.outputDirectory,
    image: { ...item },
  }
  try {
    await writeClipboardText(JSON.stringify(value, null, 2))
    previewError.value = ''
    showPreviewMessage(`${item.primary} 图片信息已复制`)
  } catch (error) {
    previewError.value = `复制图片信息失败：${error instanceof Error ? error.message : String(error)}`
  }
}

async function copyPreviewImage(item: PreviewItem) {
  const dataUrl = previewImages.value[item.id]
  if (!dataUrl) return
  try {
    if (!window.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('当前浏览器或页面上下文不支持复制 PNG 图片，请使用 HTTPS、localhost 或 Koishi Desktop')
    }
    const blob = pngDataUrlToBlob(dataUrl)
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    previewError.value = ''
    showPreviewMessage(`${item.primary} 图片已复制`)
  } catch (error) {
    previewError.value = `复制图片失败：${error instanceof Error ? error.message : String(error)}`
  }
}

async function writeClipboardText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const input = document.createElement('textarea')
  input.value = value
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  try {
    input.select()
    if (!document.execCommand('copy')) throw new Error('浏览器拒绝了文本剪贴板操作')
  } finally {
    input.remove()
  }
}

function pngDataUrlToBlob(dataUrl: string): Blob {
  const prefix = 'data:image/png;base64,'
  if (!dataUrl.startsWith(prefix)) throw new Error('预览数据不是 PNG 图片')
  const binary = atob(dataUrl.slice(prefix.length))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: 'image/png' })
}

function showPreviewMessage(message: string) {
  previewMessage.value = message
  if (messageTimer) clearTimeout(messageTimer)
  messageTimer = setTimeout(() => {
    previewMessage.value = ''
  }, 5000)
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : `生成于 ${date.toLocaleString('zh-CN')}`
}

function statusLabel(status: PreviewItemStatus): string {
  if (status === 'skipped') return '本轮已跳过'
  if (status === 'error') return '本轮生成失败'
  return '尚未生成'
}

async function scrollGallery(direction: number) {
  await nextTick()
  previewGallery.value?.scrollBy({ left: direction * 520, behavior: 'smooth' })
}

watch(isCurrentPlugin, (active) => {
  if (active) {
    refreshStatus()
    refreshPreviewInstances()
  }
}, { immediate: true })

watch(selectedInstanceKey, () => {
  if (isCurrentPlugin.value) refreshPreviewStatus()
})

watch(previewMode, () => {
  if (isCurrentPlugin.value) loadPreviewImages()
})

onMounted(() => {
  if (isCurrentPlugin.value && !status.value) refreshStatus()
  if (isCurrentPlugin.value && !previewInstances.value.length) refreshPreviewInstances()
})
</script>

<style lang="scss" scoped>
.template-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 0;
}

.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 0;
  border-top: 1px solid var(--k-color-border);
}

.preview-heading,
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.preview-heading {
  h3 {
    margin: 0 0 4px;
    font-size: 18px;
  }

  p {
    margin: 0;
    color: var(--k-color-muted);
    line-height: 1.5;
  }
}

.instance-selector {
  display: flex;
  align-items: center;
  gap: 8px;

  span {
    color: var(--k-color-muted);
  }

  select {
    min-width: 220px;
    max-width: 420px;
    padding: 7px 30px 7px 9px;
    border: 1px solid var(--k-color-border);
    border-radius: 4px;
    color: inherit;
    background: var(--k-card-bg);
  }
}

.preview-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}

.mode-switch {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(92px, 1fr));
  align-self: flex-start;
  padding: 3px;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  background: var(--k-card-bg);

  button {
    padding: 6px 12px;
    border: 0;
    border-radius: 4px;
    color: var(--k-color-muted);
    background: transparent;
    cursor: pointer;
  }

  button.active {
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary) 12%, transparent);
    font-weight: 600;
  }
}

.preview-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  color: var(--k-color-muted);
  font-size: 13px;

  code {
    min-width: 0;
    overflow-wrap: anywhere;
    color: inherit;
  }
}

.gallery-shell {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 8px;
}

.gallery-nav {
  width: 36px;
  min-width: 36px;
  height: 36px;
  padding: 0;
  font-size: 24px;
  line-height: 1;
}

.preview-gallery {
  display: flex;
  gap: 10px;
  min-width: 0;
  padding: 2px 1px 10px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}

.preview-card {
  position: relative;
  display: flex;
  flex: 0 0 230px;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  background: var(--k-card-bg);
  scroll-snap-align: start;

  &.status-skipped,
  &.status-error {
    border-style: dashed;
  }
}

.preview-image-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 160px;
  padding: 8px;
  overflow: hidden;
  border: 0;
  border-bottom: 1px solid var(--k-color-border);
  border-radius: 0;
  color: inherit;
  background: color-mix(in srgb, var(--k-card-bg) 82%, #6b7280 18%);

  &.copyable {
    cursor: copy;
  }

  &:disabled {
    cursor: default;
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid var(--k-color-primary);
    outline-offset: -3px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  span {
    max-width: 100%;
    color: var(--k-color-muted);
    font-size: 12px;
    line-height: 1.5;
    overflow-wrap: anywhere;
    text-align: center;
  }
}

.preview-card-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 68px;
  padding: 9px 10px;

  strong,
  span {
    overflow-wrap: anywhere;
  }

  strong {
    font-size: 14px;
  }

  span {
    color: var(--k-color-muted);
    font-size: 12px;
  }
}

.preview-copy-panel {
  padding: 8px;
  border-top: 1px solid var(--k-color-border);
}

.preview-copy-title {
  display: block;
  margin-bottom: 6px;
  color: var(--k-color-muted);
  font-size: 12px;
  line-height: 1.4;
}

.preview-card-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;

  button {
    min-width: 0;
    height: 30px;
    padding: 0 3px;
    border: 1px solid var(--k-color-border);
    border-radius: 4px;
    color: inherit;
    background: var(--k-card-bg);
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
  }

  button:hover:not(:disabled) {
    color: var(--k-color-primary);
    border-color: var(--k-color-primary);
  }

  button:disabled {
    color: var(--k-color-muted);
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.preview-empty {
  padding: 24px 12px;
  border-top: 1px solid var(--k-color-border);
  border-bottom: 1px solid var(--k-color-border);
  color: var(--k-color-muted);
  text-align: center;
}

.template-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  h3 {
    margin: 0 0 4px;
    font-size: 18px;
  }

  p {
    margin: 0;
    color: var(--k-color-muted);
    line-height: 1.5;
  }
}

.template-status {
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--k-card-bg);
}

.status-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 12px;
  border-bottom: 1px solid var(--k-color-border);

  span {
    color: var(--k-color-muted);
  }

  code {
    overflow-wrap: anywhere;
  }
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));

  div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    border-right: 1px solid var(--k-color-border);
  }

  div:last-child {
    border-right: 0;
  }

  span {
    color: var(--k-color-muted);
    font-size: 12px;
  }

  strong {
    font-size: 20px;
  }
}

.template-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px;
  border-top: 1px solid var(--k-color-border);

  span {
    padding: 3px 7px;
    border: 1px solid var(--k-color-border);
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
  }
}

.template-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  span {
    color: var(--k-color-muted);
    font-size: 13px;
  }
}

@media (max-width: 720px) {
  .template-heading {
    align-items: flex-start;
  }

  .preview-heading,
  .preview-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .preview-actions {
    margin-left: 0;
  }

  .instance-selector {
    align-items: stretch;
    flex-direction: column;

    select {
      width: 100%;
      max-width: none;
    }
  }

  .gallery-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .gallery-nav {
    display: none;
  }

  .status-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .status-grid div:nth-child(2) {
    border-right: 0;
  }

  .status-grid div:nth-child(-n + 2) {
    border-bottom: 1px solid var(--k-color-border);
  }
}
</style>
