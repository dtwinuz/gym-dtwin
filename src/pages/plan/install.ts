import { t } from '../../i18n'
import { planSnapshot } from '../../app/plan'
import { installProgram, type InstallMode, type Program } from '../../app/programs'
import { getProfile, updateProfile } from '../../app/store'
import { toast } from '../../app/toast'

/** Install a program; Undo brings the plan back as it was. */
export function runInstall(program: Program, mode: InstallMode) {
  const { lang } = getProfile().settings
  const before = planSnapshot(getProfile())
  updateProfile(p => installProgram(p, program, lang, mode))
  toast(t(lang, 'installed'), { label: t(lang, 'undo'), run: () => updateProfile(p => ({ ...p, ...before })) })
}
