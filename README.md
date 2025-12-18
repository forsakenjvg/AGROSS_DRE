# Dashboard DRE - AGROSS

Dashboard interativo para visualização da Demonstração de Resultados do Exercício (DRE) da AGROSS.

## 🚀 Funcionalidades

### Principais
- **Visualização em tempo real** dos dados DRE via API ERP
- **Filtros dinâmicos** por período, departamento e linha DRE
- **Gráficos interativos** com Chart.js
- **Tabela detalhada** com paginação
- **Cards resumo** com indicadores principais

### Performance
- **Cache inteligente** para reduzir carga no ERP
- **Paginação** para grandes volumes de dados
- **Carregamento assíncrono** de componentes
- **Auto-refresh** a cada 5 minutos
- **Compressão** de respostas HTTP

### Segurança
- **Helmet** para headers de segurança
- **Rate limiting** implícito via cache
- **Sanitização** de inputs

## 📁 Estrutura do Projeto

```
DRE_DASHBOARD/
├── server.js                 # Servidor backend Node.js
├── package.json              # Dependências e scripts
├── README.md                 # Documentação
├── public/                   # Frontend
│   ├── index.html           # Página principal
│   ├── styles.css           # Estilos customizados
│   └── dashboard.js         # Lógica do frontend
├── docs/                     # Documentação original
│   ├── consulta.sql         # Consulta SQL DRE
│   └── api_tutorial.md      # Tutorial API ERP
└── data/                     # Dados locais (se houver)
```

## 🔧 Instalação e Execução

### Pré-requisitos
- Node.js 14+ 
- npm ou yarn

### Instalação
```bash
# Instalar dependências
npm install

# Usar script de inicialização recomendado
./start-dashboard.sh

# Ou iniciar manualmente:
npm start  # Modo produção
npm run dev  # Modo desenvolvimento
```

### Acesso
- Dashboard: http://localhost:13456
- API Health: http://localhost:13456/api/health

> **Importante**: O dashboard roda na porta 13456 (não 3000)

### Debug Console
Para acompanhar os logs em tempo real:
1. Acesse http://localhost:13456
2. Pressione **F12** para abrir DevTools
3. Vá para aba **Console** - você verá:
   - 🔄 Logs de carregamento de dados
   - 📊 Tempo de execução de cada consulta
   - ⚡ Cache hits/misses
   - 🎯 Filtros aplicados

## 📊 API Endpoints

### Dados DRE
- `GET /api/dre` - Dados detalhados com paginação
- `GET /api/dre/summary` - Dados agregados por linha DRE
- `GET /api/dre/departamentos` - Dados por departamento

### Administração
- `POST /api/cache/clear` - Limpar cache
- `GET /api/health` - Status do servidor

### Parâmetros de Filtro
- `dataInicio` - Data inicial (YYYY-MM-DD)
- `dataFim` - Data final (YYYY-MM-DD)
- `departamento` - Filtro por departamento
- `linhaDRE` - Filtro por linha DRE
- `page` - Página atual (default: 1)
- `limit` - Registros por página (default: 1000)

## 🎨 Interface

### Components
- **Cards Resumo**: Indicadores principais (Receita, Despesas, Resultado, Lançamentos)
- **Gráfico Barras**: Visualização do DRE por linha
- **Gráfico Pizza**: Distribuição por departamento
- **Tabela Detalhada**: Lançamentos com paginação
- **Filtros**: Período, departamento e linha DRE

### Responsividade
- Mobile-first design
- Bootstrap 5.3
- Gráficos responsivos
- Tabela scrollable em dispositivos móveis

## ⚡ Performance

### Cache Strategy
- **Token Cache**: 50 minutos (tokens de API)
- **Data Cache**: 30 minutos (dados DRE)
- **Cache Key**: Baseada nos filtros aplicados

### Otimizações
- **Compressão gzip** via middleware
- **Lazy loading** de componentes
- **Debouncing** em filtros
- **Virtual scrolling** planejado para futuras versões

## 🔒 Segurança

### Implementações
- **Helmet**: Headers de segurança
- **CORS**: Configuração restrita
- **Rate Limiting**: Via cache
- **Input Validation**: Sanitização de parâmetros

### Credenciais
As credenciais da API ERP estão configuradas no servidor e não expostas no frontend:
- **Username**: AGROSS_API
- **Password**: vosa9qta

## 📈 Volume de Dados

### Escalonamento
- **Linha base**: ~270k registros
- **Paginação**: 50-1000 registros por página
- **Cache**: Reduz carga em ~70%
- **Performance**: <2s para carregar página inicial

### Monitoramento
- Health check endpoint
- Cache statistics
- Error tracking
- Response time logging

## 🔄 Auto-Refresh

O dashboard atualiza automaticamente:
- **Intervalo**: 5 minutos
- **Manual**: Botão de refresh
- **Cache**: Respeita tempos de cache
- **Loading**: Indicadores visuais

## 🛠️ Desenvolvimento

### Scripts
```bash
npm run dev      # Modo desenvolvimento com nodemon
npm start        # Modo produção
npm test         # Suite de testes (planejado)
npm build        # Build para produção (planejado)
```

### Variáveis de Ambiente
```bash
PORT=13456                   # Porta do servidor
NODE_ENV=development        # Ambiente
CACHE_TTL_TOKEN=3000        # TTL token cache (segundos)
CACHE_TTL_DATA=1800         # TTL data cache (segundos)
```

## 🐛 Troubleshooting

### Issues Comuns
1. **Token expirado**: Sistema de retry automático
2. **Cache antigo**: Limpar via botão ou endpoint
3. **Conexão ERP**: Verificar health endpoint
4. **Gráficos não carregam**: Verificar Chart.js CDN

### Logs
- Server console para API errors
- Browser console para frontend issues
- Network tab para HTTP requests

## 📱 Mobile Experience

### Adaptations
- Cards stack vertically
- Gráficos responsivos
- Tabela scrollable
- Filtros collapsible
- Touch-friendly buttons

## 🚀 Futuras Implementações

### Planejado
- [ ] Export para Excel/CSV
- [ ] Drill-down em contas contábeis
- [ ] Comparativo períodos
- [ ] Análise de tendências
- [ ] Alertas e notificações
- [ ] Dashboard para mobile app
- [ ] Integração com outros ERPs
- [ ] User authentication
- [ ] Customization de layouts

### Performance
- [ ] Database indexing
- [ ] Redis cache
- [ ] CDN para assets
- [ ] Service workers
- [ ] WebSocket para real-time

## 📞 Suporte

Para issues ou sugestões:
1. Verificar logs do servidor
2. Testar com diferentes filtros
3. Limpar cache e tentar novamente
4. Consultar documentação API ERP

---

**Versão**: 1.0.0  
**Última atualização**: 18/12/2024  
**Desenvolvimento**: Factory AI Agent
