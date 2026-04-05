#!/bin/bash
# Install yesu-session commands by symlinking to ~/.claude/commands/
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
