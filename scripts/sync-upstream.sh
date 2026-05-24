#!/usr/bin/env bash
# Sincronizar war-room con el upstream original sin perder los cambios de accesibilidad.
# Uso: bash scripts/sync-upstream.sh
#
# Estrategia: rebase de la rama accessible-es sobre main actualizado.
# Si hay conflictos, git se detiene y los lista — resolverlos manualmente
# y ejecutar: git rebase --continue
set -euo pipefail

BRANCH="accessible-es"
UPSTREAM="upstream"

echo "Fetching upstream..."
git fetch "$UPSTREAM"

echo "Actualizando main local..."
git checkout main
git merge --ff-only "$UPSTREAM/main"

echo "Rebasando $BRANCH sobre main..."
git checkout "$BRANCH"
git rebase main

echo ""
echo "Listo. Cambios de upstream integrados sin perder trabajo de accesibilidad."
echo "Si necesitas publicar una release: npm install && npm run build"
