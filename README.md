# API - Controle de Ativos Shopee Xpress

Back-end em **Node.js + Express + SQLite** para gerenciar inventário, requisições e liberações de equipamentos (coletores, impressoras, paleteiras).

## Estrutura de arquivos

```
shopee-xpress-backend/
├── server.js                        # ponto de entrada (Express, CORS, rotas)
├── database.js                      # conexão SQLite + criação das tabelas
├── models/
│   └── requisicaoModel.js           # regras de negócio (aprovar/rejeitar em transação)
├── routes/
│   ├── usuarios.js
│   ├── ativos.js
│   └── requisicoes.js
├── frontend-integration-exemplo.js  # exemplo de fetch p/ conectar botões do seu HTML
└── package.json
```

## Como rodar

```bash
npm install
npm start
# API disponível em http://localhost:3001
```

> **Requisito:** Node.js 22.5 ou superior. O banco usa o módulo nativo `node:sqlite`
> (embutido no próprio Node.js), então **não há nenhum módulo nativo para compilar**
> — nada de Visual Studio Build Tools, Python ou Chocolatey. `npm install` deve ser
> rápido em qualquer máquina, inclusive corporativas com restrições de instalação.
>
> Ao rodar, você pode ver um aviso `ExperimentalWarning: SQLite is an experimental
> feature`. É esperado e inofensivo — o SQLite nativo do Node ainda carrega essa
> tag, mas a API já é estável para uso.

## Endpoints principais

| Método | Rota                              | Descrição                                   |
|--------|-----------------------------------|----------------------------------------------|
| GET    | `/api/requisicoes/pendentes`      | Lista requisições pendentes                  |
| PATCH  | `/api/requisicoes/:id/aprovar`    | Aprova requisição, libera ativo ao usuário   |
| PATCH  | `/api/requisicoes/:id/rejeitar`   | Rejeita requisição                           |
| GET    | `/api/ativos?status=Disponivel`   | Lista ativos (filtro opcional por status)    |
| POST   | `/api/ativos/:id/solicitar`       | Colaborador solicita um ativo                |
| GET    | `/api/usuarios`                   | Lista usuários ativos                        |

## Próximos passos sugeridos (evolução corporativa)

- Autenticação (JWT) para identificar quem está aprovando (hoje é enviado no body por simplicidade didática).
- Perfis de acesso (RBAC): só "gestores/supervisores" podem aprovar/rejeitar.
- Endpoint de **devolução** de ativo (volta o status para "Disponivel").
- Log de auditoria (histórico de todas as mudanças de status).
- Migrar para PostgreSQL se o volume de usuários simultâneos crescer muito (SQLite é ótimo para times pequenos/médios, mas tem limites de concorrência de escrita).
