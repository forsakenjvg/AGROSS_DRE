# Frontend Documentation - Dashboard DRE

## Visão Geral

O frontend do Dashboard DRE é uma aplicação web single-page construída com tecnologias modernas, focada em proporcionar uma experiência intuitiva para visualização e análise de dados financeiros.

### Stack Tecnológico

- **HTML5**: Estrutura semântica e acessibilidade
- **Bootstrap 5.3**: Framework CSS responsivo
- **Chart.js 4.x**: Visualização de dados interativa
- **JavaScript Vanilla**: Lógica de negócio e interatividade
- **Font Awesome 6.4**: Ícones vetoriais
- **CSS3 Custom**: Estilização específica da marca

## Estrutura de Arquivos

```
public/
├── index.html              # Página principal e estrutura HTML
├── dashboard.js            # Lógica JavaScript principal
├── styles.css              # Estilos customizados
├── assets/                 # Recursos estáticos (opcional)
│   ├── images/            # Imagens e logos
│   └── icons/             # Ícones customizados
└── vendor/                 # Bibliotecas de terceiros (CDN)
```

## Arquitetura do Frontend

### 1. Estrutura HTML (`index.html`)

#### Metadados e Configuração
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    
    <!-- SEO e Meta Tags -->
    <title>Dashboard DRE - AGROSS</title>
    <meta name="description" content="Dashboard interativo para visualização de resultados financeiros">
    <meta name="author" content="AGROSS">
    
    <!-- PWA Support (futuro) -->
    <meta name="theme-color" content="#0d6efd">
    <link rel="manifest" href="manifest.json">
