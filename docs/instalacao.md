# Instalação e Configuração

## Pré-requisitos

### Ambiente de Execução

#### Node.js
- **Versão Mínima**: 14.x (recomendado 18.x ou superior)
- **Instalação**: 
  ```bash
  # Verificar versão instalada
  node --version
  
  # Instalar via NVM (recomendado)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  nvm install 18
  nvm use 18
  ```

#### NPM (Node Package Manager)
- **Versão**: Inclusa na instalação do Node.js
- **Verificação**:
  ```bash
  npm --version
  ```

#### Sistema Operacional
- **Linux**: Ubuntu 18.04+, CentOS 7+, Debian 9+
- **Windows**: Windows 10+ (WSL recomendado para desenvolvimento)
- **macOS**: 10.15+

### Conectividade
- **Acesso Internet**: Para comunicação com APIs externas do ERP
- **Firewall**: Porta 13456 (ou customizada) deve estar liberada
- **Proxy**: Configurar se ambiente corporativo exigir

## Instalação

### 1. Clonar o Repositório

```bash
# Clone o repositório (se estiver versionado)
git clone <url-do-repositorio> dre-dashboard
cd dre-dashboard

# Ou copie os arquivos do projeto para o diretório desejado
```

### 2. Instalar Dependências

```bash
# Instalar todas as dependências do projeto
npm install

# Verificar instalação
npm list --depth=0
```

### 3. Configurar Variáveis de Ambiente

#### Criar arquivo `.env`
```bash
# Criar arquivo de ambiente baseado no exemplo
cp .env.example .env
```

#### Configurar variáveis obrigatórias
```bash
# .env
# Porta do servidor (padrão: 13456)
PORT=13456

# Ambiente de execução
NODE_ENV=production

# Configurações de cache (segundos)
CACHE_TTL_TOKEN=3000      # 50 minutos
CACHE_TTL_DATA=1800       # 30 minutos

# Timeout de requisições (milissegundos)
REQUEST_TIMEOUT=30000     # 30 segundos
```

### 4. Verificar Estrutura de Diretórios

```bash
# Estrutura esperada
ls -la
# dre-dashboard/
# ├── server.js
# ├── package.json
# ├── package-lock.json
# ├── .env
# ├── public/
# │   ├── index.html
# │   ├── dashboard.js
# │   └── styles.css
# ├── scripts/
# └── docs/
```

## Configuração Detalhada

### Configuração do Servidor

#### Porta e Ambiente
```javascript
// server.js - Configurações principais
const PORT = process.env.PORT || 13456;
const NODE_ENV = process.env.NODE_ENV || 'development';
```

#### Configuração de CORS
```javascript
// Ajustar origens permitidas conforme necessidade
app.use(cors({
  origin: [
    'http://localhost:13456',           // Desenvolvimento local
    'http://127.0.0.1:13456',           // Loopback
    'https://dashboard.empresa.com'     // Produção
  ],
  credentials: true
}));
```

### Configuração do ERP

#### Endpoints do Sistema Externo
```javascript
// server.js - API_CONFIG
const API_CONFIG = {
  auth: {
    url: 'https://loginerp-678980304312.us-west1.run.app/auth/login',
    credentials: {
      username: 'AGROSS_API',
      password: 'vosa9qta',
      grant_type: 'password',
      client_id: 'null',
      client_secret: 'null'
    }
  },
  sql: {
    url: 'https://sql-bi-678980304312.us-west1.run.app/rest/node/consultas/sql/comandos/22'
  }
};
```

#### Configuração via Variáveis de Ambiente
```bash
# .env - Configuração de endpoints
ERP_AUTH_URL=https://loginerp-678980304312.us-west1.run.app/auth/login
ERP_SQL_URL=https://sql-bi-678980304312.us-west1.run.app/rest/node/consultas/sql/comandos/22
ERP_USERNAME=AGROSS_API
ERP_PASSWORD=vosa9qta
```

### Configuração de Cache

#### Ajustes de Performance
```javascript
// server.js - Configurações avançadas de cache
const tokenCache = new NodeCache({ 
  stdTTL: process.env.CACHE_TTL_TOKEN || 3000,
  checkperiod: 600,  // Verificar expiração a cada 10 minutos
  useClones: false   // Melhor performance (cuidado com mutação)
});

const dataCache = new NodeCache({ 
  stdTTL: process.env.CACHE_TTL_DATA || 1800,
  checkperiod: 300,
  useClones: false,
  maxKeys: 1000  # Limitar número de chaves
});
```

## Inicialização do Sistema

### Modo Desenvolvimento

```bash
# Iniciar com auto-reload (nodemon)
npm run dev

# Acessar aplicação
# http://localhost:13456
```

### Modo Produção

```bash
# Iniciar servidor diretamente
npm start

# Ou usar script de inicialização
./scripts/start.sh
```

### Verificação de Funcionamento

#### Health Check
```bash
# Verificar status do servidor
curl http://localhost:13456/api/health

# Resposta esperada:
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "cache": {
    "tokenCache": {
      "keys": 1,
      "hits": 15,
      "misses": 2
    },
    "dataCache": {
      "keys": 5,
      "hits": 45,
      "misses": 8
    }
  }
}
```

#### Teste de API
```bash
# Testar endpoint de dados
curl "http://localhost:13456/api/dre/summary?dataInicio=2024-01-01&dataFim=2024-12-31"

# Limpar cache
curl -X POST http://localhost:13456/api/cache/clear
```

