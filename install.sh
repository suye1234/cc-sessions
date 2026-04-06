#!/bin/bash
# Install session skills by symlinking to ~/.claude/skills/
# and configure SESSIONS_HOME environment variable
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR/skills"
SKILLS_DST="$HOME/.claude/skills"

# --- Install skills to ~/.claude/skills/ (Claude Code native) ---
mkdir -p "$SKILLS_DST"

count=0
for d in "$SKILLS_SRC"/session-*/; do
  name="$(basename "$d")"
  target="$SKILLS_DST/$name"

  if [ -L "$target" ]; then
    rm "$target"
  elif [ -d "$target" ]; then
    echo "  backup: $name -> $name.bak"
    mv "$target" "$target.bak"
  fi

  ln -s "$d" "$target"
  echo "  linked: $name"
  count=$((count + 1))
done

echo ""
echo "Done. $count skills installed to $SKILLS_DST"

# --- Clean up old commands if present ---
OLD_COMMANDS_DST="$HOME/.claude/commands"
old_removed=0
for f in "$OLD_COMMANDS_DST"/yesu-session:*.md; do
  [ -e "$f" ] || continue
  rm "$f"
  echo "  removed old command: $(basename "$f")"
  old_removed=$((old_removed + 1))
done
if [ "$old_removed" -gt 0 ]; then
  echo "Cleaned up $old_removed old yesu-session commands"
fi

# --- Configure SESSIONS_HOME environment variable ---
SHELL_RC=""
if [ -f "$HOME/.zshrc" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
  SHELL_RC="$HOME/.bashrc"
fi

if [ -n "$SHELL_RC" ]; then
  if grep -q 'SESSIONS_HOME' "$SHELL_RC" 2>/dev/null; then
    echo "SESSIONS_HOME already configured in $SHELL_RC"
  else
    echo "" >> "$SHELL_RC"
    echo "# Sessions project for AI coding agents" >> "$SHELL_RC"
    echo "export SESSIONS_HOME=\"$SCRIPT_DIR\"" >> "$SHELL_RC"
    echo "Added SESSIONS_HOME=$SCRIPT_DIR to $SHELL_RC"
    echo "Run: source $SHELL_RC (or restart terminal)"
  fi
else
  echo ""
  echo "Add to your shell config:"
  echo "  export SESSIONS_HOME=\"$SCRIPT_DIR\""
fi
