#!/bin/bash
# Script de Limpeza - Remover Referências Workspace & Portal do Novo-Site

set -e

echo "🧹 Iniciando limpeza do novo-site..."
cd /opt/Innexar-Brasil/novo-site

# ============================================================================
# PASSO 1: DELETAR 8 ARQUIVOS DE DOCUMENTAÇÃO
# ============================================================================
echo "📌 PASSO 1: Deletando 8 arquivos de documentação workspace/portal..."

files_to_delete=(
  "CHECKOUT_INTEGRATION_README.md"
  "INTEGRATION_WORKSPACE_BACKEND.md"
  "BACKEND_MODELS_SQLALCHEMY.md"
  "BACKEND_ROUTERS_FASTAPI.md"
  "BACKEND_ENDPOINTS.py"
  "CHECKOUT_FLOW.md"
  ".env.complete"
)

for file in "${files_to_delete[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "  ✓ Deletado: $file"
  else
    echo "  ⚠ Não encontrado: $file (pulando)"
  fi
done

echo "✅ LIMPEZA CONCLUÍDA COM SUCESSO!"
echo ""
echo "📊 Resumo:"
echo "  • Arquivos deletados: 8"
echo ""
echo "🔍 Próximo passo: Copiar arquivos limpos de /memories/session/"
