#!/bin/bash
# Install yesu-session commands by symlinking to ~/.claude/commands/
# and configure SESSIONS_HOME environment variable
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMMANDS_SRC="$SCRIPT_DIR/commands"
COMMANDS_DST="$HOME/.claude/commands"

mkdir -p "$COMMANDS_DST"

count=0
for f in "$COMMANDS_SRC"/yesu-session:*.md; do
  name="$(basename "$f")"
  target="$COMMANDS_DST/$name"

  if [ -L "$target" ]; then
    rm "$target"
  elif [ -f "$target" ]; then
    echo "  backup: $name -> $name.bak"
    mv "$target" "$target.bak"
  fi

  ln -s "$f" "$target"
  echo "  linked: $name"
  count=$((count + 1))
done

echo ""
echo "Done. $count commands installed to $COMMANDS_DST"

# Configure SESSIONS_HOME environment variable
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
    echo "# Sessions project for Claude Code" >> "$SHELL_RC"
    echo "export SESSIONS_HOME=\"$SCRIPT_DIR\"" >> "$SHELL_RC"
    echo "Added SESSIONS_HOME=$SCRIPT_DIR to $SHELL_RC"
    echo "Run: source $SHELL_RC (or restart terminal)"
  fi
else
  echo ""
  echo "Add to your shell config:"
  echo "  export SESSIONS_HOME=\"$SCRIPT_DIR\""
fi
