import { useEffect, useRef } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { configureMonacoYaml } from 'monaco-yaml'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import YamlWorker from 'monaco-yaml/yaml.worker?worker'

// Wire the Monaco web workers for Vite. monaco-yaml runs the schema/diagnostics
// language service in the 'yaml' worker; everything else uses the base editor
// worker. This must be set before any editor mounts.
if (!window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker(_workerId, label) {
      if (label === 'yaml') return new YamlWorker()
      return new EditorWorker()
    },
  }
}

// Use the locally-bundled monaco instead of the default CDN download.
loader.config({ monaco })

// Browser-side "LSP": completion / hover / schema squiggles against the
// CloudFormation JSON schema. Fetched on demand; if the request fails the editor
// still works and the backend cfn-lint markers remain the source of truth.
const CFN_SCHEMA_URI =
  'https://raw.githubusercontent.com/awslabs/goformation/master/schema/cloudformation.schema.json'

let yamlConfigured = false
function ensureYamlConfigured() {
  if (yamlConfigured) return
  yamlConfigured = true
  configureMonacoYaml(monaco, {
    enableSchemaRequest: true,
    hover: true,
    completion: true,
    validate: true,
    format: true,
    schemas: [{ uri: CFN_SCHEMA_URI, fileMatch: ['*'] }],
  })
}

const SEVERITY = {
  error: monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info: monaco.MarkerSeverity.Info,
}

/**
 * Monaco YAML editor for the generated CloudFormation template.
 *
 * Props:
 *   value     — current template text (controlled)
 *   onChange  — (text) => void, fired on user edits
 *   markers   — cfn-lint diagnostics [{level, line, column, end_line, end_column, message, rule}]
 *   readOnly  — disable editing (while generating / refining)
 */
export default function CfnEditor({ value, onChange, markers = [], readOnly = false }) {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)

  useEffect(() => {
    ensureYamlConfigured()
  }, [])

  // Apply backend cfn-lint diagnostics as editor markers whenever they change.
  useEffect(() => {
    const ed = editorRef.current
    const m = monacoRef.current
    if (!ed || !m) return
    const model = ed.getModel()
    if (!model) return
    const mapped = (markers || []).map((d) => ({
      severity: SEVERITY[d.level] ?? m.MarkerSeverity.Info,
      message: d.rule ? `${d.message} (${d.rule})` : d.message,
      startLineNumber: d.line || 1,
      startColumn: d.column || 1,
      endLineNumber: d.end_line || d.line || 1,
      endColumn: d.end_column || (d.column || 1) + 1,
      source: 'cfn-lint',
    }))
    m.editor.setModelMarkers(model, 'cfn-lint', mapped)
  }, [markers])

  return (
    <Editor
      height='100%'
      language='yaml'
      theme='vs-dark'
      value={value}
      onChange={(v) => onChange?.(v ?? '')}
      onMount={(editor, monacoInstance) => {
        editorRef.current = editor
        monacoRef.current = monacoInstance
      }}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        renderWhitespace: 'none',
      }}
    />
  )
}
