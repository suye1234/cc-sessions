#!/bin/bash
# Install session skills to AI coding tools
# Supports: Claude Code, Windsurf, Codex, Copilot, Cline, and cross-tool standard path
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR/skills"

# --- Tool target definitions ---
# Format: NAME:PATH
TOOL_TARGETS=(
  "claude:$HOME/.claude/skills"
  "windsurf:$HOME/.codeium/windsurf/skills"
  "codex:$HOME/.codex/skills"
  "copilot:$HOME/.copilot/skills"
  "cline:$HOME/.cline/skills"
  "agents:$HOME/.agents/skills"
)

# --- Functions ---

usage() {
  cat <<'EOF'
Usage: install.sh [OPTIONS]

Install session skills to AI coding tools.

Options:
  (no args)       Install to Claude Code + cross-tool path (default)
  --all           Install to all supported tools
  --claude        Install to Claude Code (~/.claude/skills/)
  --windsurf      Install to Windsurf (~/.codeium/windsurf/skills/)
  --codex         Install to OpenAI Codex (~/.codex/skills/)
  --copilot       Install to GitHub Copilot (~/.copilot/skills/)
  --cline         Install to Cline (~/.cline/skills/)
  --agents        Install to cross-tool path (~/.agents/skills/)
  --uninstall     Remove installed skills from all known paths
  --help          Show this help message

Multiple targets can be combined: install.sh --windsurf --codex

Supported tools and SKILL.md compatibility:
  Claude Code     native    ~/.claude/skills/
  OpenAI Codex    native    ~/.codex/skills/
  Windsurf        native    ~/.codeium/windsurf/skills/
  GitHub Copilot  native    ~/.copilot/skills/
  Cline           native    ~/.cline/skills/
  Cursor          via .agents/skills/ (use --agents)
  Devin           via .agents/skills/ (use --agents)
  Cross-tool      standard  ~/.agents/skills/
EOF
}

install_skills_to() {
  local target_dir="$1"
  local label="$2"

  mkdir -p "$target_dir"

  local count=0
  for d in "$SKILLS_SRC"/session-*/; do
    [ -d "$d" ] || continue
    local name
    name="$(basename "$d")"
    local dest="$target_dir/$name"

    # Backup existing non-symlink directory
    if [ -d "$dest" ] && [ ! -L "$dest" ]; then
      rm -rf "$dest"
    elif [ -L "$dest" ]; then
      rm "$dest"
    fi

    cp -r "$d" "$dest"
    count=$((count + 1))
  done

  echo "  [$label] $count skills -> $target_dir"
}

uninstall_skills_from() {
  local target_dir="$1"
  local label="$2"
  local count=0

  for d in "$target_dir"/session-*/; do
    [ -d "$d" ] || continue
    rm -rf "$d"
    count=$((count + 1))
  done

  if [ "$count" -gt 0 ]; then
    echo "  [$label] removed $count skills from $target_dir"
  fi
}

get_target_path() {
  local name="$1"
  for entry in "${TOOL_TARGETS[@]}"; do
    local key="${entry%%:*}"
    local val="${entry#*:}"
    if [ "$key" = "$name" ]; then
      echo "$val"
      return
    fi
  done
}

get_target_label() {
  local name="$1"
  case "$name" in
    claude)   echo "Claude Code" ;;
    windsurf) echo "Windsurf" ;;
    codex)    echo "Codex" ;;
    copilot)  echo "Copilot" ;;
    cline)    echo "Cline" ;;
    agents)   echo "Cross-tool" ;;
    *)        echo "$name" ;;
  esac
}

cleanup_old_commands() {
  local old_dir="$HOME/.claude/commands"
  local removed=0
  for f in "$old_dir"/yesu-session:*.md "$old_dir"/session-*.md; do
    [ -e "$f" ] || continue
    rm "$f"
    echo "  removed old command: $(basename "$f")"
    removed=$((removed + 1))
  done
  if [ "$removed" -gt 0 ]; then
    echo "Cleaned up $removed old commands"
  fi
}

configure_sessions_home() {
  local shell_rc=""
  if [ -f "$HOME/.zshrc" ]; then
    shell_rc="$HOME/.zshrc"
  elif [ -f "$HOME/.bashrc" ]; then
    shell_rc="$HOME/.bashrc"
  fi

  if [ -n "$shell_rc" ]; then
    if grep -q 'SESSIONS_HOME' "$shell_rc" 2>/dev/null; then
      echo "SESSIONS_HOME already configured in $shell_rc"
    else
      echo "" >> "$shell_rc"
      echo "# Sessions project for AI coding agents" >> "$shell_rc"
      echo "export SESSIONS_HOME=\"$SCRIPT_DIR\"" >> "$shell_rc"
      echo "Added SESSIONS_HOME=$SCRIPT_DIR to $shell_rc"
      echo "Run: source $shell_rc (or restart terminal)"
    fi
  else
    echo ""
    echo "Add to your shell config:"
    echo "  export SESSIONS_HOME=\"$SCRIPT_DIR\""
  fi
}

# --- Parse arguments ---

targets=()
do_uninstall=false

if [ $# -eq 0 ]; then
  # Default: Claude Code + cross-tool
  targets=("claude" "agents")
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --all)
      targets=()
      for entry in "${TOOL_TARGETS[@]}"; do
        targets+=("${entry%%:*}")
      done
      ;;
    --claude)   targets+=("claude") ;;
    --windsurf) targets+=("windsurf") ;;
    --codex)    targets+=("codex") ;;
    --copilot)  targets+=("copilot") ;;
    --cline)    targets+=("cline") ;;
    --agents)   targets+=("agents") ;;
    --uninstall) do_uninstall=true ;;
    --help|-h)  usage; exit 0 ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

# --- Execute ---

echo "Session Skills Installer"
echo "========================"
echo ""

if [ "$do_uninstall" = true ]; then
  echo "Uninstalling skills from all known paths..."
  echo ""
  for entry in "${TOOL_TARGETS[@]}"; do
    local_name="${entry%%:*}"
    local_path="${entry#*:}"
    local_label="$(get_target_label "$local_name")"
    uninstall_skills_from "$local_path" "$local_label"
  done
  echo ""
  echo "Done. Skills removed."
  exit 0
fi

# Install to selected targets
echo "Installing skills..."
echo ""

for name in "${targets[@]}"; do
  path="$(get_target_path "$name")"
  label="$(get_target_label "$name")"
  install_skills_to "$path" "$label"
done

echo ""

# Clean up old commands
cleanup_old_commands

echo ""

# Configure SESSIONS_HOME
configure_sessions_home

echo ""
echo "Done!"
