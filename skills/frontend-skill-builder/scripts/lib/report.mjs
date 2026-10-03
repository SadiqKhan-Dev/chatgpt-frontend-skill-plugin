/**
 * Minimal findings collector shared by the validator entrypoints.
 *
 * Three levels:
 *   error   - fails the run
 *   warning - advisory, or a failure under `--strict`
 *   info    - resolved/positive detail, never affects the exit code
 */

const LEVEL_ORDER = { error: 0, warning: 1, info: 2 }
const MARK = { error: 'error', warning: 'warn ', info: 'info ' }

export function createReport(subject) {
  const findings = []

  const push = (level, message, hint) => {
    findings.push({ level, message, ...(hint ? { hint } : {}) })
  }

  const count = (level) => findings.filter((finding) => finding.level === level).length

  return {
    subject,
    findings,
    error(message, hint) {
      push('error', message, hint)
    },
    warn(message, hint) {
      push('warning', message, hint)
    },
    info(message, hint) {
      push('info', message, hint)
    },
    get errorCount() {
      return count('error')
    },
    get warningCount() {
      return count('warning')
    },
    sorted() {
      return [...findings].sort(
        (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.message.localeCompare(b.message),
      )
    },
    format() {
      const lines = [`${subject}`]
      if (findings.length === 0) {
        lines.push(`  ${MARK.info}ok - no findings`)
        return lines.join('\n')
      }
      for (const finding of this.sorted()) {
        lines.push(`  ${MARK[finding.level]}- ${finding.message}`)
        if (finding.hint) lines.push(`         hint: ${finding.hint}`)
      }
      return lines.join('\n')
    },
  }
}

export function printReports(reports, { strict = false, stream = console } = {}) {
  for (const report of reports) stream.log(report.format())
  const errors = reports.reduce((total, report) => total + report.errorCount, 0)
  const warnings = reports.reduce((total, report) => total + report.warningCount, 0)

  stream.log('')
  stream.log(
    `${reports.length} checked, ${errors} error${errors === 1 ? '' : 's'}, ` +
      `${warnings} warning${warnings === 1 ? '' : 's'}`,
  )
  if (errors > 0) stream.log('FAILED')
  else if (warnings > 0 && strict) stream.log('FAILED (--strict: warnings are treated as errors)')
  else stream.log('PASSED')

  return errors > 0 || (strict && warnings > 0) ? 1 : 0
}

/** Abort with a usage-style message. */
export function fail(message, code = 2) {
  console.error(`error: ${message}`)
  process.exit(code)
}