## Configuração de Produção

### 1. Process Manager (PM2)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Criar arquivo de configuração PM2
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'dre-dashboard',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 13456
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 13456
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024'
  }]
};
EOF

# Iniciar com PM2
pm2 start ecosystem.config.js --env production

# Salvar configuração
pm2 save

# Configurar startup automático
pm2 startup
```

### 2. Nginx como Reverse Proxy

```nginx
# /etc/nginx/sites-available/dre-dashboard
server {
    listen 80;
    server_name dashboard.empresa.com;
    
    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dashboard.empresa.com;
    
    # Configurações SSL
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    # Headers de segurança
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Proxy para aplicação Node.js
    location / {
        proxy_pass http://localhost:13456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:13456;
    }
    
    # Compressão
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
}
```

### 3. Docker (Opcional)

#### Dockerfile
```dockerfile
FROM node:18-alpine

# Configurar diretório de trabalho
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Alterar proprietário dos arquivos
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expor porta
EXPOSE 13456

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:13456/api/health || exit 1

# Iniciar aplicação
CMD ["npm", "start"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  dre-dashboard:
    build: .
    ports:
      - "13456:13456"
    environment:
      - NODE_ENV=production
      - PORT=13456
      - CACHE_TTL_TOKEN=3000
      - CACHE_TTL_DATA=1800
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    networks:
      - dre-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:13456/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  dre-network:
    driver: bridge
```

## Configuração de Monitoramento

### 1. Logs Estruturados

```javascript
// server.js - Configuração de logging
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### 2. Monitoramento de Performance

```bash
# Instalar métricas
npm install prom-client

# Configurar endpoint de métricas
# GET /metrics
```

### 3. Alertas

```bash
# Configurar monitoramento com health check
# Script para verificar disponibilidade
#!/bin/bash
HEALTH_URL="http://localhost:13456/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -ne 200 ]; then
    echo "Dashboard DRE indisponível! Status: $RESPONSE"
    # Enviar notificação (email, Slack, etc.)
fi
```

## Configuração de Desenvolvimento

### 1. Ambiente Local

```bash
# Instalar dependências de desenvolvimento
npm install --save-dev nodemon

# Configurar nodemon.json
cat > nodemon.json << EOF
{
  "watch": ["server.js", "public/"],
  "ext": "js,json,html,css",
  "ignore": ["node_modules/", "*.log"],
  "exec": "node server.js",
  "env": {
    "NODE_ENV": "development"
  }
}
EOF
```

### 2. Debug

```bash
# Debug com VS Code
# .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server.js",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeExecutable": "nodemon"
    }
  ]
}
```

## Solução de Problemas

### 1. Problemas Comuns

#### Porta Já em Uso
```bash
# Verificar processo na porta
sudo netstat -tulpn | grep 13456
# Ou
sudo lsof -i :13456

# Matar processo
sudo kill -9 <PID>
```

#### Falha de Conexão com ERP
```bash
# Testar conectividade
curl -v https://loginerp-678980304312.us-west1.run.app/auth/login

# Verificar DNS
nslookup loginerp-678980304312.us-west1.run.app
```

#### Cache Corrompido
```bash
# Limpar cache via API
curl -X POST http://localhost:13456/api/cache/clear

# Reiniciar servidor
pm2 restart dre-dashboard
```

### 2. Performance

#### Análise de Performance
```bash
# Instalar clinic.js
npm install -g clinic

# Análise de CPU
clinic doctor -- node server.js

# Análise de memória
clinic heapprofiler -- node server.js
```

#### Otimizações
- Aumentar cache TTL para menor carga no ERP
- Implementar cache de assets estáticos
- Configurar compression adequada
- Usar HTTP/2 com Nginx

### 3. Segurança

#### Hardening
```bash
# Atualizar dependências
npm audit
npm audit fix

# Configurar firewall
sudo ufw allow 13456/tcp
sudo ufw enable

# Remover informações sensíveis de logs
```

## Backup e Recovery

### 1. Backup da Aplicação

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backup/dre-dashboard"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup do código fonte
tar -czf $BACKUP_DIR/source_$DATE.tar.gz \
  --exclude=node_modules \
  --exclude=logs \
  --exclude=.git \
  .

# Backup de configuração
cp .env $BACKUP_DIR/env_$DATE

# Backup de logs (últimos 7 dias)
find logs/ -name "*.log" -mtime -7 -exec cp {} $BACKUP_DIR/ \;

echo "Backup concluído: $BACKUP_DIR"
```

### 2. Recovery

```bash
# Restaurar aplicação
tar -xzf /backup/dre-dashboard/source_YYYYMMDD_HHMMSS.tar.gz
cp /backup/dre-dashboard/env_YYYYMMDD_HHMMSS .env

# Reinstalar dependências
npm install

# Iniciar serviço
pm2 start ecosystem.config.js --env production
```

## Conclusão

A instalação do Dashboard DRE é um processo straightforward que envolve:

1. **Configuração de ambiente** (Node.js, variáveis)
2. **Instalação de dependências** (npm install)
3. **Configuração do ERP** (endpoints e credenciais)
4. **Inicialização do serviço** (desenvolvimento ou produção)
5. **Configurações avançadas** (proxy, cache, monitoramento)

O sistema foi projetado para ser facilmente implantado em diferentes ambientes, do desenvolvimento local até produção em escala empresarial.
