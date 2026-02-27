#!/bin/bash
#
# Claude Code Init — 프로젝트 초기 설정 스크립트
#
# 사용법:
#   curl -sL https://raw.githubusercontent.com/crimama/claude_code_init/main/setup.sh | bash -s -- [preset] [target_dir]
#
#   또는 clone 후:
#   bash setup.sh [preset] [target_dir]
#
# preset:
#   base              — 최소 범용 구조 (기본값)
#   research          — ML/DL 연구 프로젝트 특화
#   industry-academia — 산학과제 특화 (납품물/회의록 관리 포함)
#
# target_dir:
#   초기화할 대상 디렉토리 (기본값: 현재 디렉토리)
#

set -euo pipefail

PRESET="${1:-base}"
TARGET="${2:-.}"
REPO_URL="https://github.com/crimama/claude_code_init.git"
TEMP_DIR=$(mktemp -d)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Claude Code Init — Project Setup    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# Validate preset
if [[ ! "$PRESET" =~ ^(base|research|industry-academia)$ ]]; then
    echo -e "${RED}Error: Unknown preset '$PRESET'${NC}"
    echo "Available presets: base, research, industry-academia"
    exit 1
fi

echo -e "${YELLOW}Preset:${NC}  $PRESET"
echo -e "${YELLOW}Target:${NC}  $(realpath "$TARGET")"
echo ""

# Clone or use local
if [ -d "presets" ] && [ -d "base" ]; then
    # Running from cloned repo
    SOURCE_DIR="."
else
    # Download from GitHub
    echo -e "${BLUE}Downloading templates...${NC}"
    git clone --quiet --depth 1 "$REPO_URL" "$TEMP_DIR/repo" 2>/dev/null
    SOURCE_DIR="$TEMP_DIR/repo"
fi

# Create target directory
mkdir -p "$TARGET"

# ─── Copy base files ───────────────────────────────────────

echo -e "${GREEN}[1/5]${NC} Copying base structure..."

# CLAUDE.md — use preset version if exists, otherwise base
if [ -f "$SOURCE_DIR/presets/$PRESET/CLAUDE.md" ]; then
    cp "$SOURCE_DIR/presets/$PRESET/CLAUDE.md" "$TARGET/CLAUDE.md"
else
    cp "$SOURCE_DIR/base/CLAUDE.md" "$TARGET/CLAUDE.md"
fi

# update_notes/ structure
if [ -d "$SOURCE_DIR/presets/$PRESET/update_notes" ]; then
    cp -r "$SOURCE_DIR/presets/$PRESET/update_notes" "$TARGET/update_notes"
else
    cp -r "$SOURCE_DIR/base/update_notes" "$TARGET/update_notes"
fi

# .claude/ directory
if [ -d "$SOURCE_DIR/presets/$PRESET/.claude" ]; then
    mkdir -p "$TARGET/.claude"
    cp -r "$SOURCE_DIR/presets/$PRESET/.claude/"* "$TARGET/.claude/" 2>/dev/null || true
elif [ -d "$SOURCE_DIR/base/.claude" ]; then
    mkdir -p "$TARGET/.claude"
    cp -r "$SOURCE_DIR/base/.claude/"* "$TARGET/.claude/" 2>/dev/null || true
fi

# .gitignore (if template exists)
if [ -f "$SOURCE_DIR/presets/$PRESET/.gitignore_template" ]; then
    if [ -f "$TARGET/.gitignore" ]; then
        echo -e "${YELLOW}  .gitignore exists, appending template entries...${NC}"
        echo "" >> "$TARGET/.gitignore"
        echo "# === Added by claude_code_init ===" >> "$TARGET/.gitignore"
        cat "$SOURCE_DIR/presets/$PRESET/.gitignore_template" >> "$TARGET/.gitignore"
    else
        cp "$SOURCE_DIR/presets/$PRESET/.gitignore_template" "$TARGET/.gitignore"
    fi
fi

# ─── MEMORY.md setup ──────────────────────────────────────

echo -e "${GREEN}[2/5]${NC} Preparing MEMORY.md template..."

# Determine project memory path
TARGET_ABS=$(realpath "$TARGET")
# Claude Code uses path with slashes replaced by dashes
PROJ_PATH_HASH=$(echo "$TARGET_ABS" | sed 's|/|-|g')
MEMORY_DIR="$HOME/.claude/projects/$PROJ_PATH_HASH/memory"

if [ -f "$SOURCE_DIR/presets/$PRESET/MEMORY_TEMPLATE.md" ]; then
    MEMORY_TEMPLATE="$SOURCE_DIR/presets/$PRESET/MEMORY_TEMPLATE.md"