</head>
```

#### Estrutura Principal
```html
<body class="bg-light">
    <div class="container-fluid">
        <!-- Header Section -->
        <header class="row bg-primary text-white py-3 mb-4 shadow">
            <div class="col">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="brand-info">
                        <h1 class="h3 mb-0">
                            <i class="fas fa-chart-line me-2"></i>
                            Dashboard DRE - AGROSS
                        </h1>
                        <small class="opacity-75">Demonstração de Resultados do Exercício</small>
                    </div>
                    <div class="controls">
                        <div id="lastUpdate" class="small mb-2"></div>
                        <button id="refreshBtn" class="btn btn-light btn-sm">
                            <i class="fas fa-sync-alt me-1"></i> Atualizar
                        </button>
                    </div>
                </div>
            </div>
        </header>
        
        <!-- Filters Section -->
        <section class="row mb-4">
            <div class="col-12">
                <div class="card shadow-sm">
                    <div class="card-header bg-white">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-filter me-2 text-primary"></i>Filtros
                        </h5>
                    </div>
                    <div class="card-body">
                        <form id="filterForm" class="row g-3">
                            <!-- Campos de filtro -->
                        </form>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- Summary Cards -->
        <section class="row mb-4" id="summaryCards">
            <!-- Cards dinâmicos de resumo -->
        </section>
        
        <!-- Charts Section -->
        <main class="row">
            <div class="col-lg-8 mb-4">
                <div class="card shadow-sm">
                    <div class="card-header bg-white">
                        <h5 class="card-title mb-0">Análise por Linha DRE</h5>
                    </div>
                    <div class="card-body">
                        <canvas id="barChart" width="400" height="200"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-4 mb-4">
                <div class="card shadow-sm">
                    <div class="card-header bg-white">
                        <h5 class="card-title mb-0">Distribuição por Departamento</h5>
                    </div>
                    <div class="card-body">
                        <canvas id="pieChart" width="400" height="200"></canvas>
                    </div>
                </div>
            </div>
        </main>
        
        <!-- Data Table -->
        <section class="row">
            <div class="col-12">
                <div class="card shadow-sm">
                    <div class="card-header bg-white d-flex justify-content-between align-items-center">
                        <h5 class="card-title mb-0">Dados Detalhados</h5>
                        <div class="table-controls">
                            <button id="exportBtn" class="btn btn-outline-primary btn-sm">
                                <i class="fas fa-download me-1"></i>Exportar
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table id="dataTable" class="table table-hover">
                                <!-- Tabela dinâmica -->
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </div>
</body>
</html>
```

### 2. Lógica JavaScript (`dashboard.js`)

#### Estado da Aplicação
```javascript
// Estado global da aplicação
const appState = {
    // Dados carregados
    currentData: [],
    summaryData: [],
    
    // Filtros ativos
    filters: {
        dataInicio: '',
        dataFim: '',
        departamento: '',
        linhaDRE: ''
    },
    
    // Instâncias de gráficos
    charts: {
        bar: null,
        pie: null,
        line: null
    },
    
    // Estado da UI
    isLoading: false,
    lastUpdate: null,
    
    // Configurações
    pagination: {
        currentPage: 1,
        totalRecords: 0,
        recordsPerPage: 50
    }
};
```

#### Classe de Gerenciamento de API
```javascript
class APIClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.timeout = 30000;
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error?.message || 'Erro na requisição');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
    
    // Métodos específicos
    async getDREData(filters, page = 1, limit = 50) {
        const params = new URLSearchParams({
            ...filters,
            page: page.toString(),
            limit: limit.toString()
        });
        
        return this.request(`/dre?${params}`);
    }
    
    async getDRESummary(filters) {
        const params = new URLSearchParams(filters);
        return this.request(`/dre/summary?${params}`);
    }
    
    async getDepartmentsData(filters) {
        const params = new URLSearchParams(filters);
        return this.request(`/dre/departamentos?${params}`);
    }
    
    async clearCache() {
        return this.request('/cache/clear', { method: 'POST' });
    }
    
    async healthCheck() {
        return this.request('/health');
    }
}
```

#### Classe de Renderização de Gráficos
```javascript
class ChartRenderer {
    constructor() {
        this.chartColors = {
            primary: '#0d6efd',
            success: '#198754',
            warning: '#ffc107',
            danger: '#dc3545',
            info: '#0dcaf0',
            secondary: '#6c757d'
        };
        
        this.defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 12
                    },
                    padding: 10,
                    cornerRadius: 4
                }
            }
        };
    }
    
    createBarChart(containerId, data, options = {}) {
        const canvas = document.getElementById(containerId);
        const ctx = canvas.getContext('2d');
        
        // Destruir gráfico existente
        if (appState.charts.bar) {
            appState.charts.bar.destroy();
        }
        
        const chartData = {
            labels: data.map(item => item.label),
            datasets: [{
                label: 'Valor (R$)',
                data: data.map(item => item.value),
                backgroundColor: data.map((item, index) => 
                    this.getColorByIndex(index)
                ),
                borderColor: data.map((item, index) => 
                    this.getColorByIndex(index, 0.8)
                ),
                borderWidth: 1
            }]
        };
        
        const config = {
            type: 'bar',
            data: chartData,
            options: {
                ...this.defaultOptions,
                ...options,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'R$ ' + value.toLocaleString('pt-BR');
                            }
                        }
                    }
                }
            }
        };
        
        appState.charts.bar = new Chart(ctx, config);
        return appState.charts.bar;
    }
    
    createPieChart(containerId, data, options = {}) {
        const canvas = document.getElementById(containerId);
        const ctx = canvas.getContext('2d');
        
        if (appState.charts.pie) {
            appState.charts.pie.destroy();
        }
        
        const chartData = {
            labels: data.map(item => item.label),
            datasets: [{
                data: data.map(item => item.value),
                backgroundColor: data.map((item, index) => 
                    this.getColorByIndex(index, 0.7)
                ),
                borderColor: '#fff',
                borderWidth: 2
            }]
        };
        
        const config = {
            type: 'doughnut',
            data: chartData,
            options: {
                ...this.defaultOptions,
                ...options,
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: {
                        position: 'right'
                    }
                }
            }
        };
        
        appState.charts.pie = new Chart(ctx, config);
        return appState.charts.pie;
    }
    
    createLineChart(containerId, data, options = {}) {
        const canvas = document.getElementById(containerId);
        const ctx = canvas.getContext('2d');
        
        if (appState.charts.line) {
            appState.charts.line.destroy();
        }
        
        const chartData = {
            labels: data.map(item => item.date),
            datasets: [{
                label: 'Receitas',
                data: data.map(item => item.receitas),
                borderColor: this.chartColors.success,
                backgroundColor: this.hexToRgba(this.chartColors.success, 0.1),
                tension: 0.4
            }, {
                label: 'Despesas',
                data: data.map(item => item.despesas),
                borderColor: this.chartColors.danger,
                backgroundColor: this.hexToRgba(this.chartColors.danger, 0.1),
                tension: 0.4
            }]
        };
        
        const config = {
            type: 'line',
            data: chartData,
            options: {
                ...this.defaultOptions,
                ...options,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'R$ ' + value.toLocaleString('pt-BR');
                            }
                        }
                    }
                }
            }
        };
        
        appState.charts.line = new Chart(ctx, config);
        return appState.charts.line;
    }
    
    // Métodos utilitários
    getColorByIndex(index, alpha = 1) {
        const colors = [
            '#0d6efd', '#198754', '#ffc107', '#dc3545',
            '#0dcaf0', '#6f42c1', '#fd7e14', '#20c997'
        ];
        const color = colors[index % colors.length];
        return alpha < 1 ? this.hexToRgba(color, alpha) : color;
    }
    
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}
```

#### Classe de Gerenciamento de UI
```javascript
class UIManager {
    constructor() {
        this.elements = {
            filterForm: document.getElementById('filterForm'),
            refreshBtn: document.getElementById('refreshBtn'),
            lastUpdate: document.getElementById('lastUpdate'),
            summaryCards: document.getElementById('summaryCards'),
            dataTable: document.getElementById('dataTable'),
            exportBtn: document.getElementById('exportBtn'),
            loadingSpinner: this.createLoadingSpinner()
        };
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Form filters
        this.elements.filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFilterSubmit();
        });
        
        // Individual filter changes (auto-submit)
        this.elements.filterForm.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', () => {
                if (this.shouldAutoSubmit(input)) {
                    this.handleFilterSubmit();
                }
            });
        });
        
        // Refresh button
        this.elements.refreshBtn.addEventListener('click', () => {
            this.handleRefresh();
        });
        
        // Export button
        this.elements.exportBtn.addEventListener('click', () => {
            this.handleExport();
        });
    }
    
    showLoading() {
        appState.isLoading = true;
        this.elements.refreshBtn.disabled = true;
        this.elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
        document.body.appendChild(this.elements.loadingSpinner);
    }
    
    hideLoading() {
        appState.isLoading = false;
        this.elements.refreshBtn.disabled = false;
        this.elements.refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Atualizar';
        
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.remove();
        }
    }
    
    showError(message, title = 'Erro') {
        const alertHtml = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <strong>${title}:</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const container = document.querySelector('.container-fluid');
        container.insertAdjacentHTML('afterbegin', alertHtml);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alert = container.querySelector('.alert');
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }
    
    showSuccess(message, title = 'Sucesso') {
        const alertHtml = `
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                <strong>${title}:</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const container = document.querySelector('.container-fluid');
        container.insertAdjacentHTML('afterbegin', alertHtml);
        
        setTimeout(() => {
            const alert = container.querySelector('.alert');
            if (alert) {
                alert.remove();
            }
        }, 3000);
    }
    
    updateSummaryCards(summaryData) {
        this.elements.summaryCards.innerHTML = '';
        
        const cards = [
            {
                title: 'Total Receitas',
                value: summaryData.total_receitas || 0,
                icon: 'fa-arrow-up',
                color: 'success'
            },
            {
                title: 'Total Despesas',
                value: summaryData.total_despesas || 0,
                icon: 'fa-arrow-down',
                color: 'danger'
            },
            {
                title: 'Resultado Líquido',
                value: summaryData.resultado_liquido || 0,
                icon: 'fa-balance-scale',
                color: summaryData.resultado_liquido >= 0 ? 'success' : 'danger'
            },
            {
                title: 'Margem Líquida',
                value: summaryData.margem_liquida || 0,
                icon: 'fa-percentage',
                color: 'info',
                isPercentage: true
            }
        ];
        
        cards.forEach(card => {
            const cardElement = this.createSummaryCard(card);
            this.elements.summaryCards.appendChild(cardElement);
        });
    }
    
    createSummaryCard(card) {
        const div = document.createElement('div');
        div.className = 'col-md-6 col-lg-3 mb-3';
        
        const valueClass = card.value >= 0 ? 'text-success' : 'text-danger';
        const displayValue = card.isPercentage 
            ? `${card.value.toFixed(1)}%` 
            : `R$ ${card.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        
        div.innerHTML = `
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center">
                        <div class="flex-shrink-0">
                            <div class="bg-${card.color} bg-opacity-10 rounded-circle p-3">
                                <i class="fas ${card.icon} text-${card.color}"></i>
                            </div>
                        </div>
                        <div class="flex-grow-1 ms-3">
                            <h6 class="text-muted mb-1">${card.title}</h6>
                            <h5 class="${valueClass} mb-0">${displayValue}</h5>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return div;
    }
    
    updateDataTable(data) {
        this.elements.dataTable.innerHTML = '';
        
        // Create header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="table-light">
                <th>Data</th>
                <th>Departamento</th>
                <th>Linha DRE</th>
                <th class="text-end">Valor</th>
            </tr>
        `;
        this.elements.dataTable.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        data.forEach(item => {
            const row = document.createElement('tr');
            const valueClass = item.valor >= 0 ? 'text-success' : 'text-danger';
            
            row.innerHTML = `
                <td>${new Date(item.data_movimento).toLocaleDateString('pt-BR')}</td>
                <td>${item.departamento}</td>
                <td>${item.linha_dre}</td>
                <td class="text-end ${valueClass}">
                    R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
            `;
            tbody.appendChild(row);
        });
        
        this.elements.dataTable.appendChild(tbody);
    }
    
    updateLastUpdate() {
        const now = new Date();
        const formatted = now.toLocaleString('pt-BR');
        this.elements.lastUpdate.textContent = `Última atualização: ${formatted}`;
        appState.lastUpdate = now;
    }
    
    createLoadingSpinner() {
        const spinner = document.createElement('div');
        spinner.id = 'loadingSpinner';
        spinner.className = 'position-fixed top-50 start-50 translate-middle';
        spinner.style.zIndex = '9999';
        spinner.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Carregando...</span>
            </div>
        `;
        return spinner;
    }
    
    shouldAutoSubmit(input) {
        // Auto-submit para selects e date inputs
        const autoSubmitTypes = ['select-one', 'date'];
        return autoSubmitTypes.includes(input.type);
    }
    
    async handleFilterSubmit() {
        const formData = new FormData(this.elements.filterForm);
        
        appState.filters = {
            dataInicio: formData.get('dataInicio') || '',
            dataFim: formData.get('dataFim') || '',
            departamento: formData.get('departamento') || '',
            linhaDRE: formData.get('linhaDRE') || ''
        };
        
        await this.loadData();
    }
    
    async handleRefresh() {
        // Limpar cache forçando atualização
        try {
            await apiClient.clearCache();
            this.showSuccess('Cache limpo, atualizando dados...');
            await this.loadData();
        } catch (error) {
            this.showError('Erro ao limpar cache', 'Falha na atualização');
        }
    }
    
    async handleExport() {
        try {
            const csvData = this.generateCSV(appState.currentData);
            this.downloadCSV(csvData, 'dre-export.csv');
            this.showSuccess('Dados exportados com sucesso');
        } catch (error) {
            this.showError('Erro ao exportar dados');
        }
    }
    
    generateCSV(data) {
        const headers = ['Data', 'Departamento', 'Linha DRE', 'Valor'];
        const rows = data.map(item => [
            new Date(item.data_movimento).toLocaleDateString('pt-BR'),
            item.departamento,
            item.linha_dre,
            item.valor.toFixed(2)
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        return csvContent;
    }
    
    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    async loadData() {
        this.showLoading();
        
        try {
            // Carregar dados de resumo e detalhes em paralelo
            const [summaryData, detailData] = await Promise.all([
                apiClient.getDRESummary(appState.filters),
                apiClient.getDREData(appState.filters)
            ]);
            
            // Atualizar estado
            appState.summaryData = summaryData.data;
            appState.currentData = detailData.data;
            appState.pagination = detailData.pagination;
            
            // Renderizar componentes
            this.updateSummaryCards(summaryData.resumo_geral || {});
            this.updateDataTable(detailData.data);
            
            // Renderizar gráficos
            this.renderCharts(summaryData.data);
            
            // Atualizar timestamp
            this.updateLastUpdate();
            
            this.showSuccess('Dados atualizados com sucesso');
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError(error.message || 'Erro ao carregar dados');
        } finally {
            this.hideLoading();
        }
    }
    
    renderCharts(summaryData) {
        const chartRenderer = new ChartRenderer();
        
        // Preparar dados para gráfico de barras
        const barData = summaryData.map(item => ({
            label: item.linha_dre,
            value: Math.abs(item.total_valor)
        }));
        
        // Preparar dados para gráfico de pizza (departamentos)
        const deptData = this.aggregateByDepartment(summaryData);
        
        // Renderizar gráficos
        chartRenderer.createBarChart('barChart', barData);
        chartRenderer.createPieChart('pieChart', deptData);
    }
    
    aggregateByDepartment(summaryData) {
        const deptMap = new Map();
        
        summaryData.forEach(item => {
            if (item.detalhes_por_departamento) {
                item.detalhes_por_departamento.forEach(dept => {
                    const current = deptMap.get(dept.departamento) || 0;
                    deptMap.set(dept.departamento, current + Math.abs(dept.valor));
                });
            }
        });
        
        return Array.from(deptMap.entries()).map(([name, value]) => ({
            label: name,
            value
        }));
    }
}
```

### 3. Estilos Customizados (`styles.css`)

#### Design System
```css
/* Variáveis CSS Customizadas */
:root {
    --primary-color: #0d6efd;
    --secondary-color: #6c757d;
    --success-color: #198754;
    --warning-color: #ffc107;
    --danger-color: #dc3545;
    --info-color: #0dcaf0;
    --light-color: #f8f9fa;
    --dark-color: #212529;
    
    /* Gradientes personalizados */
    --gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --gradient-success: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    --gradient-danger: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
    
    /* Sombras */
    --shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
    --shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    --shadow-lg: 0 1rem 3rem rgba(0, 0, 0, 0.175);
    
    /* Transições */
    --transition-fast: 0.15s ease-in-out;
    --transition-normal: 0.3s ease-in-out;
    --transition-slow: 0.5s ease-in-out;
}

/* Reset e Base */
* {
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: var(--dark-color);
    background-color: var(--light-color);
}

/* Header Styles */
header {
    background: var(--gradient-primary) !important;
    box-shadow: var(--shadow);
}

.brand-info h1 {
    font-weight: 600;
    margin-bottom: 0.25rem;
}

.brand-info small {
    opacity: 0.9;
}

/* Card Styles */
.card {
    border: none;
    border-radius: 0.75rem;
    transition: transform var(--transition-normal), box-shadow var(--transition-normal);
    overflow: hidden;
}

.card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

.card-header {
    background: var(--light-color);
    border-bottom: 2px solid #e9ecef;
    font-weight: 600;
}

/* Button Styles */
.btn {
    border-radius: 0.5rem;
    font-weight: 500;
    transition: all var(--transition-normal);
    border: none;
    text-transform: none;
}

.btn-primary {
    background: var(--gradient-primary);
}

.btn-success {
    background: var(--gradient-success);
}

.btn-danger {
    background: var(--gradient-danger);
}

.btn:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}

/* Form Styles */
.form-control, .form-select {
    border-radius: 0.5rem;
    border: 1px solid #dee2e6;
    transition: all var(--transition-normal);
}

.form-control:focus, .form-select:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}

.form-label {
    font-weight: 500;
    color: var(--secondary-color);
    margin-bottom: 0.5rem;
}

/* Table Styles */
.table {
    margin-bottom: 0;
}

.table th {
    border-top: none;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.5px;
    background-color: var(--light-color);
    position: sticky;
    top: 0;
}

.table td {
    vertical-align: middle;
    border-color: #f1f3f5;
}

.table-hover tbody tr:hover {
    background-color: rgba(13, 110, 253, 0.05);
}

/* Loading Spinner */
#loadingSpinner {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 0.5rem;
    padding: 2rem;
    box-shadow: var(--shadow-lg);
}

/* Chart Container */
.canvas-container {
    position: relative;
    height: 300px;
    width: 100%;
}

/* Summary Cards Animation */
@keyframes slideInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.summary-card {
    animation: slideInUp var(--transition-slow) ease-out;
    animation-fill-mode: both;
}

.summary-card:nth-child(1) { animation-delay: 0.1s; }
.summary-card:nth-child(2) { animation-delay: 0.2s; }
.summary-card:nth-child(3) { animation-delay: 0.3s; }
.summary-card:nth-child(4) { animation-delay: 0.4s; }

/* Responsive Design */
@media (max-width: 768px) {
    .brand-info h1 {
        font-size: 1.25rem;
    }
    
    .brand-info small {
        font-size: 0.75rem;
    }
    
    .btn-sm {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
    }
    
    .table {
        font-size: 0.875rem;
    }
    
    .canvas-container {
        height: 250px;
    }
}

@media (max-width: 576px) {
    .container-fluid {
        padding-left: 0.5rem;
        padding-right: 0.5rem;
    }
    
    .card-body {
        padding: 1rem;
    }
    
    .table {
        font-size: 0.8rem;
    }
    
    .canvas-container {
        height: 200px;
    }
}

/* Print Styles */
@media print {
    .no-print {
        display: none !important;
    }
    
    .card {
        box-shadow: none;
        border: 1px solid #dee2e6;
    }
    
    .btn {
        display: none;
    }
}

/* Accessibility */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* Focus styles for accessibility */
.btn:focus,
.form-control:focus,
.form-select:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

/* Dark Mode Support (future) */
@media (prefers-color-scheme: dark) {
    :root {
        --light-color: #212529;
        --dark-color: #f8f9fa;
    }
    
    body {
        background-color: var(--dark-color);
        color: var(--light-color);
    }
    
    .card {
        background-color: #343a40;
        color: var(--light-color);
    }
    
    .table {
        color: var(--light-color);
    }
}
```

## Componentes Interativos

### 1. Sistema de Filtros

#### Formulário Dinâmico
```javascript
function createFilterForm() {
    const filterForm = document.getElementById('filterForm');
    
    filterForm.innerHTML = `
        <div class="col-md-3">
            <label for="dataInicio" class="form-label">Data Início</label>
            <input type="date" 
                   class="form-control" 
                   id="dataInicio" 
                   name="dataInicio" 
                   required>
        </div>
        
        <div class="col-md-3">
            <label for="dataFim" class="form-label">Data Fim</label>
            <input type="date" 
                   class="form-control" 
                   id="dataFim" 
                   name="dataFim" 
                   required>
        </div>
        
        <div class="col-md-3">
            <label for="departamento" class="form-label">Departamento</label>
            <select class="form-select" id="departamento" name="departamento">
                <option value="">Todos</option>
                <option value="ADM.FINANCEIRO">ADM.FINANCEIRO</option>
                <option value="COMERCIAL">COMERCIAL</option>
                <option value="DIRECAO">DIRECAO</option>
                <option value="GENTE E GESTAO">GENTE E GESTAO</option>
                <option value="ENGENHARIA">ENGENHARIA</option>
                <option value="PRODUCAO">PRODUCAO</option>
                <option value="SUPPLY CHAIN">SUPPLY CHAIN</option>
                <option value="POS VENDA">POS VENDA</option>
                <option value="NAO CLASSIFICADO">NAO CLASSIFICADO</option>
            </select>
        </div>
        
        <div class="col-md-3">
            <label for="linhaDRE" class="form-label">Linha DRE</label>
            <select class="form-select" id="linhaDRE" name="linhaDRE">
                <option value="">Todas</option>
                <option value="RECEITA OPERACIONAL LIQUIDA">RECEITA OPERACIONAL LIQUIDA</option>
                <option value="CPV/CMV/CSP">CPV/CMV/CSP</option>
                <option value="DESPESAS OPERACIONAIS">DESPESAS OPERACIONAIS</option>
                <option value="OUTRAS RECEITAS OPERACIONAIS">OUTRAS RECEITAS OPERACIONAIS</option>
                <option value="OUTRAS DESPESAS OPERACIONAIS">OUTRAS DESPESAS OPERACIONAIS</option>
                <option value="RECEITAS FINANCEIRAS">RECEITAS FINANCEIRAS</option>
                <option value="DESPESAS FINANCEIRAS">DESPESAS FINANCEIRAS</option>
                <option value="RESULTADO NAO OPERACIONAL">RESULTADO NAO OPERACIONAL</option>
                <option value="PROVISAO PARA IR E CSLL">PROVISAO PARA IR E CSLL</option>
            </select>
        </div>
        
        <div class="col-12 mt-3">
            <button type="submit" class="btn btn-primary me-2">
                <i class="fas fa-search me-1"></i>Aplicar Filtros
            </button>
            <button type="button" class="btn btn-outline-secondary" onclick="clearFilters()">
                <i class="fas fa-times me-1"></i>Limpar
            </button>
        </div>
    `;
}

function clearFilters() {
    document.getElementById('filterForm').reset();
    appState.filters = {
        dataInicio: '',
        dataFim: '',
        departamento: '',
        linhaDRE: ''
    };
    uiManager.loadData();
}
```

### 2. Sistema de Paginação

```javascript
function createPaginationControls(pagination) {
    const paginationContainer = document.createElement('nav');
    paginationContainer.className = 'd-flex justify-content-between align-items-center mt-4';
    
    const info = document.createElement('div');
    info.className = 'text-muted';
    info.innerHTML = `Mostrando ${pagination.currentPage * pagination.limit - pagination.limit + 1} 
                     a ${Math.min(pagination.currentPage * pagination.limit, pagination.totalRecords)} 
                     de ${pagination.totalRecords} registros`;
    
    const paginationNav = document.createElement('ul');
    paginationNav.className = 'pagination pagination-sm mb-0';
    
    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${!pagination.hasPrevious ? 'disabled' : ''}`;
    prevLi.innerHTML = `
        <a class="page-link" href="#" onclick="changePage(${pagination.currentPage - 1})">
            <i class="fas fa-chevron-left"></i>
        </a>
    `;
    
    // Page numbers
    const maxVisiblePages = 5;
    const startPage = Math.max(1, pagination.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === pagination.currentPage ? 'active' : ''}`;
        pageLi.innerHTML = `
            <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
        `;
        paginationNav.appendChild(pageLi);
    }
    
    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${!pagination.hasNext ? 'disabled' : ''}`;
    nextLi.innerHTML = `
        <a class="page-link" href="#" onclick="changePage(${pagination.currentPage + 1})">
            <i class="fas fa-chevron-right"></i>
        </a>
    `;
    
    paginationNav.appendChild(prevLi);
    paginationNav.appendChild(nextLi);
    
    paginationContainer.appendChild(info);
    paginationContainer.appendChild(paginationNav);
    
    return paginationContainer;
}

async function changePage(page) {
    appState.pagination.currentPage = page;
    await uiManager.loadData();
}
```

### 3. Sistema de Notificações

```javascript
class NotificationManager {
    constructor() {
        this.container = this.createNotificationContainer();
    }
    
    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }
    
    show(message, type = 'info', duration = 5000, title = null) {
        const id = Date.now();
        const notification = this.createNotification(id, message, type, title);
        
        this.container.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                this.remove(id);
            }, duration);
        }
        
        return id;
    }
    
    success(message, duration = 3000, title = 'Sucesso') {
        return this.show(message, 'success', duration, title);
    }
    
    error(message, duration = 0, title = 'Erro') {
        return this.show(message, 'danger', duration, title);
    }
    
    warning(message, duration = 5000, title = 'Atenção') {
        return this.show(message, 'warning', duration, title);
    }
    
    info(message, duration = 5000, title = 'Informação') {
        return this.show(message, 'info', duration, title);
    }
    
    remove(id) {
        const notification = document.getElementById(`notification-${id}`);
        if (notification) {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }
    
    createNotification(id, message, type, title) {
        const div = document.createElement('div');
        div.id = `notification-${id}`;
        div.className = `notification notification-${type} mb-2`;
        
        const iconMap = {
            success: 'fa-check-circle',
            danger: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        div.innerHTML = `
            <div class="notification-header">
                <i class="fas ${iconMap[type]} me-2"></i>
                <strong>${title || type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                <button type="button" class="btn-close btn-close-white ms-auto" onclick="notificationManager.remove(${id})"></button>
            </div>
            <div class="notification-body">
                ${message}
            </div>
        `;
        
        return div;
    }
}

// CSS para notificações
const notificationStyles = `
.notification {
    background: white;
    border-left: 4px solid;
    border-radius: 0.5rem;
    box-shadow: var(--shadow);
    min-width: 300px;
    max-width: 500px;
    opacity: 0;
    transform: translateX(100%);
    transition: all var(--transition-normal);
}

.notification.show {
    opacity: 1;
    transform: translateX(0);
}

.notification-success {
    border-left-color: var(--success-color);
}

.notification-danger {
    border-left-color: var(--danger-color);
}

.notification-warning {
    border-left-color: var(--warning-color);
}

.notification-info {
    border-left-color: var(--info-color);
}

.notification-header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f1f3f5;
    display: flex;
    align-items: center;
    background-color: #f8f9fa;
    border-radius: 0.5rem 0.5rem 0 0;
}

.notification-body {
    padding: 0.75rem 1rem;
}
`;

// Adicionar estilos ao DOM
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);
```

## Performance e Otimização

### 1. Lazy Loading de Componentes

```javascript
class LazyLoader {
    constructor() {
        this.observedElements = new Map();
        this.intersectionObserver = new IntersectionObserver(
            this.handleIntersection.bind(this),
            { threshold: 0.1 }
        );
    }
    
