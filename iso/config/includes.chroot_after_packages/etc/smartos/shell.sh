# Persekitaran terminal SmartOS (dimuat oleh /etc/bash.bashrc)
export PATH="$HOME/.local/npm/bin:$HOME/.local/bin:$PATH"
export NPM_CONFIG_PREFIX="$HOME/.local/npm"
install-claude-code() { npm install -g @anthropic-ai/claude-code && echo "Siap. Taip: claude" ; }
install-codex()       { npm install -g @openai/codex && echo "Siap. Taip: codex" ; }
smartos-help() {
  echo "SmartOS terminal"
  echo "  install-claude-code   pasang Claude Code (perlu akaun/kunci Anthropic)"
  echo "  install-codex         pasang Codex CLI (perlu akaun/kunci OpenAI)"
  echo "  blender               buka Blender melalui SmartOS (disambung ke AI)"
  echo "  nmtui                 urus rangkaian"
}
case $- in *i*) [ -z "$SMARTOS_HINT" ] && export SMARTOS_HINT=1 && echo "SmartOS: taip smartos-help untuk bantuan, install-claude-code / install-codex untuk alat AI." ;; esac