else
    MEMORY_TEMPLATE="$SOURCE_DIR/base/MEMORY_TEMPLATE.md"
fi

# Copy MEMORY_TEMPLATE.md into the project (for reference)
cp "$MEMORY_TEMPLATE" "$TARGET/MEMORY_TEMPLATE.md"

# Also initialize actual memory location if it doesn't exist
if [ ! -f "$MEMORY_DIR/MEMORY.md" ]; then
    mkdir -p "$MEMORY_DIR"
    cp "$MEMORY_TEMPLATE" "$MEMORY_DIR/MEMORY.md"
    echo -e "  ${GREEN}Created:${NC} $MEMORY_DIR/MEMORY.md"
else
    echo -e "  ${YELLOW}Exists:${NC}  $MEMORY_DIR/MEMORY.md (not overwritten)"
fi

# ─── Preset-specific extras ────────────────────────────────

echo -e "${GREEN}[3/5]${NC} Setting up tasks/ directory..."

# ─── tasks/ setup ─────────────────────────────────────────

mkdir -p "$TARGET/tasks"

# todo.md
if [ ! -f "$TARGET/tasks/todo.md" ]; then
    cat > "$TARGET/tasks/todo.md" << 'EOF'
# Tasks — Todo

<!-- 현재 세션의 작업 계획. 세션마다 새로 작성하거나 갱신. -->
<!-- 형식: - [ ] 할 일 / - [x] 완료 -->

## 현재 작업

-

## 계획

-

## 결과

-

## 관련 노트

-
EOF
    echo -e "  ${GREEN}Created:${NC} tasks/todo.md"
fi

# lessons.md
if [ ! -f "$TARGET/tasks/lessons.md" ]; then
    cat > "$TARGET/tasks/lessons.md" << 'EOF'
# Lessons Learned

<!-- 사용자의 수정·지적으로부터 추출한 교훈을 누적 기록. -->
<!-- 세션 시작 시 반드시 먼저 확인할 것. -->
<!-- 반복 검증된 패턴은 update_notes/analysis/{주제}/_lessons.md 로 승격. -->

## 규칙 & 패턴

<!-- 형식:
### [날짜] 교훈 제목
발생 상황: ...
잘못한 것: ...
올바른 방법: ...
-->

---

*아직 기록된 교훈이 없습니다. 사용자의 첫 번째 수정/지적 후 채워집니다.*
EOF
    echo -e "  ${GREEN}Created:${NC} tasks/lessons.md"
fi

echo -e "${GREEN}[4/5]${NC} Applying preset-specific settings..."

case "$PRESET" in
    research)
        echo -e "  ${GREEN}+${NC} 6-stage experiment process template"
        echo -e "  ${GREEN}+${NC} _lessons.md knowledge graph structure"
        echo -e "  ${GREEN}+${NC} Config parameter tags ([TUNE]/[ARCH])"
        ;;
    industry-academia)
        echo -e "  ${GREEN}+${NC} Milestone/timeline tracking"
        echo -e "  ${GREEN}+${NC} Deliverables management (납품물)"
        echo -e "  ${GREEN}+${NC} Meeting notes template (회의록)"
        echo -e "  ${GREEN}+${NC} .gitignore for proprietary data"
        # Create data directories
        mkdir -p "$TARGET/data/public" "$TARGET/data/proprietary"
        echo "# Proprietary data — DO NOT COMMIT" > "$TARGET/data/proprietary/README.md"
        mkdir -p "$TARGET/demo" "$TARGET/reports"
        ;;
esac

# ─── Summary ──────────────────────────────────────────────

echo -e "${GREEN}[5/5]${NC} Done!"
echo ""
echo -e "${BLUE}Created structure:${NC}"
echo ""

# Show tree (basic version)
cd "$TARGET"
if command -v tree &> /dev/null; then
    tree -a -I '.git|__pycache__' --dirsfirst -L 3
else
    find . -not -path './.git/*' -not -name '.git' | head -40 | sort
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN} Setup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. ${YELLOW}Edit CLAUDE.md${NC} — Fill in project-specific sections"
echo -e "  2. ${YELLOW}Edit MEMORY.md${NC} — at $MEMORY_DIR/MEMORY.md"
echo -e "  3. ${YELLOW}Start Claude Code${NC} in this directory"
echo ""
echo -e "  MEMORY_TEMPLATE.md is included in the project for reference."
echo -e "  The actual persistent memory is at:"
echo -e "  ${BLUE}$MEMORY_DIR/MEMORY.md${NC}"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"
