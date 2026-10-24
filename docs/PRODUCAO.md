# Colocando a CuraLog em produção

Duas opções. Em ambas, antes de publicar, rode localmente `npm run test:pg -- --paginas` (valida tudo num PostgreSQL real).

## Variáveis de ambiente

| Variável | Obrigatória | O que é |
|---|---|---|
| `DATABASE_URL` | sim | Conexão PostgreSQL. Sem ela o sistema **não sobe** em produção (de propósito). |
| `SESSION_SECRET` | sim | Segredo da sessão. Gere: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `ADMIN_EMAIL` | no seed | E-mail do primeiro administrador. |
| `ADMIN_PASSWORD` | não | Deixe **vazio** em produção: o seed gera uma senha provisória, mostra uma vez e obriga a troca no primeiro acesso. |
| `DB_POOL_MAX` | não | Conexões por instância (padrão 5). |

## Opção A — gerenciada (recomendada): Supabase + Vercel (~R$ 250/mês)

1. **Supabase** (plano Pro, região *South America (São Paulo)*): crie o projeto e copie duas URLs em *Connect*:
   - **Direct** (porta 5432) — para migrações e seed;
   - **Transaction pooler** (porta 6543) — para o site. O sistema detecta a porta 6543 e desliga *prepared statements*, que o pooler não aceita.
2. Na sua máquina, com a URL **direta**:
   ```bash
   DATABASE_URL="postgres://...:5432/postgres" ADMIN_EMAIL=misael@... npm run db:migrate
   DATABASE_URL="postgres://...:5432/postgres" ADMIN_EMAIL=misael@... npm run db:seed
   ```
   Anote a senha provisória exibida (aparece uma única vez).
3. **Vercel** (plano Pro, uso comercial): importe o repositório do GitHub, defina `DATABASE_URL` (a do **pooler**, 6543) e `SESSION_SECRET`, região `gru1` (São Paulo). Deploy.
4. Domínio: aponte o DNS para a Vercel; o HTTPS é automático.
5. **Backup:** o Supabase Pro faz backup diário automático (7 dias). Para guardar mais tempo / fora do Supabase, rode o `scripts/backup.sh` semanalmente de qualquer máquina com `pg_dump` (pode ser um GitHub Action agendado).

A cada atualização: `npm run db:migrate` (URL direta) **antes** de publicar a nova versão.

## Opção B — VPS (~R$ 60–150/mês)

Ubuntu 24.04, 2 GB de RAM, no Brasil.

1. Instale Node 24, PostgreSQL 17+, Nginx e Certbot.
2. Crie banco e usuário próprios (`createuser curalog`, `createdb -O curalog curalog`); **não** exponha a porta 5432 na internet.
3. Clone o repositório em `/opt/curalog`, crie o `.env` com as variáveis acima e rode:
   ```bash
   npm ci && npm run db:migrate && npm run db:seed && npm run build
   ```
4. Serviço `systemd` rodando `npm start` (porta 3000) e Nginx como proxy com HTTPS (Certbot). No Nginx, repasse o IP real (`proxy_set_header X-Forwarded-For $remote_addr;`) — o bloqueio de login usa esse IP.
5. **Backup diário** (obrigatório nesta opção):
   ```bash
   chmod +x scripts/backup.sh
   # crontab -e
   0 3 * * * cd /opt/curalog && DATABASE_URL=... BACKUP_RCLONE=gdrive:curalog ./scripts/backup.sh >> /var/log/curalog-backup.log 2>&1
   ```
   Mantém 30 dias no servidor e, com `BACKUP_RCLONE`, copia para fora (Google Drive, S3...). Backup só no próprio servidor não protege contra perda do servidor.
6. **Teste a restauração** uma vez, num banco separado:
   ```bash
   createdb curalog_teste_restore
   pg_restore --no-owner -d curalog_teste_restore /var/backups/curalog/<arquivo>.dump
   ```

## Segurança já embutida

- Senhas com bcrypt; mínimo 8 caracteres com letras e números; senha provisória obriga troca.
- Bloqueio após 5 erros de login por e-mail (ou 20 por IP) em 15 minutos.
- Sessão em cookie `httpOnly` assinado, 12 h; usuário desativado perde o acesso na hora.
- Perfis admin/operador; reabrir fechamento e administrar usuários só admin.
- Auditoria de todas as alterações, logins e downloads de relatórios.
- Cabeçalhos: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.

## Checklist LGPD (operacional, fora do código)

- [ ] Banco hospedado no Brasil (Supabase São Paulo ou VPS nacional).
- [ ] Backups com acesso restrito e cópia externa criptografada.
- [ ] Cada pessoa com o próprio usuário (nada de senha compartilhada); desativar quem sair da equipe.
- [ ] Contrato/termo com as empresas contratantes sobre o tratamento dos dados dos pacientes.
- [ ] Planilhas exportadas tratadas como documento sigiloso (envio só ao responsável na empresa).
