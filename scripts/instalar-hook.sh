#!/bin/sh
# Ativa a trava de testes no push (git hooks não vêm junto com o clone).
cp scripts/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
echo "Hook de pre-push instalado."