    observe(element, callback) {
        this.observedElements.set(element, callback);
        this.intersectionObserver.observe(element);
    }
    
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const callback = this.observedElements.get(entry.target);
                if (callback) {
                    callback();
                    this.intersectionObserver.unobserve(entry.target);
                    this.observedElements.delete(entry.target);
                }
            }
        });
    }
}

// Uso para gráficos
const lazyLoader = new LazyLoader();

document.querySelectorAll('.chart-container').forEach(container => {
    lazyLoader.observe(container, () => {
        // Inicializar gráfico apenas quando visível
        const chartType = container.dataset.chartType;
        initializeChart(container, chartType);
    });
});
```

### 2. Debounce para Input Events

```javascript
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// Aplicar debounce aos filtros
const debouncedFilterSubmit = debounce(async () => {
    await uiManager.handleFilterSubmit();
}, 500);

document.querySelectorAll('#filterForm input, #filterForm select').forEach(input => {
    if (input.type === 'text') {
        input.addEventListener('input', debouncedFilterSubmit);
    }
});
```

### 3. Virtual Scrolling para Tabelas Grandes

```javascript
class VirtualTable {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            itemHeight: options.itemHeight || 40,
            bufferSize: options.bufferSize || 10,
            ...options
        };
        
        this.data = [];
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.scrollTop = 0;
        
        this.initialize();
    }
    
    initialize() {
        this.container.innerHTML = `
            <div class="virtual-table">
                <div class="virtual-table-header"></div>
                <div class="virtual-table-viewport">
                    <div class="virtual-table-spacer"></div>
                    <div class="virtual-table-content"></div>
                </div>
            </div>
        `;
        
        this.viewport = this.container.querySelector('.virtual-table-viewport');
        this.spacer = this.container.querySelector('.virtual-table-spacer');
        this.content = this.container.querySelector('.virtual-table-content');
        
        this.viewport.addEventListener('scroll', this.handleScroll.bind(this));
    }
    
    setData(data) {
        this.data = data;
        this.updateVisibleRange();
        this.render();
    }
    
    handleScroll() {
        this.scrollTop = this.viewport.scrollTop;
        this.updateVisibleRange();
        this.render();
    }
    
    updateVisibleRange() {
        const viewportHeight = this.viewport.clientHeight;
        const start = Math.floor(this.scrollTop / this.options.itemHeight);
        const visibleCount = Math.ceil(viewportHeight / this.options.itemHeight);
        
        this.visibleStart = Math.max(0, start - this.options.bufferSize);
        this.visibleEnd = Math.min(
            this.data.length,
            start + visibleCount + this.options.bufferSize
        );
    }
    
    render() {
        const totalHeight = this.data.length * this.options.itemHeight;
        this.spacer.style.height = `${totalHeight}px`;
        
        const visibleData = this.data.slice(this.visibleStart, this.visibleEnd);
        const offsetY = this.visibleStart * this.options.itemHeight;
        
        this.content.style.transform = `translateY(${offsetY}px)`;
        this.content.innerHTML = this.renderRows(visibleData);
    }
    
    renderRows(data) {
        return data.map((item, index) => `
            <div class="virtual-table-row" style="height: ${this.options.itemHeight}px">
                <!-- Render row content -->
            </div>
        `).join('');
    }
}
```

## Testes e Debug

### 1. Testes Unitários com Jest

```javascript
// frontend.test.js
describe('Dashboard Frontend', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="test-container"></div>';
    });
    
    test('APIClient should make correct requests', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true, data: [] })
        });
        global.fetch = mockFetch;
        
        const client = new APIClient();
        await client.getDREData({ dataInicio: '2024-01-01', dataFim: '2024-12-31' });
        
        expect(mockFetch).toHaveBeenCalledWith(
            '/api/dre?dataInicio=2024-01-01&dataFim=2024-12-31&page=1&limit=50',
            expect.any(Object)
        );
    });
    
    test('ChartRenderer should create bar chart correctly', () => {
        const mockChart = { destroy: jest.fn() };
        global.Chart = jest.fn(() => mockChart);
        
        const renderer = new ChartRenderer();
        const data = [
            { label: 'Test', value: 100 }
        ];
        
        renderer.createBarChart('test-canvas', data);
        
        expect(global.Chart).toHaveBeenCalled();
    });
});
```

### 2. Debug Tools

```javascript
// Debug mode development tools
if (process.env.NODE_ENV === 'development') {
    // Debug panel
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debugPanel';
    debugPanel.className = 'position-fixed bottom-0 end-0 p-3 bg-dark text-white';
    debugPanel.style.zIndex = '9998';
    debugPanel.innerHTML = `
        <h6>Debug Panel</h6>
        <div id="debugInfo"></div>
    `;
    document.body.appendChild(debugPanel);
    
    // Update debug info
    function updateDebugInfo() {
        const debugInfo = document.getElementById('debugInfo');
        debugInfo.innerHTML = `
            <small>
                Current Data: ${appState.currentData.length} items<br>
                Loading: ${appState.isLoading}<br>
                Cache Hit: ${appState.lastCacheHit}<br>
                Last Update: ${appState.lastUpdate}<br>
                Memory: ${(performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
            </small>
        `;
    }
    
    setInterval(updateDebugInfo, 1000);
}
```

## Conclusão

O frontend do Dashboard DRE foi desenvolvido com foco em:

- **Performance**: Lazy loading, virtual scrolling, cache de componentes
- **Experiência do Usuário**: Design responsivo, animações suaves, feedback imediato
- **Acessibilidade**: HTML semântico, navegação por teclado, leitor de tela
- **Maintainability**: Código modular, testes automatizados, documentação
- **Escalabilidade**: Arquitetura componentizada, fácil extensão

O sistema está preparado para evoluir com novas funcionalidades e crescer com as necessidades do negócio.
